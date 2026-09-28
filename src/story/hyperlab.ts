// The Hyperlab adapter. It turns a run (or a set of shot requests) into an ordered list
// of HTTP requests for Hyperlab Rebuild's REST API and does nothing else: no network,
// no clock, no randomness. A separate executor (tools/video/hyperlab-export.ts) sends
// the list; runPlan() below is the transport-agnostic loop it uses.
//
// Steps refer to values the server will return (project id, node ids, datom ids, the
// sequence revision, new state ids) with {{name}} templates, and say where to capture
// them from each response. Anything that could not be confirmed from Hyperlab's source
// is marked `liveCheck` so it is easy to find when the first real run goes wrong.

import { allRecords, characterSpecs } from "./characters.ts";
import type { CharacterSpecOptions } from "./characters.ts";
import type { EtherRecord } from "./datoms.ts";
import { buildStoryGraph, CONTRACTS } from "./graph.ts";
import type { BuiltGraph } from "./graph.ts";
import type { RunRecord } from "./recorder.ts";
import type { ShotRequest } from "./shots.ts";
import { DEFAULTS } from "./videoconfig.ts";

export interface PlanStep {
  id: string;
  method: "GET" | "POST" | "PUT";
  path: string;
  body?: unknown;
  /** variable name -> dotted path in the JSON response, e.g. { revision: "revision" }. */
  capture?: Record<string, string>;
  note?: string;
  /** What to check the first time this runs against a live server. */
  liveCheck?: string;
}

export interface ExportPlan {
  version: 1;
  runId: string;
  steps: PlanStep[];
  notes: string[];
}

export interface ExportOptions {
  /** Folder holding a valid .dtproject, registered with Hyperlab (loopback only). */
  projectPath: string;
  /** Publish records with POST /api/datoms and their deterministic ids instead of content nodes. */
  direct?: boolean;
  /** Also create (and optionally submit) a generation job per shot. */
  shots?: ShotRequest[];
  submitJobs?: boolean;
  /** Only export the people that appear in the run (default), or everyone. */
  everyone?: boolean;
}

const PID = "{{project_id}}";
const contentKind = (r: EtherRecord): string => (r.type === "concept.character" ? "character" : r.type === "concept.prop" ? "prop" : "location");

function replaceStrings(v: unknown, map: Map<string, string>): unknown {
  if (typeof v === "string") return map.get(v) ?? v;
  if (Array.isArray(v)) return v.map((x) => replaceStrings(x, map));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, replaceStrings(x, map)]));
  return v;
}

export function planExport(run: RunRecord, opts: ExportOptions, built: BuiltGraph = buildStoryGraph(run)): ExportPlan {
  const { sequence } = built;
  const steps: PlanStep[] = [];
  const notes: string[] = [];
  const base = `/api/projects/${PID}/sequences`;
  steps.push({
    id: "register-project",
    method: "POST",
    path: "/api/projects/register",
    body: { path: opts.projectPath },
    capture: { project_id: "project_id" },
    note: "The folder must contain a valid .dtproject. Loopback only.",
    liveCheck: "Response key holding the project id (project_id vs id).",
  });

  // 1. Datoms for everyone the sequence binds (or everyone, on request).
  const records = allRecords(run.options);
  const wanted = new Set(sequence.entities.map((e) => e.datom_id));
  const chosen = records.filter((r) => opts.everyone || wanted.has(r.id));
  const idToVar = new Map<string, string>();
  for (const r of chosen) idToVar.set(r.id, `{{datom:${r.id}}}`);
  for (const r of chosen) {
    if (opts.direct) {
      steps.push({
        id: `datom:${r.id}`,
        method: "POST",
        path: "/api/datoms",
        body: { id: r.id, type: r.type, name: r.name, description: String(r.meta.description ?? ""), meta: r.meta },
        capture: { [`datom:${r.id}`]: "id" },
        liveCheck: "Ether REST schema for POST /api/datoms (field names for meta and slot links).",
      });
      continue;
    }
    steps.push({
      id: `node:${r.id}`,
      method: "POST",
      path: `/api/projects/${PID}/content/nodes`,
      body: { kind: contentKind(r), name: r.name, data: { name: r.name, ...r.meta } },
      capture: { [`node:${r.id}`]: "id" },
      liveCheck: "data shape per content kind (character wants appearance).",
    });
    steps.push({
      id: `publish:${r.id}`,
      method: "POST",
      path: `/api/projects/${PID}/content/nodes/{{node:${r.id}}}/ether-datom/publish`,
      body: {},
      capture: { [`datom:${r.id}`]: "datom_id" },
    });
  }

  // 2. The sequence and its entities.
  steps.push({
    id: "create-sequence",
    method: "POST",
    path: base,
    body: { name: `The Great Haze ${run.runId}`, description: sequence.description, settings: sequence.settings },
    capture: { sequence_id: "id", revision: "revision", start_state_id: "start_state_id" },
    liveCheck: "Response keys: id / revision / start_state_id.",
  });
  const seqBase = `${base}/{{sequence_id}}`;
  for (const e of sequence.entities) {
    steps.push({
      id: `entity:${e.instance_id}`,
      method: "POST",
      path: `${seqBase}/entities`,
      body: { expected_revision: "{{revision}}", datom_id: idToVar.get(e.datom_id) ?? e.datom_id, datom_type: e.datom_type, instance_id: e.instance_id },
      capture: { revision: "revision" },
    });
  }
  const start = sequence.states[0];
  steps.push({
    id: "set-start-state",
    method: "PUT",
    path: `${seqBase}/states/{{start_state_id}}`,
    body: { expected_revision: "{{revision}}", state: start.state },
    capture: { revision: "revision" },
    note: "Only the start state is editable; every later state is derived from its transition's actions.",
    liveCheck: "Route and body for editing the start state (see project_sequences_api.py).",
  });

  // 3. One transition per beat.
  const stateName = new Map(sequence.states.map((s) => [s.id, s.name]));
  const varOf = (id: string) => (id === sequence.start_state_id ? "{{start_state_id}}" : `{{state:${id}}}`);
  for (const t of sequence.transitions) {
    const to = sequence.states.find((s) => s.id === t.to_state_id)!;
    steps.push({
      id: `transition:${t.id}`,
      method: "POST",
      path: `${seqBase}/transitions`,
      body: {
        expected_revision: "{{revision}}",
        from_state_id: varOf(t.from_state_id),
        label: t.label,
        destination_name: stateName.get(t.to_state_id) ?? to.name,
        preconditions: t.preconditions,
        actions: replaceStrings(t.actions, idToVar),
        x: to.x,
        y: to.y,
        ordinal: t.ordinal,
      },
      capture: { revision: "revision", [`state:${t.to_state_id}`]: "state.id" },
      liveCheck: "Where the created destination state's id is in the response.",
    });
  }

  // 4. Optional generation jobs (Hyperlab decides spending; nothing is queued unless asked).
  for (const req of opts.shots ?? []) {
    const params: Record<string, unknown> = {
      prompt: req.prompt,
      duration: req.duration,
      resolution: req.resolution,
      aspect_ratio: req.aspect_ratio,
    };
    if (req.mode === "reference") params.input_image = req.references.map((r) => ({ datom_id: idToVar.get(r.datom_id) ?? r.datom_id, slot_key: r.slot_key }));
    steps.push({
      id: `job:${req.cacheKey}`,
      method: "POST",
      path: "/api/jobs/from_capability",
      body: { capability: DEFAULTS.capability, service_id: req.service_id, params, project_id: PID, auto_queue: false, tags: ["the-great-haze", run.runId], notes: req.cacheKey },
      capture: { [`job:${req.cacheKey}`]: "job_id" },
      liveCheck: "Capability name for reference-to-video, and whether params.duration is the right key for the local R2V route.",
    });
    if (opts.submitJobs) {
      steps.push({ id: `submit:${req.cacheKey}`, method: "POST", path: "/api/queue/submit", body: { job_id: `{{job:${req.cacheKey}}}` }, note: "Spends money via the provider." });
    }
  }
  notes.push(`${chosen.length} datoms, ${sequence.entities.length} entities, ${sequence.transitions.length} transitions, ${(opts.shots ?? []).length} jobs.`);
  if (!opts.submitJobs && (opts.shots ?? []).length) notes.push("Jobs are created unqueued; nothing is submitted.");
  return { version: 1, runId: run.runId, steps, notes };
}

/** Datom records + a shots-only plan for the static (pre-baked) content, no sequence. */
export function planShotJobs(runId: string, projectPath: string, shots: ShotRequest[], opts: { submitJobs?: boolean; specOptions?: CharacterSpecOptions } = {}): ExportPlan {
  const specs = characterSpecs(opts.specOptions);
  const need = new Set(shots.flatMap((s) => s.references.map((r) => r.character)));
  const records = allRecords(opts.specOptions).filter((r) => specs.some((s) => need.has(s.key) && r.meta.character_id === s.key));
  const idToVar = new Map(records.map((r) => [r.id, `{{datom:${r.id}}}`]));
  const steps: PlanStep[] = [
    { id: "register-project", method: "POST", path: "/api/projects/register", body: { path: projectPath }, capture: { project_id: "project_id" }, liveCheck: "Response key holding the project id." },
  ];
  for (const r of records) {
    steps.push({ id: `node:${r.id}`, method: "POST", path: `/api/projects/${PID}/content/nodes`, body: { kind: contentKind(r), name: r.name, data: { name: r.name, ...r.meta } }, capture: { [`node:${r.id}`]: "id" } });
    steps.push({ id: `publish:${r.id}`, method: "POST", path: `/api/projects/${PID}/content/nodes/{{node:${r.id}}}/ether-datom/publish`, body: {}, capture: { [`datom:${r.id}`]: "datom_id" } });
  }
  for (const req of shots) {
    const params: Record<string, unknown> = { prompt: req.prompt, duration: req.duration, resolution: req.resolution, aspect_ratio: req.aspect_ratio };
    if (req.mode === "reference") params.input_image = req.references.map((r) => ({ datom_id: idToVar.get(r.datom_id) ?? r.datom_id, slot_key: r.slot_key }));
    steps.push({
      id: `job:${req.cacheKey}`,
      method: "POST",
      path: "/api/jobs/from_capability",
      body: { capability: DEFAULTS.capability, service_id: req.service_id, params, project_id: PID, auto_queue: false, tags: ["the-great-haze", runId], notes: req.cacheKey },
      capture: { [`job:${req.cacheKey}`]: "job_id" },
      liveCheck: "Capability name and params.duration key.",
    });
    if (opts.submitJobs) steps.push({ id: `submit:${req.cacheKey}`, method: "POST", path: "/api/queue/submit", body: { job_id: `{{job:${req.cacheKey}}}` } });
  }
  return { version: 1, runId, steps, notes: [`${records.length} datoms, ${shots.length} jobs.`] };
}

// ---------------------------------------------------------------------------
// Running a plan through any transport
// ---------------------------------------------------------------------------

export type Vars = Record<string, unknown>;

/** Replace {{name}} templates. A string that is exactly one template keeps the value's type. */
export function resolveTemplates(v: unknown, vars: Vars): unknown {
  if (typeof v === "string") {
    const whole = /^\{\{([^}]+)\}\}$/.exec(v);
    if (whole) {
      if (!(whole[1] in vars)) throw new Error(`Unresolved template {{${whole[1]}}}`);
      return vars[whole[1]];
    }
    return v.replace(/\{\{([^}]+)\}\}/g, (_, name: string) => {
      if (!(name in vars)) throw new Error(`Unresolved template {{${name}}}`);
      return String(vars[name]);
    });
  }
  if (Array.isArray(v)) return v.map((x) => resolveTemplates(x, vars));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, resolveTemplates(x, vars)]));
  return v;
}

export function readPath(json: unknown, path: string): unknown {
  let cur: unknown = json;
  for (const part of path.split(".")) {
    if (cur && typeof cur === "object" && part in (cur as Record<string, unknown>)) cur = (cur as Record<string, unknown>)[part];
    else return undefined;
  }
  return cur;
}

export interface Transport {
  (req: { method: string; path: string; body?: unknown }): Promise<{ status: number; json: unknown }>;
}

export interface RunResult {
  ok: boolean;
  completed: number;
  failedAt?: string;
  error?: string;
  vars: Vars;
}

/** Send steps in order, threading captured values (ids, expected_revision) into later ones. Stops at the first failure. */
export async function runPlan(plan: ExportPlan, send: Transport, onStep?: (step: PlanStep, status: number) => void): Promise<RunResult> {
  const vars: Vars = {};
  let completed = 0;
  for (const step of plan.steps) {
    let res: { status: number; json: unknown };
    try {
      res = await send({ method: step.method, path: resolveTemplates(step.path, vars) as string, body: step.body === undefined ? undefined : resolveTemplates(step.body, vars) });
    } catch (e) {
      return { ok: false, completed, failedAt: step.id, error: e instanceof Error ? e.message : String(e), vars };
    }
    onStep?.(step, res.status);
    if (res.status < 200 || res.status >= 300) {
      return { ok: false, completed, failedAt: step.id, error: `HTTP ${res.status}${res.status === 409 ? " (revision conflict)" : ""}`, vars };
    }
    for (const [name, path] of Object.entries(step.capture ?? {})) {
      const val = readPath(res.json, path);
      if (val !== undefined) vars[name] = val;
      else if (name === "revision" || name === "project_id" || name === "sequence_id") return { ok: false, completed, failedAt: step.id, error: `response had no ${path}`, vars };
    }
    completed++;
  }
  return { ok: true, completed, vars };
}

export { CONTRACTS };

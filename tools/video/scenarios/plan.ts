// The ordered request plan for one scenario on Hyperlab Rebuild, generated locally on the
// `lucifer-comfy` worker. Nothing here sends anything; hyperlab-export.ts prints it, and only
// sends the API stages with --live. The manifest stages are PowerShell scripts Hyperlab ships.

import { characterSpecs, recordWithVariants } from "../../../src/story/characters.ts";
import type { PlanStep } from "../../../src/story/hyperlab.ts";
import type { EtherRecord } from "../../../src/story/datoms.ts";
import type { Scenario } from "./build.ts";
import { buildManifest, H3 } from "../h3-manifest.ts";
import type { H3Manifest } from "../h3-manifest.ts";

const PID = "{{project_id}}";
const BASE_SIZE = { width: 768, height: 1024 };

export interface ScenarioPlan {
  version: 1;
  scenario: string;
  title: string;
  /** API stages Hyperlab's REST server takes directly. */
  steps: PlanStep[];
  /** Human/agent stages with exact commands, in order. */
  stages: { id: string; title: string; command?: string; note: string }[];
  manifests: { name: string; file: string; shots: number }[];
  counts: { datoms: number; stillJobs: number; shots: number; shotSeconds: number };
}

function stillPrompt(n: Scenario["refNeeds"][number]): { service_id: string; capability: string; params: Record<string, unknown>; note: string } {
  if (n.version === 1) {
    return { service_id: H3.t2i, capability: "text_to_image", params: { prompt: n.prompt, ...BASE_SIZE, seed: seedOf(n.datom_id + n.slot_key) }, note: `${n.name}, ${n.slot_key} (base look)` };
  }
  // A later look: edit the approved hero so the face and build stay put.
  return {
    service_id: H3.imageEdit,
    capability: "image_edit",
    params: {
      prompt: `Same person, same face, same build and same framing. Change only this: ${n.change ?? n.prompt}. Keep the plain dark background.`,
      input_image: [{ datom_id: n.datom_id, slot_key: "hero" }],
      seed: seedOf(n.datom_id + n.slot_key),
    },
    note: `${n.name}, ${n.slot_key} (edit of hero)`,
  };
}

function seedOf(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h % 2_000_000_000;
}

export function scenarioPlan(sc: Scenario, opts: { outDir: string; hyperlabDir?: string; baseUrl?: string; runStills?: boolean } = { outDir: "artifacts/video/scenarios" }): ScenarioPlan {
  const specs = characterSpecs(sc.main.recorder.runRecord.options);
  const steps: PlanStep[] = [
    {
      id: "register-project",
      method: "POST",
      path: "/api/projects/register",
      body: { path: "{{project_path}}" },
      capture: { project_id: "project_id" },
      note: "Registers the folder as a Hyperlab project, or returns the existing one if already registered.",
      liveCheck: "Response key holding the project id; whether re-registering is idempotent.",
    },
  ];
  const slotsFor = (key: string) => sc.refNeeds.filter((n) => n.character === key && n.version > 1).map((n) => n.slot_key);
  const records: EtherRecord[] = sc.cast.map((k) => specs.find((s) => s.key === k)).filter((s): s is NonNullable<typeof s> => !!s).map((s) => recordWithVariants(s, slotsFor(s.key)));
  for (const r of records) {
    steps.push({ id: `node:${r.id}`, method: "POST", path: `/api/projects/${PID}/content/nodes`, body: { kind: "character", name: r.name, data: { name: r.name, ...r.meta } }, capture: { [`node:${r.id}`]: "id" }, liveCheck: "Content node body shape for a character." });
    steps.push({ id: `publish:${r.id}`, method: "POST", path: `/api/projects/${PID}/content/nodes/{{node:${r.id}}}/ether-datom/publish`, body: {}, capture: { [`datom:${r.id}`]: "datom_id" }, liveCheck: "Whether the published datom id equals our deterministic id." });
  }
  for (const n of sc.refNeeds) {
    const st = stillPrompt(n);
    const jobKey = `still:${n.datom_id}:${n.slot_key}`;
    steps.push({
      id: jobKey,
      method: "POST",
      path: "/api/jobs/from_capability",
      body: { capability: st.capability, service_id: st.service_id, params: st.params, project_id: PID, auto_queue: false, tags: ["the-great-haze", sc.def.id, "reference-still"], notes: st.note },
      capture: { [jobKey]: "job_id" },
      note: st.note,
      liveCheck: "Capability names text_to_image / image_edit and the width/height/input_image param keys on these services.",
    });
    if (opts.runStills) {
      steps.push({ id: `run:${jobKey}`, method: "POST", path: `/api/jobs/{{${jobKey}}}/run-now`, body: { execution_target_id: H3.workerId }, note: "Pins this one job to lucifer-comfy.", liveCheck: "run-now path; body per JobRunNowRequest in api/app.py." });
    }
  }

  const dir = opts.hyperlabDir ?? "D:/Dreamatron/Apps/Hyperlab/Rebuild";
  const base = opts.baseUrl ?? "http://127.0.0.1:8487";
  const manifests = [buildManifest(sc, sc.main), buildManifest(sc, sc.fork)].map((m, i) => ({ name: i === 0 ? "main" : "fork", file: `${opts.outDir}/${sc.def.id}.${i === 0 ? "main" : "fork"}.h3-manifest.json`, shots: m.shots.length }));
  const resolved = (name: string) => `${opts.outDir}/${sc.def.id}.${name}.resolved.json`;
  const stages: ScenarioPlan["stages"] = [
    { id: "stills", title: "Approve the reference stills", note: `Each still job above renders on the ${H3.workerId} worker. Approve or regenerate them in Hyperlab, then bind each result to its datom slot (hero/front_view/three_quarter and each state_variants slot). Base stills first: the variant edits use the approved hero.` },
    {
      id: "resolve",
      title: "Fill placeholders (project id, graph id, prompt-guide acknowledgement, slot images)",
      command: `node --disable-warning=ExperimentalWarning tools/video/hyperlab-export.ts --scenario ${sc.def.id} --resolve ${manifests[0].file} --set project_id=<id> --set graph_id=<id> --set guide_id=<id> --set guide_revision=<rev> --set guide_fingerprint=<fp> --set ref_image_size=<size> --slot-map slots.json --out-file ${resolved("main")}`,
      note: "The prompt-guide fields come from the live guide; apply_h3_manifest.ps1 rejects a stale fingerprint. slots.json maps `datom_id:slot_key` to the image path/asset Hyperlab resolved.",
    },
    { id: "preview", title: "Preview the graph transaction (no mutation)", command: `pwsh -NoProfile -File ${dir}/scripts/apply_h3_manifest.ps1 -ManifestPath ${resolved("main")} -BaseUrl ${base}`, note: "Read the preview; it must be clean." },
    { id: "apply", title: "Apply the manifest as one graph transaction", command: `pwsh -NoProfile -File ${dir}/scripts/apply_h3_manifest.ps1 -ManifestPath ${resolved("main")} -BaseUrl ${base} -Apply`, note: "Adds one R2V job node per shot." },
    { id: "validate", title: "Validate the runner would accept it", command: `pwsh -NoProfile -File ${dir}/scripts/run_h3_manifest.ps1 -ManifestPath ${resolved("main")} -ValidateOnly`, note: "Starts nothing." },
    { id: "fork", title: "The fork branch (optional)", command: `same commands with ${sc.def.id}.fork in place of ${sc.def.id}.main`, note: `Two more shots: "${sc.def.fork.label}". Use its own graph so the two branches do not share nodes.` },
    { id: "run", title: "Run the shots", command: `pwsh -NoProfile -File ${dir}/scripts/run_h3_manifest.ps1 -ManifestPath ${resolved("main")}`, note: `Runs one job at a time and waits while the shared queue is paused. It never pauses or reorders the queue. Pinning to ${H3.workerId}: see docs/video-pipeline.md (execution_target_id).` },
  ];
  const all = [sc.main, sc.fork];
  const shots = all.reduce((n, s) => n + s.shots.length, 0);
  const secs = all.reduce((n, s) => n + s.shots.reduce((m, r) => m + Math.max(5, Math.min(8, r.duration)), 0), 0);
  return { version: 1, scenario: sc.def.id, title: sc.def.title, steps, stages, manifests, counts: { datoms: records.length, stillJobs: sc.refNeeds.length, shots, shotSeconds: secs } };
}

/** Replace {{key}} and {{slot:datom:slot}} placeholders in a manifest. Unknown ones are reported, not guessed. */
export function resolveManifest(m: H3Manifest, values: Record<string, string>, slotMap: Record<string, string>): { manifest: H3Manifest; missing: string[] } {
  const missing = new Set<string>();
  const sub = (text: string): string =>
    text.replace(/\{\{(slot:[^}]+|[^}]+)\}\}/g, (whole, key: string) => {
      if (key.startsWith("slot:")) {
        const v = slotMap[key.slice(5)];
        if (v === undefined) missing.add(key);
        return v ?? whole;
      }
      const v = values[key];
      if (v === undefined) missing.add(key);
      return v ?? whole;
    });
  const walk = (v: unknown): unknown => (typeof v === "string" ? sub(v) : Array.isArray(v) ? v.map(walk) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, walk(x)])) : v);
  return { manifest: walk(m) as H3Manifest, missing: [...missing].sort() };
}

// Runs a list of Hyperlab jobs one at a time on a pinned worker (default: lucifer).
//
//   node tools/video/lucifer-run.ts <jobs.json> [--base-url http://127.0.0.1:8487] [--worker lucifer-comfy] [--out artifacts/video/runs/<name>]
//
// jobs.json: [{ "key": "hero:odalys", "body": <POST /api/jobs/from_capability body> }, ...]
//
// Safety, matching Hyperlab's own H3 runner:
// - Jobs are created unqueued (auto_queue: false) so the shared dispatcher never races them.
// - Each job is started with run-now pinned to the worker, only while the user's queue is running;
//   a paused queue makes the runner wait, never bypass it.
// - One job at a time; the next starts only after the previous is terminal.
// - Never pauses, resumes, reorders or cancels anything; stops on the first failed job.
// - Progress is written to <out>/status.json and <out>/log.jsonl; job ids are reused on re-runs.

import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, copyFileSync } from "node:fs";
import { basename, extname, join } from "node:path";

interface JobSpec { key: string; body: Record<string, unknown> }
interface Done { key: string; job_id: string; status: string; outputs: string[] }

const LOOPBACK = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?\/?$/;

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const jobsPath = process.argv[2];
if (!jobsPath || jobsPath.startsWith("--")) throw new Error("usage: lucifer-run.ts <jobs.json> [--worker id] [--out dir]");
const base = arg("base-url", "http://127.0.0.1:8487").replace(/\/$/, "");
if (!LOOPBACK.test(base)) throw new Error("Hyperlab is loopback only");
const worker = arg("worker", "lucifer-comfy");
const out = arg("out", join("artifacts/video/runs", basename(jobsPath, extname(jobsPath))));
mkdirSync(out, { recursive: true });
const statePath = join(out, "state.json");
const state: Record<string, Done> = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : {};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (event: Record<string, unknown>) => appendFileSync(join(out, "log.jsonl"), JSON.stringify({ at: new Date().toISOString(), ...event }) + "\n");
const status = (s: Record<string, unknown>) => writeFileSync(join(out, "status.json"), JSON.stringify({ at: new Date().toISOString(), worker, ...s }, null, 2));
const save = () => writeFileSync(statePath, JSON.stringify(state, null, 2));

async function api(method: string, path: string, body?: unknown, timeoutMs = 60_000): Promise<any> {
  const res = await fetch(base + path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

async function waitForAuthority(key: string): Promise<void> {
  let told = false;
  for (;;) {
    const q = await api("GET", "/api/queue/status");
    if (q.dispatcher_running) return;
    if (!told) { log({ event: "waiting_for_queue_authority", key }); told = true; }
    status({ state: "paused_by_user", key, message: "Hyperlab is paused by the user; waiting, no job started." });
    await sleep(15_000);
  }
}

async function run(spec: JobSpec): Promise<Done> {
  const prior = state[spec.key];
  if (prior?.status === "completed") return prior;
  let jobId: string | undefined = prior?.job_id;
  if (jobId) {
    const j = await api("GET", `/api/jobs/${jobId}`);
    const s = String(j.status).toLowerCase();
    if (s === "completed") return finish(spec.key, jobId, j);
    if (!["pending", "draft", "created"].includes(s)) jobId = undefined; // failed/cancelled: make a fresh job
  }
  if (!jobId) {
    const created = await api("POST", "/api/jobs/from_capability", { ...spec.body, auto_queue: false });
    jobId = String(created.job_id ?? created.job?.id);
    log({ event: "job_created", key: spec.key, job_id: jobId, dropped_keys: created.dropped_keys });
    state[spec.key] = { key: spec.key, job_id: jobId, status: "created", outputs: [] };
    save();
  }
  await waitForAuthority(spec.key);
  status({ state: "running", key: spec.key, job_id: jobId });
  log({ event: "run_now", key: spec.key, job_id: jobId, worker });
  const started = api("POST", `/api/jobs/${jobId}/run-now`, { execution_target_id: worker }, 6 * 3600_000)
    .then((r) => ({ ok: true as const, r }), (e) => ({ ok: false as const, e: String(e) }));
  let finished: { ok: boolean; r?: unknown; e?: string } | undefined;
  started.then((x) => { finished = x; });
  for (;;) {
    await sleep(10_000);
    const j = await api("GET", `/api/jobs/${jobId}`);
    const s = String(j.status).toLowerCase();
    status({ state: s, key: spec.key, job_id: jobId, progress: j.progress, stage: j.progress_stage });
    if (["completed", "failed", "cancelled", "canceled"].includes(s)) {
      if (s !== "completed") {
        log({ event: "job_failed", key: spec.key, job_id: jobId, status: s, error: j.error ?? j.error_message ?? null });
        state[spec.key] = { key: spec.key, job_id: jobId, status: s, outputs: [] };
        save();
        throw new Error(`${spec.key} (${jobId}) ended ${s}: ${JSON.stringify(j.error ?? j.error_message ?? "")}`);
      }
      return finish(spec.key, jobId, j);
    }
    if (finished && !finished.ok) {
      log({ event: "run_now_error", key: spec.key, job_id: jobId, error: finished.e });
      throw new Error(`run-now for ${spec.key} failed: ${finished.e}`);
    }
  }
}

function finish(key: string, jobId: string, job: any): Done {
  const outputs: string[] = [];
  for (const o of job.outputs ?? []) {
    const p = String(o.path ?? "");
    if (p && existsSync(p)) {
      const dest = join(out, `${key.replace(/[^a-z0-9_.-]+/gi, "_")}${outputs.length ? "-" + outputs.length : ""}${extname(p)}`);
      copyFileSync(p, dest);
      outputs.push(dest);
    }
  }
  const done: Done = { key, job_id: jobId, status: "completed", outputs };
  state[key] = done;
  save();
  log({ event: "job_completed", key, job_id: jobId, outputs });
  return done;
}

const specs: JobSpec[] = JSON.parse(readFileSync(jobsPath, "utf8"));
const t0 = Date.now();
for (const spec of specs) {
  const t = Date.now();
  const d = await run(spec);
  console.log(`${spec.key}: ${d.status} ${d.job_id} in ${Math.round((Date.now() - t) / 1000)} s -> ${d.outputs.join(", ") || "(no local output)"}`);
}
status({ state: "done", jobs: specs.length, seconds: Math.round((Date.now() - t0) / 1000) });
console.log(`all ${specs.length} jobs done in ${Math.round((Date.now() - t0) / 1000)} s`);

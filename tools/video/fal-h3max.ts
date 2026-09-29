// Run a scenario's H3 manifest shots directly on fal's reference-to-video endpoint.
// Each shot's datom slot references map to the approved stills on disk, are uploaded to
// fal storage, and go out with the manifest's prompt (opening state, action, ending state).
// The key is read from the environment by fal.ts only; it is never printed or written.
//
//   node tools/video/fal-h3max.ts --scenario stranger-trap --dry-run
//   node tools/video/fal-h3max.ts --scenario stranger-trap --live --pilot
//   node tools/video/fal-h3max.ts --scenario stranger-trap --live --shot great-haze-stranger-trap-main-03
//   node tools/video/fal-h3max.ts --scenario stranger-trap --live --all --max-usd 20
//   node tools/video/fal-h3max.ts --scenario stranger-trap --index      (rebuild index.html only)

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { H3_MAX_R2V_PRICE_PER_SECOND_USD, LIMITS, MODELS } from "../../src/story/videoconfig.ts";
import type { Resolution } from "../../src/story/videoconfig.ts";
import { haveKey, redact, submit, uploadFile, waitForResult } from "./fal.ts";
import type { H3Manifest, H3Shot } from "./h3-manifest.ts";
import { num, parseArgs } from "./args.ts";

export const RUN_DIR = "artifacts/video/runs/fal-h3max";
const STILLS_DIR = "artifacts/video/stills";

export interface PlannedShot {
  segment: string;
  shot: H3Shot;
  files: string[];
  body: Record<string, unknown>;
  seconds: number;
  estimatedUsd: number;
}

export function priceOf(seconds: number, resolution: Resolution, mult = 1): number {
  return Math.round(seconds * H3_MAX_R2V_PRICE_PER_SECOND_USD[resolution] * mult * 10000) / 10000;
}

/** Reference tokens per request that carry no charge, and the overage price per 1000. */
const FREE_REF_TOKENS = 4096;
const OVERAGE_USD_PER_1K = 0.02;
/** A square image costs 1024 reference tokens (up to 2560 for wide or tall ones): this is the lower bound. */
const MIN_IMAGE_TOKENS = 1024;

export function referenceOverageUsd(images: number): number {
  return Math.round((Math.max(0, images * MIN_IMAGE_TOKENS - FREE_REF_TOKENS) / 1000) * OVERAGE_USD_PER_1K * 10000) / 10000;
}

/** datom id + slot key -> the approved still: stills/<scenario>/<character>/<slot>.png */
export function stillPath(scenario: string, datomId: string, slotKey: string, stills = STILLS_DIR): string {
  return join(stills, scenario, datomId.replace(/^gh-char-/, ""), `${slotKey}.png`);
}

export function loadManifests(scenario: string, dir = "artifacts/video/scenarios"): { segment: string; manifest: H3Manifest }[] {
  return ["main", "fork"]
    .map((segment) => ({ segment, file: join(dir, `${scenario}.${segment}.h3-manifest.json`) }))
    .filter((x) => existsSync(x.file))
    .map((x) => ({ segment: x.segment, manifest: JSON.parse(readFileSync(x.file, "utf8")) as H3Manifest }));
}

/** The request body minus the reference URLs, which only exist after upload. */
export function planShots(scenario: string, opts: { resolution: Resolution; aspectRatio: string; mult: number; stills?: string; dir?: string }): PlannedShot[] {
  const out: PlannedShot[] = [];
  for (const { segment, manifest } of loadManifests(scenario, opts.dir)) {
    for (const shot of manifest.shots) {
      const files = shot.references.map((r) => stillPath(scenario, r.datom_id, r.slot_key, opts.stills));
      if (files.length > LIMITS.maxReferenceImages) throw new Error(`${shot.node_id}: ${files.length} references, at most ${LIMITS.maxReferenceImages}`);
      const seconds = Math.max(LIMITS.minDuration, Math.min(LIMITS.maxDuration, shot.overrides.duration));
      out.push({
        segment,
        shot,
        files,
        seconds,
        estimatedUsd: Math.round((priceOf(seconds, opts.resolution, opts.mult) + referenceOverageUsd(files.length)) * 10000) / 10000,
        body: {
          prompt: shot.prompt_lines.join("\n"),
          duration: seconds,
          resolution: opts.resolution,
          aspect_ratio: opts.aspectRatio,
          seed: shot.overrides.seed,
          prompt_expansion_mode: "disabled",
          enable_safety_checker: true,
        },
      });
    }
  }
  return out;
}

interface JobRecord {
  ts: string;
  node_id: string;
  request_id: string;
  model: string;
  resolution: string;
  seconds: number;
  estimated_usd: number;
  billing_headers: Record<string, string>;
  actual_usd: number | null;
  wall_seconds: number;
  output: string;
}

export function readJobs(dir = RUN_DIR): JobRecord[] {
  const f = join(dir, "jobs.jsonl");
  if (!existsSync(f)) return [];
  return readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as JobRecord);
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);

/** A local page that plays the finished clips in story order (main, then fork). */
export function writeIndex(plan: PlannedShot[], dir = RUN_DIR): string {
  const done = new Map(readJobs(dir).map((j) => [j.node_id, j]));
  const cards = plan
    .filter((p) => done.has(p.shot.node_id))
    .map((p) => {
      const j = done.get(p.shot.node_id) as JobRecord;
      return `<section><h2>${esc(p.shot.label)}</h2><video controls preload="metadata" src="${esc(j.output.split("/").pop() as string)}"></video><p>${p.seconds}s, ${esc(j.resolution)}, generated in ${j.wall_seconds}s, est. $${j.estimated_usd}</p></section>`;
    })
    .join("\n");
  const html = `<!doctype html><meta charset="utf-8"><title>fal reference-to-video run</title><style>body{background:#111;color:#ddd;font:15px system-ui;margin:24px}section{margin:0 0 32px;max-width:960px}video{width:100%;background:#000}h2{font-size:16px}</style>\n${cards || "<p>No clips yet.</p>"}`;
  const file = join(dir, "index.html");
  writeFileSync(file, html);
  return file;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2), ["scenario", "shot", "max-usd", "resolution", "aspect"]);
  const scenario = args.values.get("scenario") ?? "stranger-trap";
  const resolution = (args.values.get("resolution") ?? "768P") as Resolution;
  const mult = Number(process.env.FAL_PRICE_MULT ?? 1);
  const plan = planShots(scenario, { resolution, aspectRatio: args.values.get("aspect") ?? "16:9", mult });
  if (!plan.length) throw new Error(`no manifests for scenario ${scenario}`);
  mkdirSync(RUN_DIR, { recursive: true });

  if (args.flags.has("index")) {
    console.log(`wrote ${writeIndex(plan)}`);
    return;
  }

  const missing = plan.flatMap((p) => p.files.filter((f) => !existsSync(f)));
  const total = Math.round(plan.reduce((n, p) => n + p.estimatedUsd, 0) * 100) / 100;
  console.log(`${MODELS.reference.endpoint} @ ${resolution}, $${H3_MAX_R2V_PRICE_PER_SECOND_USD[resolution]}/s list price plus reference-token overage (lower bound)${mult !== 1 ? ` x${mult}` : ""}`);
  console.log("shot".padEnd(36) + "sec  refs  est.usd");
  for (const p of plan) console.log(`${p.shot.node_id.padEnd(36)}${String(p.seconds).padStart(3)}  ${String(p.files.length).padStart(4)}  ${p.estimatedUsd.toFixed(2).padStart(6)}`);
  console.log(`${"total".padEnd(36)}${String(plan.reduce((n, p) => n + p.seconds, 0)).padStart(3)}  ${" ".repeat(4)}  ${total.toFixed(2).padStart(6)}`);
  if (missing.length) console.log(`missing stills: ${[...new Set(missing)].join(", ")}`);

  if (!args.flags.has("live")) {
    console.log("dry run: nothing was uploaded or generated, and no key was read.");
    for (const p of plan) console.log(`\n# ${p.shot.node_id}\nreferences: ${p.files.join(" | ")}\n${JSON.stringify(p.body)}`);
    return;
  }
  if (missing.length) throw new Error("missing reference stills; not going live");
  if (!haveKey()) throw new Error("--live needs FAL_KEY in the environment");

  const cap = num(args, "max-usd", 3);
  const doneIds = new Set(readJobs().map((j) => j.node_id));
  let targets: PlannedShot[];
  if (args.values.has("shot")) targets = plan.filter((p) => p.shot.node_id === args.values.get("shot"));
  else if (args.flags.has("pilot")) targets = [[...plan].sort((a, b) => a.seconds - b.seconds)[0]];
  else if (args.flags.has("all")) targets = plan.filter((p) => !doneIds.has(p.shot.node_id));
  else throw new Error("--live needs --pilot, --shot <node_id> or --all");
  if (!targets.length || targets.some((t) => !t)) throw new Error("no matching shots");

  const uploads = new Map<string, string>();
  // Spend so far counts actual charges where fal reported them, else the estimate.
  let spent = readJobs().reduce((n, j) => n + (j.actual_usd ?? j.estimated_usd), 0);
  for (const t of targets) {
    if (spent + t.estimatedUsd > cap) {
      console.log(`stop before ${t.shot.node_id}: $${spent.toFixed(2)} spent + $${t.estimatedUsd.toFixed(2)} would pass the $${cap} cap`);
      break;
    }
    const started = Date.now();
    try {
      const urls: string[] = [];
      for (const f of t.files) {
        if (!uploads.has(f)) uploads.set(f, await uploadFile(readFileSync(f), f.split(/[\\/]/).slice(-2).join("_"), "image/png"));
        urls.push(uploads.get(f) as string);
      }
      const ticket = await submit(MODELS.reference.endpoint, { ...t.body, reference_image_urls: urls });
      console.log(`${t.shot.node_id}: queued as ${ticket.request_id}`);
      const res = await waitForResult(ticket);
      const dl = await fetch(res.videoUrl);
      if (!dl.ok) throw new Error(`download failed: HTTP ${dl.status}`);
      const file = join(RUN_DIR, `${t.shot.node_id}.mp4`);
      writeFileSync(file, Buffer.from(await dl.arrayBuffer()));
      const wall = Math.round((Date.now() - started) / 100) / 10;
      const rec: JobRecord = { ts: new Date().toISOString(), node_id: t.shot.node_id, request_id: ticket.request_id, model: MODELS.reference.endpoint, resolution, seconds: t.seconds, estimated_usd: t.estimatedUsd, billing_headers: res.billingHeaders, actual_usd: null, wall_seconds: wall, output: file.replace(/\\/g, "/") };
      appendFileSync(join(RUN_DIR, "jobs.jsonl"), JSON.stringify(rec) + "\n");
      spent += t.estimatedUsd;
      console.log(`${t.shot.node_id}: done in ${wall}s -> ${file}; billing headers: ${JSON.stringify(res.billingHeaders)}`);
    } catch (e) {
      console.error(redact(e instanceof Error ? e.message : String(e)));
      break;
    }
  }
  console.log(`index: ${writeIndex(plan)}; spent so far about $${spent.toFixed(2)} (estimate)`);
}

if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("tools/video/fal-h3max.ts")) {
  main().catch((e) => {
    console.error(redact(e instanceof Error ? e.message : String(e)));
    process.exit(1);
  });
}

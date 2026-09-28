// The offline path: enumerate the static content graph (every scene x option x outcome,
// plus scene intros and fights), turn each into a shot request with a fixed stand-in
// cast, and write a manifest with a cost estimate. Nothing is generated unless --live
// is given, FAL_KEY is set, and --max-usd caps the spend.
//
//   node tools/video/bake.ts                     dry run (the default), writes the manifest
//   node tools/video/bake.ts --only outcomes     outcomes | intros | combat
//   node tools/video/bake.ts --live --max-usd 20 --concurrency 2
//   node tools/video/bake.ts --via-hyperlab      write the Hyperlab job plan instead of calling fal
//   node tools/video/bake.ts --via-hyperlab --live --base-url http://127.0.0.1:8487

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { enumerateStaticGraph } from "../../src/story/catalog.ts";
import { shotForStatic } from "../../src/story/shots.ts";
import type { ShotRequest } from "../../src/story/shots.ts";
import { planShotJobs } from "../../src/story/hyperlab.ts";
import { estimateUsd } from "../../src/story/videoconfig.ts";
import type { Resolution, ShotMode } from "../../src/story/videoconfig.ts";
import { BAKE_CAST } from "../../src/story/catalog.ts";
import { generate, haveKey, redact } from "./fal.ts";
import { baseSheets } from "./refs.ts";
import { liveCall } from "./request.ts";
import { num, parseArgs } from "./args.ts";

export interface ClipEntry {
  templateKey: string;
  cacheKey: string;
  title: string;
  duration: number;
  resolution: Resolution;
  estimated_usd: number;
  status: "pending" | "done" | "failed";
  file?: string;
  url?: string;
  error?: string;
  request: ShotRequest;
}

export interface BakeManifest {
  version: 1;
  generatedFrom: "static-content-graph";
  dryRun: boolean;
  resolution: Resolution;
  mode: ShotMode;
  totals: { clips: number; seconds: number; estimated_usd: number; byKind: Record<string, { clips: number; usd: number }> };
  clips: ClipEntry[];
}

export function buildManifest(opts: { only?: string; limit?: number; resolution?: Resolution; mode?: ShotMode; priceMultiplier?: number }): BakeManifest {
  const graph = enumerateStaticGraph();
  const resolution = opts.resolution ?? "768P";
  const mode = opts.mode ?? "reference";
  let beats = graph.beats;
  if (opts.only === "outcomes") beats = beats.filter((b) => b.optionId !== null);
  else if (opts.only === "intros") beats = beats.filter((b) => b.templateKey.endsWith(".intro") && b.sceneKind !== "combat");
  else if (opts.only === "combat") beats = beats.filter((b) => b.sceneKind === "combat");
  if (opts.limit) beats = beats.slice(0, opts.limit);
  const seen = new Set<string>();
  const clips: ClipEntry[] = [];
  for (const b of beats) {
    const req = shotForStatic(b, { resolution, mode, priceMultiplier: opts.priceMultiplier });
    if (seen.has(req.cacheKey)) continue;
    seen.add(req.cacheKey);
    clips.push({ templateKey: req.templateKey, cacheKey: req.cacheKey, title: req.title, duration: req.duration, resolution, estimated_usd: req.estimated_usd, status: "pending", request: req });
  }
  const byKind: Record<string, { clips: number; usd: number }> = {};
  for (const b of beats) {
    const c = clips.find((x) => x.templateKey === b.templateKey);
    if (!c) continue;
    const k = b.sceneKind;
    byKind[k] ??= { clips: 0, usd: 0 };
    byKind[k].clips++;
    byKind[k].usd = Math.round((byKind[k].usd + c.estimated_usd) * 100) / 100;
  }
  const seconds = clips.reduce((n, c) => n + c.duration, 0);
  return {
    version: 1,
    generatedFrom: "static-content-graph",
    dryRun: true,
    resolution,
    mode,
    totals: { clips: clips.length, seconds, estimated_usd: Math.round(clips.reduce((n, c) => n + c.estimated_usd, 0) * 100) / 100, byKind },
    clips,
  };
}

export const safeName = (key: string): string => key.replace(/[^a-zA-Z0-9._-]+/g, "_");

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2), ["out", "max-usd", "concurrency", "resolution", "only", "limit", "mode", "refs", "base-url", "project-path"]);
  const live = args.flags.has("live");
  const viaHyperlab = args.flags.has("via-hyperlab");
  const out = args.values.get("out") ?? "artifacts/video";
  const refsDir = args.values.get("refs") ?? "assets/video-refs";
  const resolution = (args.values.get("resolution") ?? "768P") as Resolution;
  const mode = (args.values.get("mode") ?? "reference") as ShotMode;
  const mult = Number(process.env.FAL_PRICE_MULT ?? 1);
  const manifest = buildManifest({ only: args.values.get("only"), limit: args.values.has("limit") ? num(args, "limit", 0) : undefined, resolution, mode, priceMultiplier: mult });
  manifest.dryRun = !live;
  mkdirSync(out, { recursive: true });
  mkdirSync(join(out, "clips"), { recursive: true });
  const manifestPath = join(out, "bake-manifest.json");

  // Resume: keep clips a previous live run already finished.
  if (existsSync(manifestPath)) {
    const prev = JSON.parse(readFileSync(manifestPath, "utf8")) as BakeManifest;
    for (const c of manifest.clips) {
      const p = prev.clips.find((x) => x.cacheKey === c.cacheKey && x.status === "done");
      if (p) Object.assign(c, { status: "done", file: p.file, url: p.url });
    }
  }

  const sheets = baseSheets(Object.values(BAKE_CAST));
  writeFileSync(join(out, "refs-manifest.json"), JSON.stringify({ version: 1, note: "Stills to approve (or generate in Hyperlab) before a reference-to-video bake. Files go under the refs directory at the given paths.", refsDir, sheets }, null, 2));

  const pending = manifest.clips.filter((c) => c.status !== "done");
  const pendingUsd = Math.round(pending.reduce((n, c) => n + c.estimated_usd, 0) * 100) / 100;
  console.log(`${manifest.totals.clips} clips, ${manifest.totals.seconds}s of video, estimated $${manifest.totals.estimated_usd} at ${resolution} (${pending.length} pending, $${pendingUsd})`);
  for (const [k, v] of Object.entries(manifest.totals.byKind)) console.log(`  ${k.padEnd(10)} ${String(v.clips).padStart(4)} clips  $${v.usd}`);
  console.log(`  480P would be $${Math.round(manifest.clips.reduce((n, c) => n + estimateUsd(c.duration, "480P", mult), 0) * 100) / 100}; prices come from src/story/videoconfig.ts`);

  if (viaHyperlab) {
    const projectPath = args.values.get("project-path") ?? process.cwd();
    const shots = pending.map((c) => c.request);
    const plan = planShotJobs("static-bake", projectPath, shots, { submitJobs: false });
    const planPath = join(out, "hyperlab-bake-plan.json");
    writeFileSync(planPath, JSON.stringify(plan, null, 2));
    console.log(`wrote ${planPath} (${plan.steps.length} requests; jobs are created unqueued)`);
    if (live) {
      const base = args.values.get("base-url");
      if (!base) throw new Error("--via-hyperlab --live needs --base-url");
      const { executePlan } = await import("./hyperlab-export.ts");
      await executePlan(plan, base);
    } else console.log("dry run: nothing was sent to Hyperlab");
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    return;
  }

  if (!live) {
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`dry run: wrote ${manifestPath}. Nothing was generated and no key was read.`);
    return;
  }

  if (!haveKey()) throw new Error("--live needs FAL_KEY in the environment");
  if (!args.values.has("max-usd")) throw new Error("--live needs --max-usd so the spend is capped");
  const cap = num(args, "max-usd", 0);
  const conc = Math.max(1, Math.floor(num(args, "concurrency", 2)));
  console.log(`LIVE: cap $${cap}, concurrency ${conc}`);
  let spent = 0;
  let cursor = 0;
  const save = () => writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  const worker = async () => {
    for (;;) {
      const c = pending[cursor++];
      if (!c) return;
      if (spent + c.estimated_usd > cap) {
        console.log(`  skip ${c.templateKey}: would pass the $${cap} cap`);
        continue;
      }
      spent += c.estimated_usd;
      try {
        const call = liveCall(c.request, refsDir);
        const res = await generate(call.endpoint, call.body);
        const file = `${safeName(c.templateKey)}.mp4`;
        const dl = await fetch(res.videoUrl);
        if (!dl.ok) throw new Error(`download failed: HTTP ${dl.status}`);
        writeFileSync(join(out, "clips", file), Buffer.from(await dl.arrayBuffer()));
        c.status = "done";
        c.file = file;
        c.url = `clips/${file}`;
        console.log(`  done ${c.templateKey} (${call.mode}, ${call.referencesUsed} refs)`);
      } catch (e) {
        spent -= c.estimated_usd;
        c.status = "failed";
        c.error = redact(e instanceof Error ? e.message : String(e));
        console.log(`  FAILED ${c.templateKey}: ${c.error}`);
      }
      save();
    }
  };
  await Promise.all(Array.from({ length: conc }, worker));
  save();
  // The file the web client loads: template key -> clip.
  const clips: Record<string, { url: string; duration: number }> = {};
  for (const c of manifest.clips) if (c.status === "done" && c.url) clips[c.templateKey] = { url: c.url, duration: c.duration };
  writeFileSync(join(out, "baked.json"), JSON.stringify({ version: 1, clips }, null, 2));
  console.log(`finished; about $${Math.round(spent * 100) / 100} spent. wrote baked.json`);
}

if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("tools/video/bake.ts")) {
  main().catch((e) => {
    console.error(redact(e instanceof Error ? e.message : String(e)));
    process.exit(1);
  });
}

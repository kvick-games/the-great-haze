// Play a seeded bot through the game, record its story, and write the request plan that
// would export its characters and story graph to Hyperlab Rebuild. By default it only
// writes the plan. --live sends it to a loopback Hyperlab (never run against Stable).
//
//   node tools/video/hyperlab-export.ts --scenario stranger-trap        the local (lucifer) path, dry run
//   node tools/video/hyperlab-export.ts --scenario <id> --live --base-url http://127.0.0.1:8487
//   node tools/video/hyperlab-export.ts --strategy cautious --seed 3
//   node tools/video/hyperlab-export.ts --with-shots          include unqueued generation jobs
//   node tools/video/hyperlab-export.ts --live --base-url http://127.0.0.1:8487

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Strategy } from "../bots.ts";
import { buildStoryGraph, validateSequence } from "../../src/story/graph.ts";
import { planExport, runPlan } from "../../src/story/hyperlab.ts";
import type { ExportPlan, Transport } from "../../src/story/hyperlab.ts";
import { shotForBeat } from "../../src/story/shots.ts";
import { parseArgs } from "./args.ts";
import { recordBotRun } from "./playthrough.ts";
import { runSheets } from "./refs.ts";
import { buildScenario } from "./scenarios/build.ts";
import { resolveManifest, scenarioPlan } from "./scenarios/plan.ts";
import { buildManifest } from "./h3-manifest.ts";
import { SCENARIOS } from "./scenarios/defs.ts";
import type { H3Manifest } from "./h3-manifest.ts";
import type { Args } from "./args.ts";

const LOOPBACK = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?(\/|$)/;

/** Send a plan to a loopback Hyperlab over HTTP. */
export async function executePlan(plan: ExportPlan, baseUrl: string): Promise<void> {
  if (!LOOPBACK.test(baseUrl)) throw new Error("Hyperlab is loopback only; refusing a non-local --base-url");
  const base = baseUrl.replace(/\/$/, "");
  const send: Transport = async (req) => {
    const res = await fetch(base + req.path, { method: req.method, headers: { "Content-Type": "application/json" }, body: req.body === undefined ? undefined : JSON.stringify(req.body) });
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      /* empty body */
    }
    return { status: res.status, json };
  };
  const result = await runPlan(plan, send, (step, status) => console.log(`  ${status} ${step.method} ${step.id}`));
  if (!result.ok) throw new Error(`export stopped at ${result.failedAt}: ${result.error}`);
  console.log(`exported: ${result.completed} requests`);
}

/** The local path: one scenario, generated on the lucifer worker through Hyperlab's H3 manifest scripts. */
async function scenarioMain(args: Args): Promise<void> {
  const id = args.values.get("scenario") as string;
  const out = args.values.get("out") ?? "artifacts/video/scenarios";
  const resolveFrom = args.values.get("resolve");
  if (resolveFrom) {
    const manifest = JSON.parse(readFileSync(resolveFrom, "utf8")) as H3Manifest;
    const values: Record<string, string> = {};
    for (const kv of args.multi.get("set") ?? []) {
      const at = kv.indexOf("=");
      if (at > 0) values[kv.slice(0, at)] = kv.slice(at + 1);
    }
    const mapFile = args.values.get("slot-map");
    const slotMap = mapFile ? (JSON.parse(readFileSync(mapFile, "utf8")) as Record<string, string>) : {};
    const { manifest: done, missing } = resolveManifest(manifest, values, slotMap);
    const file = args.values.get("out-file") ?? resolveFrom.replace(/\.h3-manifest\.json$/, ".resolved.json");
    writeFileSync(file, JSON.stringify(done, null, 2));
    console.log(`wrote ${file}${missing.length ? `; still unresolved: ${missing.join(", ")}` : ""}`);
    if (missing.length) process.exitCode = 2;
    return;
  }
  const sc = buildScenario(id);
  const plan = scenarioPlan(sc, { outDir: out, baseUrl: args.values.get("base-url"), hyperlabDir: args.values.get("hyperlab-dir"), runStills: args.flags.has("run-stills") });
  mkdirSync(out, { recursive: true });
  for (const [seg, m] of [["main", sc.main], ["fork", sc.fork]] as const) writeFileSync(join(out, `${id}.${seg}.h3-manifest.json`), JSON.stringify(buildManifest(sc, m), null, 2));
  writeFileSync(join(out, `${id}.plan.json`), JSON.stringify(plan, null, 2));
  console.log(`Scenario ${id}: "${sc.def.title}" (${sc.def.strategy} seed ${sc.def.seed}, beats ${sc.def.from}..${sc.def.to}, fork "${sc.def.fork.label}")`);
  console.log(`${plan.counts.datoms} character datoms, ${plan.counts.stillJobs} reference stills, ${plan.counts.shots} shots (${plan.counts.shotSeconds} s of video)\n`);
  let n = 0;
  for (const st of plan.steps) console.log(`${String(++n).padStart(3)}. API   ${st.method} ${st.path}  [${st.id}]${st.liveCheck ? `\n         live check: ${st.liveCheck}` : ""}`);
  for (const st of plan.stages) console.log(`${String(++n).padStart(3)}. STAGE ${st.title}\n         ${st.command ?? st.note}`);
  console.log(`\nwrote ${out}/${id}.{plan,main.h3-manifest,fork.h3-manifest}.json`);
  if (args.flags.has("live")) {
    const url = args.values.get("base-url");
    if (!url) throw new Error("--live needs --base-url");
    await executePlan({ version: 1, runId: `scenario-${id}`, steps: plan.steps, notes: [] }, url);
    console.log("API stages sent. The manifest stages are yours to run (commands above).");
  } else console.log("dry run: nothing was sent");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2), ["strategy", "seed", "out", "project-path", "base-url", "scenario", "resolve", "slot-map", "out-file", "hyperlab-dir"], ["set"]);
  const scenarioId = args.values.get("scenario");
  if (scenarioId) {
    if (!SCENARIOS.some((x) => x.id === scenarioId)) throw new Error(`unknown scenario; have ${SCENARIOS.map((x) => x.id).join(", ")}`);
    return scenarioMain(args);
  }
  const strategy = (args.values.get("strategy") ?? "cautious") as Strategy;
  const seed = Number(args.values.get("seed") ?? 3);
  const out = args.values.get("out") ?? "artifacts/video";
  const projectPath = args.values.get("project-path") ?? process.cwd();
  const { recorder, result } = recordBotRun(strategy, seed);
  const run = recorder.runRecord;
  const built = buildStoryGraph(run);
  const problems = validateSequence(built.sequence);
  if (problems.length) throw new Error("story graph invalid: " + problems.slice(0, 5).join("; "));
  const shots = args.flags.has("with-shots") ? run.beats.filter((b) => b.stakes === "life-altering" || b.stakes === "notable").map((b) => shotForBeat(b, recorder.log, { specs: recorder.characters })) : [];
  const plan = planExport(run, { projectPath, direct: args.flags.has("direct"), shots, submitJobs: false }, built);
  mkdirSync(out, { recursive: true });
  const base = `run-${strategy}-${seed}`;
  writeFileSync(join(out, `${base}.plan.json`), JSON.stringify(plan, null, 2));
  writeFileSync(join(out, `${base}.sequence.hlseq.json`), JSON.stringify(built.sequence, null, 2));
  writeFileSync(join(out, `${base}.story.json`), recorder.serialize());
  writeFileSync(join(out, `${base}.refs.json`), JSON.stringify(runSheets(recorder.log, run.options), null, 2));
  console.log(`${strategy}#${seed}: ${result.kind} on day ${result.day}; ${run.beats.length} beats, ${built.sequence.transitions.length} transitions, ${plan.steps.length} requests`);
  console.log(`wrote ${join(out, base)}.{plan,sequence.hlseq,story,refs}.json`);
  if (args.flags.has("live")) {
    const url = args.values.get("base-url");
    if (!url) throw new Error("--live needs --base-url");
    await executePlan(plan, url);
  } else console.log("dry run: nothing was sent");
}

if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("tools/video/hyperlab-export.ts")) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
}

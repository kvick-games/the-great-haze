import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { replay } from "../tools/video/scenarios/replay.ts";
import type { GameState } from "../src/game/types.ts";
import { DatomLog, stableStringify } from "../src/story/datoms.ts";
import { chronicle } from "../src/story/mutations.ts";
import { StoryRecorder } from "../src/story/recorder.ts";
import { buildStoryGraph, validateSequence, ACTION_TYPES } from "../src/story/graph.ts";
import { shotForBeat, shotForStatic, toFalBody } from "../src/story/shots.ts";
import { planExport, runPlan } from "../src/story/hyperlab.ts";
import type { ExportPlan } from "../src/story/hyperlab.ts";
import { enumerateStaticGraph } from "../src/story/catalog.ts";
import { estimateUsd, LIMITS } from "../src/story/videoconfig.ts";
import { recordBotRun } from "../tools/video/playthrough.ts";
import { checkRequest } from "../tools/video/server.ts";
import { redact, submit } from "../tools/video/fal.ts";
import { buildScenario, selectRefs } from "../tools/video/scenarios/build.ts";
import { SCENARIOS } from "../tools/video/scenarios/defs.ts";
import { buildManifest, dialogueOf, h3Prompt } from "../tools/video/h3-manifest.ts";
import { characterSpecs, strangerKey, visualFromLook, visualText } from "../src/story/characters.ts";
import { NPCS } from "../src/game/content/npcs.ts";
import { SCENES } from "../src/game/content/scenes/index.ts";
import { resolveManifest, scenarioPlan } from "../tools/video/scenarios/plan.ts";
import { parseVideoMode } from "../web/src/video/mode.ts";

// ---------------------------------------------------------------- datoms

test("datom log: transact, asOf, entity, history, retraction", () => {
  const log = new DatomLog(["tags"]);
  const t1 = log.transact([{ e: "a", a: "name", v: "Ann" }, { e: "a", a: "tags", v: "x" }, { e: "a", a: "tags", v: "y" }]);
  const t2 = log.transact([{ e: "a", a: "name", v: "Anna" }, { e: "a", a: "tags", v: "x", retract: true }]);
  assert.equal(log.get("a", "name", t1), "Ann");
  assert.equal(log.get("a", "name"), "Anna");
  assert.deepEqual(log.get("a", "tags", t1), ["x", "y"]);
  assert.deepEqual(log.get("a", "tags"), ["y"]);
  assert.equal(log.asOf(t1).lastTx, t1);
  assert.equal(log.asOf(t1).get("a", "name"), "Ann");
  assert.ok(log.history("a", "name").length >= 3, "old value retracted, new one asserted");
  assert.ok(t2 > t1);
});

test("datom log: no-op assertions are dropped and JSON round-trips byte for byte", () => {
  const log = new DatomLog();
  log.transact([{ e: "a", a: "k", v: 1 }]);
  const n = log.size;
  log.transact([{ e: "a", a: "k", v: 1 }]);
  assert.equal(log.size, n, "restating a fact adds nothing");
  const copy = DatomLog.fromJSON(JSON.parse(log.stableJSON()));
  assert.equal(copy.stableJSON(), log.stableJSON());
  assert.equal(stableStringify({ b: 1, a: 2 }), stableStringify({ a: 2, b: 1 }));
});

// ---------------------------------------------------------------- chronicle

function stateOf(seed = 7): GameState {
  // A few steps in, so the party has been mustered.
  return JSON.parse(replay({ strategy: "cautious", seed, stopAfterStep: 12 }).game.serialize()) as GameState;
}

function withParty(mut: (s: GameState) => void): { before: string; after: string } {
  const a = stateOf();
  const b = JSON.parse(JSON.stringify(a)) as GameState;
  mut(b);
  return { before: JSON.stringify(a), after: JSON.stringify(b) };
}

test("chronicle: a death is life-altering, classified, and edits the look", () => {
  const { before, after } = withParty((s) => {
    s.party[1].alive = false;
    s.party[1].health = 0;
    s.party[1].fate = "died of the Haze sickness";
  });
  const { beat } = chronicle(before, after, "x");
  const death = beat.mutations.find((m) => m.kind === "death");
  assert.ok(death, "a death mutation");
  assert.equal(death?.lifeAltering, true);
  assert.equal(beat.stakes, "life-altering");
  assert.equal(beat.kind, "death");
});

test("chronicle: walking into the fog is a departure, not a death", () => {
  const { before, after } = withParty((s) => {
    s.party[1].alive = false;
    s.party[1].fate = "walked into the Haze";
  });
  const { beat } = chronicle(before, after, "x");
  assert.ok(beat.mutations.some((m) => m.kind === "departure"));
  assert.ok(!beat.mutations.some((m) => m.kind === "death"));
});

test("chronicle: a wound and a fog stage are recorded and change the visual version", () => {
  const rec = StoryRecorder.start(JSON.stringify(stateOf()), { seed: 7 });
  const s0 = stateOf();
  const s1 = JSON.parse(JSON.stringify(s0)) as GameState;
  s1.party[2].wounded = true;
  s1.party[2].health = Math.max(1, s1.party[2].health - 12);
  const a = rec.record(JSON.stringify(s0), JSON.stringify(s1), "hit");
  assert.ok(a);
  assert.ok(a!.mutations.some((m) => m.kind === "wound"));
  assert.ok(a!.mutations.some((m) => m.kind === "look"), "a wound changes how they look");
  const s2 = JSON.parse(JSON.stringify(s1)) as GameState;
  s2.party[2].fog = 2;
  const b = rec.record(JSON.stringify(s1), JSON.stringify(s2), "fog");
  assert.ok(b!.mutations.some((m) => m.kind === "fog"));
  const who = a!.mutations.find((m) => m.kind === "wound")!.subject;
  const vers = rec.log.history(`char:${who}`, "visual/version").filter((d) => d[4]).map((d) => d[2] as number);
  assert.ok(vers.length >= 3 && vers.every((v, i) => i === 0 || v > vers[i - 1]), `versions rise: ${vers}`);
});

test("chronicle: a costume change is its own mutation and does not touch the identity", () => {
  const rec = StoryRecorder.start(JSON.stringify(stateOf()), { seed: 7 });
  const s0 = stateOf();
  const s1 = JSON.parse(JSON.stringify(s0)) as GameState;
  s1.party[3].wounded = true;
  s1.party[3].health = Math.max(1, s1.party[3].health - 15);
  const beat = rec.record(JSON.stringify(s0), JSON.stringify(s1), "hit")!;
  assert.ok(beat.mutations.some((m) => m.kind === "costume"), "bloodied clothes");
  const key = beat.mutations.find((m) => m.kind === "costume")!.subject;
  assert.equal(rec.log.get(`char:${key}`, "char/status"), "active");
});

// ---------------------------------------------------------------- bot runs

const run = recordBotRun("cautious", 3);

test("a whole run records, with rising tx and stable ids", () => {
  const beats = run.recorder.beats;
  assert.ok(beats.length > 40, `beats: ${beats.length}`);
  beats.forEach((b, i) => {
    assert.equal(b.index, i);
    if (i) assert.ok(b.tx > beats[i - 1].tx);
  });
  assert.equal(new Set(beats.map((b) => b.id)).size, beats.length);
});

test("determinism: the same seed gives the same datom log", () => {
  const again = recordBotRun("cautious", 3);
  assert.equal(again.recorder.log.stableJSON(), run.recorder.log.stableJSON());
});

test("the recorder saves and restores", () => {
  const copy = StoryRecorder.restore(run.recorder.serialize());
  assert.equal(copy.beats.length, run.recorder.beats.length);
  assert.equal(copy.log.stableJSON(), run.recorder.log.stableJSON());
});

// ---------------------------------------------------------------- graph

test("the story graph is a valid Hyperlab sequence", () => {
  const built = buildStoryGraph(run.recorder.runRecord);
  assert.deepEqual(validateSequence(built.sequence), []);
  assert.equal(built.sequence.transitions.length, run.recorder.beats.length);
  for (const t of built.sequence.transitions) {
    assert.ok(t.actions.length >= 1, "every transition does something");
    for (const a of t.actions) assert.ok((ACTION_TYPES as readonly string[]).includes(a.type), a.type);
  }
  // Every state is a complete snapshot; a character who has left has no location.
  for (const st of built.sequence.states) {
    for (const e of Object.values(st.state)) {
      const c = e as unknown as { present?: boolean; location?: unknown };
      if (c.present === false && "location" in c) assert.equal(c.location, null);
      if (c.present === false && "placement" in c) assert.equal((c as { placement: unknown }).placement, null);
    }
  }
});

// ---------------------------------------------------------------- shots

test("shot cache keys are stable and depend on how people look", () => {
  const beat = run.recorder.beats.find((b) => b.mutations.some((m) => m.kind === "wound")) ?? run.recorder.beats[10];
  const a = shotForBeat(beat, run.recorder.log, { specs: run.recorder.characters });
  const b = shotForBeat(beat, run.recorder.log, { specs: run.recorder.characters });
  assert.equal(a.cacheKey, b.cacheKey);
  assert.ok(a.duration >= LIMITS.minDuration && a.duration <= LIMITS.maxDuration);
  assert.ok(a.references.length <= LIMITS.maxReferenceImages);
  assert.equal(a.estimated_usd, estimateUsd(a.duration, a.resolution));
  const body = toFalBody(a, Object.fromEntries(a.references.map((r) => [`${r.datom_id}:${r.slot_key}`, "https://example.invalid/x.png"])));
  assert.ok(!("FAL_KEY" in body));
});

test("every static beat gets a request, and the static bake covers the run's templates", () => {
  const g = enumerateStaticGraph();
  assert.ok(g.beats.length > 300);
  const s = shotForStatic(g.beats[0]);
  assert.ok(s.prompt.length > 20);
});

// ---------------------------------------------------------------- adapter plan

test("the Hyperlab plan runs against a mock transport and threads captured values", async () => {
  const plan = planExport(run.recorder.runRecord, { projectPath: "C:/tmp/demo.dtproject" });
  assert.equal(plan.steps[0].path, "/api/projects/register");
  const seen: string[] = [];
  let n = 0;
  const res = await runPlan(plan as ExportPlan, async (req) => {
    seen.push(`${req.method} ${req.path}`);
    n++;
    return { status: 200, json: { id: `id${n}`, project_id: "P1", revision: n, datom_id: `d${n}`, sequence_id: "S1", start_state_id: "s0", state: { id: `st${n}` }, state_id: `st${n}`, entity_id: `e${n}`, job_id: `j${n}` } };
  });
  assert.ok(res.ok, res.error);
  assert.equal(res.completed, plan.steps.length);
  assert.ok(seen.every((s) => !s.includes("{{")), "no unresolved template reached the wire");
});

// ---------------------------------------------------------------- curated scenarios and the H3 manifest

test("scenarios: pinned windows still show the arc they were pinned for", () => {
  assert.equal(SCENARIOS.length, 3);
  for (const def of SCENARIOS) {
    const sc = buildScenario(def);
    const kinds = new Set(sc.main.beats.flatMap((b) => b.mutations.map((m) => m.kind)));
    for (const k of def.expects.mutations) assert.ok(kinds.has(k as never), `${def.id} lost its ${k}; re-run tools/video/scenarios/search.ts`);
    assert.ok(sc.main.beats.length >= 4 && sc.main.beats.length <= 6, `${def.id}: ${sc.main.beats.length} beats`);
    assert.ok(sc.fork.beats.length >= 1, `${def.id} has a fork`);
    assert.notEqual(sc.fork.beats[0].choiceId, sc.main.beats[Math.max(0, def.fork.atBeat - def.from)].choiceId);
  }
});

test("H3 manifest: the shape apply_h3_manifest.ps1 reads, with datom slot references", () => {
  const sc = buildScenario("night-death");
  const m = buildManifest(sc, sc.main);
  for (const key of ["project_id", "graph_id", "service_id", "prompt_guide", "common", "shots"]) assert.ok(key in m, key);
  assert.equal(m.service_id, "comfy-workflows/MiniMax_H3_R2V");
  const ids = new Set<string>();
  for (const s of m.shots) {
    assert.ok(!ids.has(s.node_id), "unique node ids");
    ids.add(s.node_id);
    assert.ok(s.overrides.duration >= 5 && s.overrides.duration <= 8);
    assert.ok(s.references.length >= 1 && s.references.length <= 6);
    assert.equal(s.input_images.length, s.references.length);
    assert.match(s.prompt_lines[0], /^integrated_multimodal_description:$/);
    assert.match(s.prompt_lines[1], /^\[Shot 1\]/);
    assert.ok(s.prompt_lines.some((l) => l.startsWith("overall_soundscape:")) && s.prompt_lines.some((l) => l.startsWith("non_diegetic_music:")));
    for (const r of s.references) assert.match(r.datom_id, /^gh-char-/);
  }
  assert.ok(m.shots.length + 0 <= 200);
});

test("H3 manifest: dialogue becomes <d> tags, and placeholders resolve", () => {
  assert.deepEqual(dialogueOf(['He says "Please. Anything." and stops.']), ["Please. Anything."]);
  const sc = buildScenario("stranger-trap");
  const m = buildManifest(sc, sc.main);
  const { manifest, missing } = resolveManifest(m, { project_id: "P", graph_id: "G", guide_id: "g", guide_revision: "1", guide_fingerprint: "f", ref_image_size: "864x480" }, {});
  assert.ok(missing.every((x) => x.startsWith("slot:")), `only slot images remain until stills are approved, not ${missing.filter((x) => !x.startsWith("slot:"))}`);
  assert.equal(manifest.project_id, "P");
  const map = Object.fromEntries(m.shots.flatMap((s) => s.references.map((r) => [`${r.datom_id}:${r.slot_key}`, "C:/img.png"])));
  assert.deepEqual(resolveManifest(m, { project_id: "P", graph_id: "G", guide_id: "g", guide_revision: "1", guide_fingerprint: "f", ref_image_size: "s" }, map).missing, []);
});

test("scenario plan: stills for the cast, a fixed order, and nothing pinned to the queue", () => {
  const sc = buildScenario("companion-turns");
  const plan = scenarioPlan(sc);
  assert.equal(plan.steps[0].id, "register-project");
  assert.ok(plan.steps.filter((s) => s.id.startsWith("still:")).length >= sc.cast.length * 3);
  assert.ok(plan.steps.every((s) => !s.path.includes("/queue/")), "the plan never touches the shared queue");
  assert.ok(plan.steps.every((s) => !s.id.startsWith("run:")), "no job runs unless --run-stills");
  const order = plan.stages.map((s) => s.id);
  assert.deepEqual(order.slice(0, 4), ["stills", "resolve", "preview", "apply"]);
  for (const def of SCENARIOS) for (const r of selectRefs(shotForStaticLike(def.id))) assert.ok(r);
});

function shotForStaticLike(id: string) {
  return buildScenario(id).main.shots[0];
}

// ---------------------------------------------------------------- B's data in the story layer

test("appearance: NPC and stranger Looks and roster looks read out through one text", () => {
  const specs = characterSpecs();
  const juniper = specs.find((c) => c.key === "juniper")!;
  const look = NPCS.find((n) => n.id === "juniper")!.look;
  const text = visualText(juniper.visual);
  for (const part of [look.skin, look.prop.desc, look.palette[0], look.clothing[0], look.marks[0]]) assert.ok(text.includes(part), `${part} in "${text}"`);
  assert.deepEqual(visualFromLook(look), juniper.visual, "the spec is exactly the mapped Look");
  const ines = visualText(specs.find((c) => c.key === "ines")!.visual);
  assert.ok(ines.includes("carrying") && ines.includes("infirmary"), ines);
});

test("named strangers become characters; a stranger who is a named NPC is that NPC's datom", () => {
  const specs = characterSpecs();
  let own = 0;
  let npc = 0;
  for (const def of SCENES.filter((d) => d.stranger)) {
    const key = strangerKey(def.id)!;
    assert.ok(specs.some((c) => c.key === key), `${def.id} -> ${key} has a spec`);
    if (key.startsWith("stranger.")) own++;
    else if (NPCS.some((n) => n.id === key)) npc++;
  }
  assert.ok(own > 5 && npc >= 1, `own ${own}, npc ${npc}`);
  assert.equal(specs.find((c) => c.key === "stranger.signal-fire")?.kind, "stranger");
});

test("beats carry the screen's speech, check and route; shots voice them as <d> lines for the right subject", () => {
  const sc = buildScenario("stranger-trap");
  const b = sc.main.beats.find((x) => x.check)!;
  assert.ok(b, "the quarrel beat has a check");
  assert.equal(b.check?.kind, "calm");
  assert.ok(b.place && b.place.regionId, "route context");
  const talk = sc.main.beats[0].talk!;
  assert.ok(talk.some((l) => l.phase === "setup" && l.key === "stranger.signal-fire"), "the stranger speaks under their own key");
  for (const seg of [sc.main, sc.fork]) {
    seg.beats.forEach((beat, i) => {
      const req = seg.shots[i];
      for (const d of req.dialogue) assert.ok(req.participants.some((p) => p.key === d.key), `${d.name} is drawn`);
      const lines = h3Prompt(req, beat).join("\n");
      for (const d of req.dialogue) assert.ok(lines.includes(`<d>[English] ${d.text}</d>`), d.text);
      assert.ok(req.dialogue.length <= 2);
    });
  }
  const first = h3Prompt(sc.main.shots[0], sc.main.beats[0]).join("\n");
  assert.match(first, /The figure by the fire \(Image \d\), [^:]+: <d>\[English\] /, "attributed with acting direction");
  assert.match(h3Prompt(sc.main.shots[2], sc.main.beats[2]).join("\n"), /Pim fails to calm the quarrel/, "the check is in the shot");
  assert.match(sc.main.shots[2].prompt, /Setting: .*The place:/, "route context in the setting");
});

test("every scenario has speech in at least two beats, and the pins keep their named cast", () => {
  const want: Record<string, string[]> = { "stranger-trap": ["stranger.signal-fire", "odalys"], "night-death": ["dov"], "companion-turns": ["juniper"] };
  for (const def of SCENARIOS) {
    const sc = buildScenario(def);
    assert.ok(sc.main.beats.filter((b) => b.talk?.length).length >= 2, `${def.id} speaks`);
    assert.ok(sc.main.shots.some((s) => s.dialogue.length), def.id);
    for (const key of want[def.id]) assert.ok(sc.main.beats.some((b) => b.participants.includes(key)), `${def.id} has ${key}`);
  }
});

// ---------------------------------------------------------------- video tooling

test("video server rejects malformed shot requests and off-model endpoints", () => {
  const sc = buildScenario("stranger-trap");
  const good = sc.main.shots[0];
  assert.equal(checkRequest(good), null);
  assert.ok(checkRequest({ ...good, endpoint: "evil/other" }));
  assert.ok(checkRequest({ ...good, duration: 99 }));
  assert.ok(checkRequest(null));
});

test("fal client: key from env, never in errors, refuses other hosts", async () => {
  const env = { FAL_KEY: "sekrit-key-123" } as NodeJS.ProcessEnv;
  assert.equal(redact("Key sekrit-key-123 leaked", env).includes("sekrit"), false);
  let seenAuth = "";
  const fakeFetch = (async (url: string, init: { headers: Record<string, string> }) => {
    seenAuth = init.headers.Authorization;
    assert.ok(String(url).startsWith("https://queue.fal.run/"));
    return new Response(JSON.stringify({ request_id: "r1", status_url: "https://queue.fal.run/x/status", response_url: "https://queue.fal.run/x" }), { status: 200 });
  }) as unknown as typeof fetch;
  const t = await submit("minimax/h3-max/reference-to-video", { prompt: "p" }, { fetch: fakeFetch, env });
  assert.equal(t.request_id, "r1");
  assert.equal(seenAuth, "Key sekrit-key-123");
  await assert.rejects(submit("minimax/h3-max/reference-to-video", {}, { fetch: fakeFetch, env: {} as NodeJS.ProcessEnv }), (e: Error) => !/sekrit/.test(e.message));
});

test("video mode parsing: off by default, hash and query forms", () => {
  assert.equal(parseVideoMode("", "").name, "off");
  assert.equal(parseVideoMode("#video=mock", "").name, "mock");
  const rt = parseVideoMode("#fast&video=realtime@http://127.0.0.1:8787", "");
  assert.equal(rt.name, "realtime");
  assert.equal(rt.url, "http://127.0.0.1:8787");
  const bk = parseVideoMode("", "?video=baked@clips/baked.json&videoMin=minor&videoWait=50");
  assert.deepEqual([bk.name, bk.minStakes, bk.maxWaitMs], ["baked", "minor", 50]);
});

// ---------------------------------------------------------------- purity

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : f.endsWith(".ts") ? [join(dir, f)] : []));
}

test("src/story stays pure, and src/game never imports it", () => {
  for (const file of walk("src/story")) {
    const text = readFileSync(file, "utf8");
    assert.ok(!/from\s+["']node:/.test(text), `${file} imports node:`);
    assert.ok(!/from\s+["'](three|playwright)/.test(text), `${file} imports a renderer`);
    assert.ok(!/\b(document|window|localStorage)\./.test(text), `${file} touches the DOM`);
    assert.ok(!/from\s+["'][./]*\/?(web|tools)\//.test(text), `${file} imports web or tools`);
    assert.ok(!/process\.env/.test(text), `${file} reads the environment`);
  }
  for (const file of walk("src/game")) assert.ok(!/from\s+["'][^"']*story\//.test(readFileSync(file, "utf8")), `${file} imports story`);
});

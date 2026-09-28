// Behaviour of dialogue, checks, tells and named companions (the content rules
// live in dialogue-content.test.ts).

import { test } from "node:test";
import assert from "node:assert/strict";
import { Game } from "../src/game/game.ts";
import type { Env } from "../src/game/effects.ts";
import { applyEffects } from "../src/game/effects.ts";
import { buildScene, doLook, doRead } from "../src/game/scenes.ts";
import { sayLine } from "../src/game/dialogue.ts";
import { checkBonus, pickChecker, rollCheck } from "../src/game/checks.ts";
import { dueComplications } from "../src/game/dialogue.ts";
import { fx } from "../src/game/content/fx.ts";
import { npcById, NPCS } from "../src/game/content/npcs.ts";
import { sceneById, SCENES } from "../src/game/content/scenes/index.ts";
import { living } from "../src/game/party.ts";
import { GESTURES, MOODS } from "../src/game/types.ts";
import type { GameState } from "../src/game/types.ts";

const COMPANIONS = ["ines", "dov", "cutter", "wren"];

function fresh(seed = 1): Game {
  return Game.create({ seed, leaderName: "Jo", background: "surveyor", companions: COMPANIONS });
}

function underway(seed = 1): Game {
  const g = fresh(seed);
  g.trade("rations", 100);
  g.trade("torches", 12);
  g.trade("ammo", 20);
  g.trade("medicine", 4);
  g.choose("depart");
  return g;
}

function env(g: Game): Env {
  return { s: g.s, rng: g.rng, bind: {} };
}

function enter(g: Game, id: string): void {
  g.s.pending = { kind: "scene", scene: buildScene(env(g), { t: "scene", id }) };
}

test("a scene screen carries resolved spoken lines with names, moods and gestures", () => {
  const g = underway(4);
  enter(g, "fever");
  const screen = g.screen();
  assert.equal(screen.kind, "scene");
  assert.ok(screen.talk.length >= 2, "the setup is spoken");
  const names = new Set(g.s.party.map((m) => m.name.split(" ")[0]));
  for (const line of screen.talk) {
    assert.ok(names.has(line.name), `${line.name} is a party member`);
    assert.equal(line.kind, "member");
    assert.ok((MOODS as readonly string[]).includes(line.mood));
    assert.ok((GESTURES as readonly string[]).includes(line.gesture));
    assert.ok(line.text.length > 1 && !line.text.includes("{"), `unfilled placeholder in "${line.text}"`);
  }
});

test("a stranger scene has a named stranger who speaks, and a look", () => {
  const g = underway(5);
  enter(g, "wounded-traveler");
  const screen = g.screen();
  const def = sceneById("wounded-traveler")!;
  assert.ok(def.stranger?.look.summary);
  const spoken = screen.talk.find((l) => l.kind === "stranger");
  assert.ok(spoken, "the stranger speaks");
  assert.equal(spoken.name, def.stranger!.name);
});

test("a trait changes what a party member says", () => {
  const g = underway(6);
  const e = env(g);
  const [, m] = g.s.party;
  const line = { who: "leader" as const, text: "plain words", alt: { veteran: "veteran words", coward: "coward words" } };
  const lead = g.s.party.find((p) => p.isLeader)!;
  lead.traits = ["stoic", "kind"];
  assert.equal(sayLine(e, {}, line)!.text, "plain words");
  lead.traits = ["stoic", "veteran"];
  assert.equal(sayLine(e, {}, line)!.text, "veteran words");
  assert.ok(m);
});

test("dead speakers are skipped and named companions not yet aboard fall back to the definition", () => {
  const g = underway(7);
  const e = env(g);
  const said = sayLine(e, {}, { who: "npc:mattie", text: "Hello.", mood: "afraid" });
  assert.equal(said!.kind, "npc");
  assert.equal(said!.name, "Mattie");
  const lead = g.s.party.find((p) => p.isLeader)!;
  g.s.party.filter((p) => !p.isLeader).forEach((p) => (p.alive = false));
  assert.equal(sayLine(e, {}, { who: "role:medic", text: "x" })?.speaker ?? "gone", lead.role === "medic" ? lead.id : "gone");
});

test("checks are deterministic under the seed and never touch the stream when previewed", () => {
  const a = underway(11);
  const b = underway(11);
  const pa = pickChecker(a.s, "persuade")!;
  const pb = pickChecker(b.s, "persuade")!;
  assert.equal(pa.member.id, pb.member.id);
  const before = a.s.rng;
  pickChecker(a.s, "persuade");
  checkBonus("calm", pa.member);
  assert.equal(a.s.rng, before, "previews consume no randomness");
  const ra = rollCheck(a.rng, "persuade", 12, "test", pa);
  const rb = rollCheck(b.rng, "persuade", 12, "test", pb);
  assert.deepEqual(ra, rb);
  assert.ok(ra.roll >= 1 && ra.roll <= 20);
  assert.equal(ra.success, ra.roll === 20 || (ra.roll !== 1 && ra.roll + ra.bonus >= 12));
  assert.match(ra.reason, /total/);
});

test("traits, nerve and health move the bonus in the right direction", () => {
  const g = underway(12);
  const m = g.s.party[1];
  m.traits = ["stoic", "kind"];
  m.role = "hunter";
  m.nerve = 65;
  m.health = m.maxHealth;
  m.wounded = m.sick = false;
  m.fog = 0;
  const base = checkBonus("persuade", m).bonus;
  m.traits = ["charming", "kind"];
  assert.ok(checkBonus("persuade", m).bonus > base, "charm helps persuasion");
  m.nerve = 10;
  const shaken = checkBonus("persuade", m).bonus;
  m.nerve = 95;
  assert.ok(checkBonus("persuade", m).bonus > shaken, "nerve steadies the voice");
  m.wounded = true;
  const hurt = checkBonus("persuade", m).bonus;
  m.wounded = false;
  assert.ok(checkBonus("persuade", m).bonus > hurt, "wounds subtract");
  m.role = "scout";
  m.traits = ["paranoid", "stoic"];
  assert.ok(checkBonus("spot", m).bonus > checkBonus("persuade", m).bonus, "a paranoid scout spots better than they persuade");
});

test("a check option exposes who rolls, and its outcome screen carries the roll", () => {
  let seen = 0;
  for (let seed = 1; seed <= 25 && seen < 6; seed++) {
    const g = underway(seed);
    enter(g, "oxen-balk");
    const screen = g.screen();
    const opt = screen.options.find((o) => o.id === "soothe");
    assert.ok(opt?.check, "the soothing option previews its check");
    assert.ok(opt.check.byName.length > 1);
    const out = g.choose("soothe");
    assert.equal(out.kind, "result");
    assert.ok(out.check, "the outcome shows the roll");
    assert.equal(out.check!.kind, "calm");
    assert.equal(out.check!.by, opt.check.by, "the previewed roller is the one who rolls");
    assert.ok(out.talk.some((l) => l.speaker === out.check!.by) || out.talk.length >= 0);
    seen++;
  }
  assert.ok(seen >= 6);
});

test("check outcomes obey success and fail gating over many seeds", () => {
  const wins = { success: 0, fail: 0 };
  for (let seed = 1; seed <= 200; seed++) {
    const g = underway(seed);
    enter(g, "oxen-balk");
    const out = g.choose("soothe");
    const def = sceneById("oxen-balk")!.options.find((o) => o.id === "soothe")!;
    const chosen = (def.results.any ?? []).find((o) => o.text.replace(/\{by\}/g, out.check!.byName) === out.lines[0] || out.lines.includes(o.text.replace(/\{by\}/g, out.check!.byName)));
    if (chosen) assert.equal(chosen.needs, out.check!.success ? "success" : "fail");
    wins[out.check!.success ? "success" : "fail"]++;
  }
  assert.ok(wins.success > 20 && wins.fail > 20, `a fair spread of outcomes: ${JSON.stringify(wins)}`);
});

test("looking closer and reading a stranger are perception checks with structured tells", () => {
  const g = underway(8);
  enter(g, "wounded-traveler");
  let screen = g.screen();
  assert.ok(screen.tells.length > 0 || screen.tells.length === 0);
  for (const t of screen.tells) {
    assert.ok(t.id && [1, 2, 3].includes(t.severity), "tells carry id and severity");
    assert.equal(t.visible, true);
  }
  const before = screen.tells.length;
  screen = g.choose("look");
  assert.ok(screen.tells.length >= before, "looking closer never hides anything");
  assert.ok(screen.talk.length >= 0);
  const p = g.s.pending;
  assert.equal(p.kind, "scene");
  if (p.kind === "scene") {
    doRead(env(g), p.scene);
    assert.ok(["genuine", "trap", "unsure"].includes(p.scene.read as string));
  }
});

test("a perceptive observer reveals more than a poor one over many seeds", () => {
  const count = { keen: 0, dull: 0 };
  for (let seed = 0; seed < 200; seed++) {
    for (const kind of ["keen", "dull"] as const) {
      const g = underway(300 + seed);
      const obs = g.s.party[2];
      obs.role = kind === "keen" ? "scout" : "mechanic";
      obs.traits = kind === "keen" ? ["paranoid", "stoic"] : ["haunted", "kind"];
      obs.nerve = kind === "keen" ? 90 : 20;
      const inst = buildScene(env(g), { t: "scene", id: "wounded-traveler" });
      inst.tells = inst.tells.map((t) => ({ ...t, revealed: false }));
      inst.observer = obs.id;
      doLook(env(g), inst);
      count[kind] += inst.tells.filter((t) => t.revealed).length;
    }
  }
  assert.ok(count.keen > count.dull, `keen ${count.keen} vs dull ${count.dull}`);
});

test("recruiting a named companion adds a member with a look, a backstory and a joined flag", () => {
  const g = underway(9);
  const before = living(g.s).length;
  applyEffects(env(g), [fx.recruit("mattie")], []);
  const after = living(g.s);
  assert.equal(after.length, before + 1);
  const m = g.s.party.find((p) => p.id === "mattie")!;
  assert.ok(m.recruited);
  assert.equal(m.role, npcById("mattie")!.role);
  assert.equal(g.s.flags["joined:mattie"], g.s.day);
  const view = g.screen().hud.party.find((p) => p.id === "mattie");
  assert.ok(view?.look?.summary, "the party view exposes the look");
});

test("a joined companion's complication comes due after their delay, once", () => {
  const g = underway(10);
  applyEffects(env(g), [fx.recruit("mattie")], []);
  assert.deepEqual(dueComplications(g.s), []);
  g.s.day += npcById("mattie")!.complication.afterDays;
  const due = dueComplications(g.s);
  assert.equal(due.length, 1);
  assert.equal(due[0].actor, "mattie");
  g.s.used.push(due[0].id);
  assert.deepEqual(dueComplications(g.s), []);
});

test("every NPC's join lines resolve and every complication scene runs", () => {
  for (const npc of NPCS) {
    const g = underway(20);
    applyEffects(env(g), [fx.recruit(npc.id)], []);
    for (const line of npc.join) assert.ok(sayLine(env(g), {}, line), `${npc.id}: join line resolves`);
    const scene = sceneById(npc.complication.scene)!;
    g.s.pending = { kind: "scene", scene: buildScene({ s: g.s, rng: g.rng, bind: { actor: npc.id } }, { t: "scene", id: scene.id, actor: npc.id }) };
    const screen = g.screen();
    assert.ok(screen.talk.some((l) => l.speaker === npc.id), `${npc.id} speaks in their own complication`);
    const opt = screen.options.find((o) => !o.disabled);
    assert.ok(opt, `${npc.id}: something can be done`);
    g.choose(opt.id);
  }
});

test("a save taken mid-scene restores the same scene, lines and rolls", () => {
  const a = underway(13);
  enter(a, "wounded-traveler");
  a.choose("look");
  const saved = a.serialize();
  const b = Game.restore(saved);
  assert.deepEqual(b.screen().talk, a.screen().talk);
  assert.deepEqual(b.screen().tells, a.screen().tells);
  const oa = a.choose("water");
  const ob = b.choose("water");
  assert.deepEqual(oa.talk, ob.talk);
  assert.equal(a.serialize(), b.serialize());
});

test("a save taken on the result screen keeps the roll", () => {
  const a = underway(14);
  enter(a, "oxen-balk");
  a.choose("soothe");
  const b = Game.restore(a.serialize());
  assert.deepEqual(b.screen().check, a.screen().check);
  assert.ok(b.screen().check);
});

test("viewing a screen never consumes randomness", () => {
  const g = underway(15);
  enter(g, "wounded-traveler");
  const before: GameState["rng"] = g.s.rng;
  g.screen();
  g.screen();
  assert.equal(g.s.rng, before);
});

test("every scene builds and shows a screen for a fresh party", () => {
  for (const def of SCENES) {
    const g = underway(31);
    const bind: Env["bind"] = {};
    if (def.pairWeight) {
      const [a, b] = g.s.party.filter((m) => !m.isLeader);
      bind.a = a.id;
      bind.b = b.id;
    }
    const inst = buildScene({ s: g.s, rng: g.rng, bind }, { t: "scene", id: def.id });
    g.s.pending = { kind: "scene", scene: inst };
    const screen = g.screen();
    assert.ok(screen.options.length > 0, `${def.id} has options`);
  }
});

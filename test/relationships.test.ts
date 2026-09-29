// Relationships: seeding, affairs and their discovery, what the player may see,
// history, and the save round trip.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Game } from "../src/game/game.ts";
import type { Env } from "../src/game/effects.ts";
import { Rng } from "../src/game/rng.ts";
import { HISTORY_CAP, remember, living } from "../src/game/party.ts";
import { sceneById } from "../src/game/content/scenes/index.ts";
import {
  actionWeights,
  isCouple,
  kindOf,
  noticeDc,
  relationsOf,
  rollNotice,
  runTryst,
  setKind,
} from "../src/game/relationships.ts";
import type { Secret } from "../src/game/types.ts";

const COMPANIONS = ["ines", "dov", "cutter", "wren"];

function fresh(seed = 1): Game {
  return Game.create({ seed, leaderName: "Jo", background: "surveyor", companions: COMPANIONS });
}

function env(g: Game): Env {
  return { s: g.s, rng: g.rng, bind: {} };
}

function crew(g: Game) {
  return g.s.party.filter((m) => !m.isLeader);
}

function pairsSnapshot(g: Game): string {
  return JSON.stringify({ pairs: g.s.rel.pairs, faith: g.s.rel.faith, bonds: g.s.bonds });
}

/** An affair between two people with a third as the wronged partner. */
function stageAffair(g: Game): { sec: Secret; wronged: string; culprit: string; lover: string; friend: string } {
  const [wronged, culprit, lover, friend] = crew(g).map((m) => m.id);
  setKind(g.s, wronged, culprit, "lovers");
  const sec: Secret = {
    id: g.s.rel.nextSecret++,
    kind: "affair",
    culprit,
    lover,
    wronged: [wronged],
    started: g.s.day,
    last: g.s.day,
    trysts: 0,
    knows: [],
    wrongedKnows: [],
    responded: [],
    brooding: {},
    playerKnows: false,
    glimpsed: false,
  };
  g.s.rel.secrets.push(sec);
  return { sec, wronged, culprit, lover, friend };
}

test("relations are seeded deterministically from the seed", () => {
  assert.equal(pairsSnapshot(fresh(9)), pairsSnapshot(fresh(9)));
  const differs = [2, 3, 4, 5, 6].some((seed) => pairsSnapshot(fresh(seed)) !== pairsSnapshot(fresh(9)));
  assert.ok(differs, "different seeds seed different relations");
});

test("every person aboard has a hidden fidelity and a relation to each other person", () => {
  const g = fresh(3);
  const ms = crew(g);
  for (const m of ms) assert.ok(typeof g.s.rel.faith[m.id] === "number", `${m.id} has a disposition`);
  for (const a of ms) for (const b of ms) if (a !== b) assert.ok(kindOf(g.s, a.id, b.id), "a kind exists");
});

test("across many musters some pairs start attached and no one is attached twice", () => {
  let couples = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const g = fresh(seed);
    const seen = new Map<string, number>();
    for (const [key, r] of Object.entries(g.s.rel.pairs)) {
      if (!isCouple(r.kind)) continue;
      couples++;
      for (const id of key.split("|")) seen.set(id, (seen.get(id) ?? 0) + 1);
    }
    for (const n of seen.values()) assert.equal(n, 1, "a person is in at most one couple at muster");
  }
  assert.ok(couples > 0, "couples appear");
});

test("a notice roll is a seeded spot check against the affair's difficulty", () => {
  const g = fresh(5);
  const { sec, friend } = stageAffair(g);
  const observer = g.s.party.find((m) => m.id === friend)!;
  const a = rollNotice(new Rng({ rng: 77 }), g.s, sec, observer);
  const b = rollNotice(new Rng({ rng: 77 }), g.s, sec, observer);
  assert.deepEqual(a, b, "same seed, same roll");
  assert.equal(a.dc, noticeDc(g.s, sec));
  assert.equal(a.success, a.roll + a.bonus >= a.dc);
  sec.covered = true;
  assert.equal(noticeDc(g.s, sec), a.dc + 3, "covering for them makes it harder to see");
});

test("every tryst gives each other person a spot-check roll", () => {
  const g = fresh(6);
  const { sec } = stageAffair(g);
  const report = runTryst(env(g), sec);
  const watchers = living(g.s).filter((m) => m.id !== sec.culprit && m.id !== sec.lover);
  assert.equal(report.rolls.length, watchers.length);
  assert.equal(sec.trysts, 1);
});

test("a close friend of the wronged partner will tell them", () => {
  const g = fresh(8);
  const { sec, wronged, friend } = stageAffair(g);
  const n = g.s.party.find((m) => m.id === friend)!;
  g.s.bonds = {};
  for (const [a, b] of [[friend, wronged]]) {
    const key = [a, b].sort().join("|");
    g.s.bonds[key] = 80;
  }
  const w = actionWeights(g.s, n, sec);
  assert.ok(w.tell > w.quiet, "a devoted friend leans towards telling");
  // Force the path: the friend notices every time and always tells.
  let told = false;
  for (let i = 0; i < 40 && !told; i++) {
    const before = sec.wrongedKnows.length;
    const rng = new Rng({ rng: 1000 + i });
    runTryst({ s: g.s, rng, bind: {} }, sec);
    told = sec.wrongedKnows.includes(wronged) && sec.wrongedKnows.length > before;
    if (!told) {
      sec.knows = [];
      sec.wrongedKnows = [];
      sec.responded = [];
    }
  }
  assert.ok(told, "within a few trysts the wronged partner is told or catches it");
});

test("the player learns nothing until told or shown", () => {
  const g = fresh(4);
  const { sec, culprit, lover } = stageAffair(g);
  const view = relationsOf(g.s, culprit).find((v) => v.otherId === lover)!;
  assert.ok(!/affair/.test(view.label), "no secret in the label");
  assert.notEqual(view.label, "secret lovers (an affair)");
  sec.playerKnows = true;
  const known = relationsOf(g.s, culprit).find((v) => v.otherId === lover)!;
  assert.match(known.label, /affair/);
  assert.equal(known.kind, "lovers");
  // The leader has no personal relations to show.
  assert.deepEqual(relationsOf(g.s, g.s.party.find((m) => m.isLeader)!.id), []);
});

test("Game.relations mirrors relationsOf and hides no living crew", () => {
  const g = fresh(2);
  const m = crew(g)[0];
  const views = g.relations(m.id);
  assert.deepEqual(views, relationsOf(g.s, m.id));
  assert.equal(views.length, crew(g).length - 1);
});

test("history is capped and keeps the newest entries", () => {
  const g = fresh(1);
  const m = crew(g)[0];
  for (let i = 0; i < HISTORY_CAP + 15; i++) {
    g.s.day = i;
    remember(g.s, m, `thing ${i}`);
  }
  assert.equal(m.history.length, HISTORY_CAP);
  assert.equal(m.history[m.history.length - 1].text, `thing ${HISTORY_CAP + 14}`);
});

test("relationship state survives a save and restore", () => {
  const g = fresh(11);
  const { sec } = stageAffair(g);
  runTryst(env(g), sec);
  const back = Game.restore(g.serialize());
  assert.deepEqual(back.s.rel, g.s.rel);
  assert.deepEqual(back.s.bonds, g.s.bonds);
  assert.deepEqual(
    back.s.party.map((m) => m.history),
    g.s.party.map((m) => m.history),
  );
});

test("a save without relationship data is repaired on restore", () => {
  const g = fresh(12);
  const raw = JSON.parse(g.serialize());
  delete raw.s?.rel;
  delete raw.rel;
  const back = Game.restore(JSON.stringify(raw));
  assert.ok(back.s.rel && Array.isArray(back.s.rel.secrets));
});

test("every scene the engine can queue exists", () => {
  const ids = [
    "rel-courtship-spark", "rel-lovers-moment", "rel-proposal", "rel-wedding", "rel-jealous-spat",
    "rel-triangle-standoff", "rel-breakup", "rel-reconcile", "rel-lovers-quarrel", "rel-friends-bond",
    "rel-affair-glimpse", "rel-affair-evidence", "rel-confidant", "rel-confrontation", "rel-caught-in-act",
    "rel-confession", "rel-blackmail", "rel-whispers", "rel-affair-ends", "rel-triangle-brawl",
    "rel-grief-lover", "rel-grief-friend", "rel-vigil", "rel-lover-follows", "rel-loyalty-rescue",
  ];
  for (const id of ids) assert.ok(sceneById(id), `missing scene ${id}`);
});

test("a long deterministic run with relationships is reproducible", () => {
  const run = (): string => {
    const g = fresh(21);
    g.trade("rations", 100);
    g.trade("torches", 10);
    g.choose("depart");
    for (let i = 0; i < 60; i++) {
      const screen = g.screen();
      const opt = "options" in screen ? screen.options.find((o) => !o.disabled) : undefined;
      try {
        g.choose(opt ? opt.id : "continue");
      } catch {
        break;
      }
    }
    return JSON.stringify(g.s.rel) + JSON.stringify(g.s.party.map((m) => m.history));
  };
  assert.equal(run(), run());
});

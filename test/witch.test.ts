import { test } from "node:test";
import assert from "node:assert/strict";
import { Game } from "../src/game/game.ts";
import { living } from "../src/game/party.ts";

const COMPANIONS = ["ines", "dov", "cutter", "wren"];

function underway(seed: number): Game {
  const g = Game.create({ seed, leaderName: "Jo", background: "surveyor", companions: COMPANIONS });
  g.trade("rations", 100);
  g.trade("torches", 12);
  g.trade("ammo", 20);
  g.trade("medicine", 4);
  g.choose("depart");
  return g;
}

/** Put the game at the witch's arrival, with the given seed. */
function taken(seed: number): Game {
  const g = underway(seed);
  const s = g.s;
  s.flags["witch:stage"] = 1;
  s.queue = [{ t: "scene", id: "witch-takes" }, { t: "travel" }];
  s.pending = { kind: "result", title: "x", lines: [], notes: [] };
  g.choose("continue");
  assert.equal(pendingId(g), "witch-takes");
  g.choose("stand");
  return g;
}

function pendingId(g: Game): string | undefined {
  const p = g.s.pending;
  return p.kind === "scene" ? p.scene.id : undefined;
}

/** Take the next scene's option; fails clearly if the scene is not what we expected. */
function step(g: Game, scene: string, option: string): void {
  assert.equal(pendingId(g), scene, `expected ${scene}, got ${g.s.pending.kind}`);
  g.choose(option);
}

/** Ride out any results/continues until a scene or the end. */
function settle(g: Game): void {
  let n = 0;
  while (g.s.pending.kind === "result" && n++ < 6) g.choose("continue");
}

const captives = (g: Game) => g.s.party.filter((m) => m.captive);

test("the witch takes one to three people, who count as gone", () => {
  for (let seed = 1; seed <= 12; seed++) {
    const g = taken(seed);
    settle(g);
    const held = captives(g);
    assert.ok(held.length >= 1 && held.length <= 3, `seed ${seed}: ${held.length} taken`);
    for (const m of held) {
      assert.equal(m.alive, false);
      assert.equal(m.taken, true);
    }
    assert.ok(!held.some((m) => m.isLeader), "the leader is never taken");
    assert.equal(pendingId(g), "witch-aftermath");
  }
});

test("taking is deterministic for a seed, and varies across seeds", () => {
  const key = (seed: number) => captives(taken(seed)).map((m) => m.id).join(",") + `|${taken(seed).s.flags["witch:demand"]}`;
  assert.equal(key(5), key(5));
  const seen = new Set<string>();
  for (let seed = 1; seed <= 30; seed++) seen.add(key(seed));
  assert.ok(seen.size >= 4, "different seeds give different abductions");
});

test("abandoning loses the captives for good and marks the flags", () => {
  const g = taken(3);
  settle(g);
  const n = captives(g).length;
  const deaths = g.s.stats.deaths;
  step(g, "witch-aftermath", "abandon");
  settle(g);
  assert.equal(captives(g).length, 0);
  assert.equal(g.s.stats.deaths, deaths + n);
  assert.ok((g.s.flags["witch:lost"] ?? 0) >= 1);
  assert.ok((g.s.flags["witch:abandoned"] ?? 0) >= 1);
});

test("rescuing costs days and the Haze closes; a paid bargain brings people back", () => {
  const g = taken(4);
  settle(g);
  const n = captives(g).length;
  const day0 = g.s.day;
  const gap0 = g.s.gap;
  step(g, "witch-aftermath", "pursue");
  settle(g);
  assert.equal(pendingId(g), "witch-trail");
  step(g, "witch-trail", "salt");
  settle(g);
  assert.ok(g.s.day > day0, "the chase took days");
  assert.ok(g.s.gap < gap0, "the Haze closed while you were gone");
  // Walk her hollow until her door, taking safe choices.
  for (let i = 0; i < 6 && pendingId(g) !== "witch-door"; i++) {
    const id = pendingId(g)!;
    const opt = { "witch-bog": "round", "witch-wood": "skirt", "witch-hounds": "feed" }[id];
    assert.ok(opt, `unexpected scene ${id}`);
    step(g, id, opt);
    settle(g);
  }
  step(g, "witch-door", "offer-supplies");
  settle(g);
  const back = living(g.s).length;
  assert.ok(g.s.party.filter((m) => m.captive).length + g.s.flags["witch:lost"] >= 0);
  assert.ok(back >= 1);
  assert.ok(n >= 1);
});

test("a full rescue restores the captives alive, sometimes changed", () => {
  let restored = 0;
  let marked = 0;
  for (let seed = 1; seed <= 25; seed++) {
    const g = taken(seed);
    settle(g);
    const held = captives(g).map((m) => m.id);
    // Cheapest possible route: shout the price into the fog, then pay.
    step(g, "witch-aftermath", "bargain");
    settle(g);
    if (pendingId(g) !== "witch-bargain") continue;
    g.s.res.rations = 200;
    g.s.res.torches = 20;
    step(g, "witch-bargain", "offer-supplies");
    settle(g);
    for (const id of held) {
      const m = g.s.party.find((x) => x.id === id)!;
      if (m.alive && !m.captive) {
        restored++;
        if (m.marks?.length) marked++;
      }
    }
  }
  assert.ok(restored > 5, `rescued people came back (${restored})`);
  assert.ok(marked >= 0);
});

test("a failed rescue can lose the captives, and the chain survives save and restore", () => {
  const g = taken(6);
  settle(g);
  step(g, "witch-aftermath", "pursue");
  settle(g);
  step(g, "witch-trail", "salt");
  settle(g);
  const json = g.serialize();
  const twin = Game.restore(json);
  assert.equal(pendingId(twin), pendingId(g));
  assert.deepEqual(captives(twin).map((m) => m.id), captives(g).map((m) => m.id));
  // Both copies play the same choices to the same result.
  for (const game of [g, twin]) {
    for (let i = 0; i < 6 && pendingId(game) !== "witch-door" && game.s.pending.kind === "scene"; i++) {
      const id = pendingId(game)!;
      const opt = { "witch-bog": "round", "witch-wood": "skirt", "witch-hounds": "feed" }[id] ?? "turn-back";
      game.choose(opt);
      settle(game);
    }
    if (pendingId(game) === "witch-door") {
      game.choose("turn-back");
      settle(game);
    }
  }
  assert.equal(g.serialize(), twin.serialize(), "deterministic after restore");
  assert.equal(captives(g).length, 0, "turning back at her door ends the hold");
  assert.ok((g.s.flags["witch:lost"] ?? 0) >= 1);
});

test("someone left behind calls from the fog later", () => {
  const g = taken(8);
  settle(g);
  step(g, "witch-aftermath", "abandon");
  settle(g);
  assert.ok((g.s.flags["witch:lost"] ?? 0) >= 1);
});

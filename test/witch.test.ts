import { test } from "node:test";
import assert from "node:assert/strict";
import { Game } from "../src/game/game.ts";
import type { Env } from "../src/game/effects.ts";
import { applyEffects } from "../src/game/effects.ts";
import { bond, living, leader } from "../src/game/party.ts";
import { setKind } from "../src/game/relationships.ts";
import { fx } from "../src/game/content/fx.ts";
import type { Member } from "../src/game/types.ts";

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

function resume(g: Game): void {
  g.s.pending = { kind: "result", title: "x", lines: [], notes: [] };
}

function pendingId(g: Game): string | undefined {
  const p = g.s.pending;
  return p.kind === "scene" ? p.scene.id : undefined;
}

/** Bring the witch on stage: the night she takes people, with nobody warding. */
function taken(seed: number, prep?: (g: Game) => void): Game {
  const g = underway(seed);
  prep?.(g);
  g.s.flags["witch:stage"] = 1;
  g.s.queue = [{ t: "scene", id: "witch-takes" }, { t: "travel" }];
  resume(g);
  g.choose("continue");
  assert.equal(pendingId(g), "witch-takes");
  g.choose("stand");
  settle(g);
  return g;
}

function step(g: Game, scene: string, option: string): void {
  assert.equal(pendingId(g), scene, `expected ${scene}, got ${pendingId(g) ?? g.s.pending.kind}`);
  g.choose(option);
  settle(g);
}

/** Ride out any result screens until a scene or the end. */
function settle(g: Game): void {
  let n = 0;
  while (g.s.pending.kind === "result" && n++ < 6) g.choose("continue");
}

const captives = (g: Game) => g.s.party.filter((m) => m.captive);
const envOf = (g: Game): Env => ({ s: g.s, rng: g.rng, bind: {} });
const flag = (g: Game, k: string) => g.s.flags[k] ?? 0;

/** A member who is on the train and not the leader nor held. */
function bystander(g: Game): Member {
  return g.s.party.find((m) => m.alive && !m.isLeader && !m.captive)!;
}

test("the witch takes one to three people, who count as gone but are not dead", () => {
  for (let seed = 1; seed <= 12; seed++) {
    const g = taken(seed);
    const held = captives(g);
    assert.ok(held.length >= 1 && held.length <= 3, `seed ${seed}: ${held.length} taken`);
    for (const m of held) {
      assert.equal(m.alive, false);
      assert.equal(m.taken, true);
      assert.equal(m.fate, "taken by the witch");
    }
    assert.ok(!held.some((m) => m.isLeader), "the leader is never taken");
    assert.equal(pendingId(g), "witch-aftermath");
    assert.equal(flag(g, "witch:stage"), 2);
  }
});

test("taking is deterministic for a seed, and varies across seeds", () => {
  const key = (seed: number) => {
    const g = taken(seed);
    return captives(g).map((m) => m.id).join(",") + `|${g.s.flags["witch:demand"]}`;
  };
  assert.equal(key(5), key(5));
  const seen = new Set<string>();
  for (let seed = 1; seed <= 30; seed++) seen.add(key(seed));
  assert.ok(seen.size >= 4, "different seeds give different abductions");
});

test("abandoning loses the captives for good and counts them", () => {
  const g = taken(3);
  const n = captives(g).length;
  const deaths = g.s.stats.deaths;
  step(g, "witch-aftermath", "abandon");
  assert.equal(captives(g).length, 0);
  assert.equal(g.s.stats.deaths, deaths + n);
  assert.equal(flag(g, "witch:lost"), n);
  assert.equal(flag(g, "witch:abandoned"), n);
  assert.equal(flag(g, "witch:stage"), 3);
  assert.ok(g.s.party.filter((m) => m.taken).every((m) => !m.alive && /witch/.test(m.fate ?? "")));
});

test("ties decide the cost of leaving someone: a lover is worse than a stranger", () => {
  const cost = (kind: "lovers" | "stranger") => {
    const g = taken(4);
    const lost = captives(g)[0];
    const other = bystander(g);
    setKind(g.s, other.id, lost.id, kind);
    const lead = leader(g.s);
    const b0 = bond(g.s, lead.id, other.id);
    const n0 = other.nerve;
    const t0 = other.trust;
    step(g, "witch-aftermath", "abandon");
    return { bond: b0 - bond(g.s, lead.id, other.id), nerve: n0 - other.nerve, trust: t0 - other.trust, history: other.history.map((h) => h.text).join("|") };
  };
  const lover = cost("lovers");
  const none = cost("stranger");
  assert.ok(lover.bond >= 25 && none.bond < 25, `bond ${lover.bond} vs ${none.bond}`);
  assert.ok(lover.trust > none.trust);
  assert.ok(lover.nerve > none.nerve);
  assert.match(lover.history, /Will not forgive/);
  assert.doesNotMatch(none.history, /Will not forgive/);
});

test("rescue by the chain costs days, the Haze closes, and paying her at the door frees captives", () => {
  const g = taken(4);
  const n = captives(g).length;
  const day0 = g.s.day;
  const gap0 = g.s.gap;
  step(g, "witch-aftermath", "pursue");
  assert.equal(pendingId(g), "witch-trail");
  step(g, "witch-trail", "salt");
  const visited: string[] = [];
  for (let i = 0; i < 6 && pendingId(g) !== "witch-door"; i++) {
    const id = pendingId(g)!;
    visited.push(id);
    const opt = ({ "witch-bog": "round", "witch-wood": "skirt", "witch-hounds": "feed" } as Record<string, string>)[id];
    assert.ok(opt, `unexpected scene ${id}`);
    step(g, id, opt);
  }
  assert.equal(visited.length, 1, "one hollow scene between the trail and the door");
  assert.ok(g.s.day >= day0 + 2, `the chase took days (${g.s.day - day0})`);
  assert.ok(g.s.gap <= gap0 - 8, `the Haze closed (${gap0} to ${g.s.gap})`);
  g.s.res.rations = 200;
  step(g, "witch-door", "offer-supplies");
  assert.equal(captives(g).length, 0, "the story is settled either way");
  assert.equal(flag(g, "witch:rescued") + flag(g, "witch:lost"), n);
  assert.equal(flag(g, "witch:stage"), 3);
});

test("a rescue brings people back weak, sometimes changed; a lasting mark bites", () => {
  let restored = 0;
  let marked = 0;
  let lost = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const g = taken(seed);
    const held = captives(g).map((m) => m.id);
    step(g, "witch-aftermath", "bargain");
    if (pendingId(g) !== "witch-bargain") continue;
    g.s.res.rations = 200;
    g.s.res.torches = 20;
    step(g, "witch-bargain", "offer-supplies");
    for (const id of held) {
      const m = g.s.party.find((x) => x.id === id)!;
      if (m.alive) {
        restored++;
        assert.equal(m.captive, false);
        assert.equal(m.fate, undefined);
        assert.ok(m.health <= Math.round(m.maxHealth * 0.85), "back weak");
        assert.ok(m.history.some((h) => /Came back/.test(h.text)));
        if (m.marks?.length) {
          marked++;
          assert.ok(m.history.some((h) => /hex|touch/.test(h.text)), "the mark is in their history");
        }
      } else lost++;
    }
  }
  assert.ok(restored >= 30, `most bargains at the ring free someone (${restored})`);
  assert.ok(marked >= 1, "some come back changed");
  assert.ok(lost >= 1, "some bargains go wrong");
});

test("someone close aboard makes a rescue easier", () => {
  const back = (close: boolean) => {
    const g = taken(6);
    const m = captives(g)[0];
    const o = bystander(g);
    setKind(g.s, o.id, m.id, close ? "lovers" : "stranger");
    step(g, "witch-aftermath", "bargain");
    g.s.res.rations = 200;
    g.s.res.torches = 20;
    // Force a clean rescue: apply the restore directly to isolate the tie bonus.
    applyEffects(envOf(g), [fx.restore(0, 0)], []);
    return m;
  };
  const withLover = back(true);
  const without = back(false);
  assert.ok(withLover.health > without.health, `${withLover.health} vs ${without.health}`);
  assert.ok(withLover.nerve > without.nerve);
});

test("giving her the weakest of the crew: a lover left behind either follows or never forgives", () => {
  const outcomes = new Set<string>();
  for (let seed = 1; seed <= 40 && outcomes.size < 2; seed++) {
    const g = underway(seed);
    const crew = g.s.party.filter((m) => !m.isLeader);
    const target = crew.reduce((w, m) => (m.health < w.health ? m : w), crew[0]);
    const partner = crew.find((m) => m.id !== target.id)!;
    setKind(g.s, partner.id, target.id, "lovers");
    const before = living(g.s).length;
    applyEffects(envOf(g), [fx.giveCrew()], []);
    assert.equal(target.alive, false);
    if (!partner.alive) {
      assert.equal(living(g.s).length, before - 2);
      outcomes.add("follows");
    } else {
      assert.ok(partner.trust <= 8);
      assert.ok(partner.history.some((h) => /never forgive/i.test(h.text)));
      assert.equal(g.s.rel.pairs[[partner.id, target.id].sort().join("|")]?.kind, "estranged");
      outcomes.add("rift");
    }
    assert.ok(!g.s.queue.some((q) => q.t === "scene" && q.id === "rel-lover-follows"));
  }
  assert.deepEqual([...outcomes].sort(), ["follows", "rift"], "both outcomes happen across seeds");
});

test("a failed rescue ends the hold, and the chain survives save and restore", () => {
  const g = taken(6);
  const n = captives(g).length;
  step(g, "witch-aftermath", "pursue");
  step(g, "witch-trail", "salt");
  const twin = Game.restore(g.serialize());
  assert.equal(pendingId(twin), pendingId(g));
  assert.deepEqual(captives(twin).map((m) => m.id), captives(g).map((m) => m.id));
  for (const game of [g, twin]) {
    const id = pendingId(game)!;
    const opt = ({ "witch-bog": "round", "witch-wood": "skirt", "witch-hounds": "feed" } as Record<string, string>)[id];
    step(game, id, opt);
    step(game, "witch-door", "turn-back");
  }
  assert.equal(g.serialize(), twin.serialize(), "deterministic after restore");
  assert.equal(captives(g).length, 0);
  assert.equal(flag(g, "witch:lost"), n);
});

test("a voice calls from the fog after people are left behind", () => {
  const g = taken(8);
  step(g, "witch-aftermath", "abandon");
  assert.ok(flag(g, "witch:lost") >= 1);
  const nerve = leader(g.s).nerve;
  g.s.queue = [{ t: "scene", id: "witch-voice" }, { t: "travel" }];
  resume(g);
  g.choose("continue");
  assert.equal(pendingId(g), "witch-voice");
  g.choose("answer");
  assert.equal(flag(g, "witch:haunts"), 1);
  assert.ok(leader(g.s).nerve < nerve, "answering the voice costs the wagon-master");
});

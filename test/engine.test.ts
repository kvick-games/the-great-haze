import { test } from "node:test";
import assert from "node:assert/strict";
import { Game } from "../src/game/game.ts";
import { Rng } from "../src/game/rng.ts";
import type { Env } from "../src/game/effects.ts";
import { applyEffects } from "../src/game/effects.ts";
import { planTravel, mph } from "../src/game/travel.ts";
import { buildScene, resolveOption } from "../src/game/scenes.ts";
import { living, leader, cargoUsed, cargoCap } from "../src/game/party.ts";
import { TUNING } from "../src/game/tuning.ts";

const COMPANIONS = ["ines", "dov", "cutter", "wren"];

function fresh(seed = 1): Game {
  return Game.create({ seed, leaderName: "Jo", background: "surveyor", companions: COMPANIONS });
}

/** A game that has left the first store with a sensible kit, sitting at the morning plan. */
function underway(seed = 1): Game {
  const g = fresh(seed);
  g.trade("rations", 100);
  g.trade("torches", 12);
  g.trade("ammo", 20);
  g.trade("medicine", 4);
  g.choose("depart");
  assert.equal(g.s.pending.kind, "plan");
  return g;
}

function env(g: Game): Env {
  return { s: g.s, rng: g.rng, bind: {} };
}

test("rng is deterministic and respects ranges", () => {
  const a = new Rng({ rng: 42 });
  const b = new Rng({ rng: 42 });
  for (let i = 0; i < 200; i++) assert.equal(a.next(), b.next());
  const r = new Rng({ rng: 7 });
  for (let i = 0; i < 500; i++) {
    const n = r.int(3, 9);
    assert.ok(n >= 3 && n <= 9);
    const f = r.next();
    assert.ok(f >= 0 && f < 1);
  }
  assert.equal(r.weighted([1, 2, 3], () => 0), undefined);
});

test("a new game starts at the first store with the party assembled", () => {
  const g = fresh();
  assert.equal(g.s.pending.kind, "store");
  assert.equal(living(g.s).length, 5);
  assert.equal(g.s.party.filter((m) => m.isLeader).length, 1);
  assert.equal(leader(g.s).name, "Jo");
  assert.equal(g.s.scrip, TUNING.startScrip);
});

test("interactive party selection needs exactly four companions", () => {
  const g = Game.create({ seed: 3, leaderName: "Jo" });
  assert.equal(g.s.pending.kind, "setup");
  const first = g.screen();
  assert.ok(first.options.find((o) => o.id === "confirm")?.disabled);
  const picks = first.options.filter((o) => o.id.startsWith("pick:")).slice(0, 4);
  for (const p of picks) g.choose(p.id);
  const full = g.screen();
  assert.ok(full.options.filter((o) => o.id.startsWith("pick:")).some((o) => o.disabled), "fifth pick is blocked");
  g.choose("confirm");
  assert.equal(g.s.pending.kind, "store");
  assert.equal(living(g.s).length, 5);
});

test("the store enforces scrip, stock, and wagon capacity", () => {
  const g = fresh();
  const before = g.s.scrip;
  const msg = g.trade("rations", 100000);
  assert.match(msg, /Bought/);
  assert.ok(g.s.scrip >= 0 && g.s.scrip < before);
  assert.ok(cargoUsed(g.s.res) <= cargoCap(g.s), "cannot overfill the wagons");
  // Broke: nothing more can be bought.
  g.s.scrip = 0;
  assert.match(g.trade("medicine", 1), /afford|room/);
  // Selling at the first market refunds in full.
  const held = g.s.res.rations;
  g.trade("rations", -10);
  assert.equal(g.s.res.rations, held - 10);
  assert.equal(g.s.scrip, 20);
});

test("you cannot leave the first town with nothing to eat", () => {
  const g = fresh();
  assert.throws(() => g.choose("depart"), /nothing to eat/);
});

test("stopping costs ground: hours spent on business come out of the road", () => {
  const g = underway();
  const s = g.s;
  s.today.hoursUsed = 0;
  const idle = planTravel(s).travelHours;
  s.today.hoursUsed = 4;
  const busy = planTravel(s).travelHours;
  assert.equal(idle - busy, 4);
  assert.ok((idle - busy) * mph(s) > 5, "four hours should cost several miles");
  s.today.hoursUsed = 30;
  const swamped = planTravel(s);
  assert.equal(swamped.travelHours, 0);
  assert.ok(swamped.carry > 0 && swamped.carry <= TUNING.maxCarryHours, "overflow spills into tomorrow, bounded");
});

test("a halt day moves nothing and the Haze still advances", () => {
  const g = underway();
  const s = g.s;
  s.pace = "halt";
  s.today.hazeMiles = 10;
  const gap = s.gap;
  s.queue = [{ t: "travel" }];
  s.pending = { kind: "result", title: "x", lines: [], notes: [] };
  g.choose("continue");
  assert.equal(s.miles, 0);
  assert.equal(Math.round(s.gap), Math.round(gap - 10));
});

test("the Haze catching up ends the run", () => {
  const g = underway();
  const s = g.s;
  s.gap = 3;
  s.today.hazeMiles = 40;
  s.queue = [{ t: "travel" }];
  s.pending = { kind: "result", title: "x", lines: [], notes: [] };
  g.choose("continue");
  assert.equal(s.ending?.kind, "consumed");
  assert.equal(g.screen().kind, "ending");
  assert.throws(() => g.choose("continue"), /over/);
});

test("torches are burned when the Haze is close, and a dark camp costs nerve", () => {
  const g = underway();
  const s = g.s;
  s.gap = 20;
  s.today.hazeMiles = 20;
  const torches = s.res.torches;
  s.queue = [{ t: "travel" }];
  s.pending = { kind: "result", title: "x", lines: [], notes: [] };
  g.choose("continue");
  assert.ok(s.res.torches < torches, "torches burned");

  const dark = underway(2);
  dark.s.gap = 20;
  dark.s.res.torches = 0;
  dark.s.today.hazeMiles = 20;
  const nerves = living(dark.s).map((m) => m.nerve);
  dark.s.queue = [{ t: "travel" }];
  dark.s.pending = { kind: "result", title: "x", lines: [], notes: [] };
  dark.choose("continue");
  living(dark.s).forEach((m, i) => assert.ok(m.nerve < nerves[i], "a dark camp frays nerves"));
});

test("hunger hurts, and food runs out before the road does", () => {
  const g = underway();
  const s = g.s;
  s.res.rations = 0;
  s.today.hazeMiles = 0;
  const hp = living(s).map((m) => m.health);
  s.queue = [{ t: "travel" }];
  s.pending = { kind: "result", title: "x", lines: [], notes: [] };
  g.choose("continue");
  assert.ok(s.stats.starvedDays >= 1);
  living(s).forEach((m, i) => assert.ok(m.health < hp[i]));
});

test("the dying die on the second night unless treated", () => {
  const untreated = underway();
  const victim = untreated.s.party.find((m) => !m.isLeader)!;
  victim.dying = true;
  victim.health = 1;
  victim.dyingSince = untreated.s.day - 1;
  untreated.s.today.hazeMiles = 0;
  untreated.s.queue = [{ t: "travel" }];
  untreated.s.pending = { kind: "result", title: "x", lines: [], notes: [] };
  untreated.choose("continue");
  assert.equal(victim.alive, false);

  const treated = underway();
  const patient = treated.s.party.find((m) => !m.isLeader)!;
  patient.dying = true;
  patient.health = 1;
  patient.dyingSince = treated.s.day;
  const opts = treated.screen().options;
  const tend = opts.find((o) => o.id === `tend:${patient.id}:dying`);
  assert.ok(tend && !tend.disabled, "treatment is offered at the morning plan");
  treated.choose(tend.id);
  assert.equal(patient.dying, false);
  assert.equal(treated.s.res.medicine, 2);
});

test("damage rules: zero health means dying, a second blow kills", () => {
  const g = underway();
  const e = env(g);
  const victim = g.s.party.find((m) => !m.isLeader)!;
  const notes: string[] = [];
  applyEffects(e, [{ t: "hp", who: "b", d: -500 }], notes);
  e.bind = { b: victim.id };
  applyEffects(e, [{ t: "hp", who: "b", d: -500 }], notes);
  assert.equal(victim.dying, true);
  assert.equal(victim.alive, true);
  applyEffects(e, [{ t: "hp", who: "b", d: -5 }], notes);
  assert.equal(victim.alive, false);
  assert.equal(g.s.stats.deaths, 1);
});

test("the leader dying ends the run; the leader turning is its own ending", () => {
  const g = underway();
  applyEffects(env(g), [{ t: "kill", who: "leader", cause: "test" }], []);
  assert.equal(g.s.ending?.kind, "lost");

  const h = underway(4);
  leader(h.s).fog = 3;
  h.s.today.hazeMiles = 0;
  h.s.queue = [{ t: "travel" }];
  h.s.pending = { kind: "result", title: "x", lines: [], notes: [] };
  h.choose("continue");
  assert.equal(h.s.ending?.kind, "consumed");
  assert.match(h.s.ending!.headline, /Hollowed/);
});

test("recruiting respects the party cap and never repeats a person", () => {
  const g = underway();
  const e = env(g);
  applyEffects(e, [{ t: "recruit", id: "mattie" }], []);
  assert.ok(g.s.party.some((m) => m.id === "mattie"));
  const size = g.s.party.length;
  applyEffects(e, [{ t: "recruit", id: "mattie" }], []);
  assert.equal(g.s.party.length, size, "same recruit cannot join twice");
  for (let i = 0; i < 10; i++) applyEffects(e, [{ t: "recruit" }], []);
  assert.ok(living(g.s).length <= TUNING.maxParty);
});

test("losing a wagon trims the cargo it carried", () => {
  const g = underway();
  g.s.res.rations = cargoCap(g.s) - 10;
  applyEffects(env(g), [{ t: "wagons", d: -1 }], []);
  assert.equal(g.s.train.wagons, TUNING.startWagons - 1);
  assert.ok(cargoUsed(g.s.res) <= cargoCap(g.s) + 1e-9);
});

test("tells are fair: they lean toward the truth, and frayed nerves misread", () => {
  const GENUINE = new Set([
    "The wound is days old. Someone bandaged it with care once, and then stopped being able to.",
    "He will not meet your eyes when you offer water. It looks like shame, not scheming.",
    "He asks for water first. Not food, not physic, not a ride.",
  ]);
  const TRAP = new Set([
    "His boots are clean. Wherever he limped from, it was not far.",
    "Fresh wheel ruts lead off the road into the trees behind him.",
    "His eyes are not on the wagons. They are on your rifles.",
  ]);
  const seen = { genuine: { pointsGenuine: 0, pointsTrap: 0 }, trap: { pointsGenuine: 0, pointsTrap: 0 } };
  const phantoms = { steady: 0, frayed: 0 };
  for (let i = 0; i < 400; i++) {
    for (const mood of ["steady", "frayed"] as const) {
      const g = underway(1000 + i);
      for (const m of g.s.party) m.nerve = mood === "steady" ? 100 : 5;
      const inst = buildScene(env(g), { t: "scene", id: "wounded-traveler" });
      for (const t of inst.tells) t.revealed = true; // a very patient observer
      for (const t of inst.tells) {
        if (t.phantom) phantoms[mood]++;
        if (mood !== "steady") continue;
        const bucket = seen[inst.truth as "genuine" | "trap"];
        if (GENUINE.has(t.text)) bucket.pointsGenuine++;
        if (TRAP.has(t.text)) bucket.pointsTrap++;
      }
    }
  }
  assert.ok(seen.genuine.pointsGenuine > seen.genuine.pointsTrap * 2, "genuine situations mostly show genuine tells");
  assert.ok(seen.trap.pointsTrap > seen.trap.pointsGenuine * 2, "traps mostly show trap tells");
  assert.equal(phantoms.steady, 0, "a steady mind is not fooled by its own senses");
  assert.ok(phantoms.frayed > 0, "a frayed mind sometimes is");
});

test("resolving an option applies its cost, its time, and a truth-dependent outcome", () => {
  const g = underway(11);
  const e = env(g);
  // Force the truth so the test is exact.
  const inst = buildScene(e, { t: "scene", id: "mother-and-child" });
  inst.truth = "genuine";
  const med = g.s.res.medicine;
  const hours = g.s.today.hoursUsed;
  const r = resolveOption(e, inst, "physic");
  assert.ok(g.s.res.medicine <= med - 1, "the up-front cost is always paid");
  assert.ok(g.s.today.hoursUsed > hours, "and so is the time");
  assert.ok(r.lines[0].length > 10);

  const h = underway(11);
  const eh = env(h);
  const trap = buildScene(eh, { t: "scene", id: "mother-and-child" });
  trap.truth = "trap";
  resolveOption(eh, trap, "physic");
  assert.ok(h.s.queue.some((q) => q.t === "combat"), "a trap sends something at you");
});

test("a crooked keeper short-weights you until you check the scales", () => {
  const rigged = underway(9);
  rigged.s.scrip = 200;
  rigged.s.pending = { kind: "store", storeId: "wayhouse" };
  rigged.s.stock["wayhouse"] = { rations: 60, torches: 20, ammo: 40, medicine: 6, spares: 4, veils: 8, rockets: 4 };
  const screen = rigged.screen();
  assert.ok(screen.lines.some((l) => /thumb/.test(l)), "there is a fair-play tell");
  assert.ok(screen.options.some((o) => o.id === "inspect" && o.hours === 1));
  const before = rigged.s.res.rations;
  rigged.trade("rations", 20);
  assert.equal(rigged.s.res.rations - before, 16, "20 paid for, 16 delivered");

  const honest = underway(9);
  honest.s.scrip = 200;
  honest.s.pending = { kind: "store", storeId: "wayhouse" };
  honest.s.stock["wayhouse"] = { rations: 60, torches: 20, ammo: 40, medicine: 6, spares: 4, veils: 8, rockets: 4 };
  const carry = honest.s.carryHours;
  honest.choose("inspect");
  assert.equal(honest.s.carryHours, carry + 1, "checking costs an hour");
  assert.ok(!honest.screen().options.some((o) => o.id === "inspect"), "the check is a one-time thing");
  const held = honest.s.res.rations;
  honest.trade("rations", 20);
  assert.equal(honest.s.res.rations - held, 20, "after the check, honest weight");
  // Torches were never rigged.
  const torches = honest.s.res.torches;
  rigged.trade("torches", 5);
  assert.equal(rigged.s.res.torches - torches, 5);
});

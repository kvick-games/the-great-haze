import { test } from "node:test";
import assert from "node:assert/strict";
import { Game } from "../src/game/game.ts";
import { runBot } from "../tools/bots.ts";
import type { RunResult, Strategy } from "../tools/bots.ts";
import { cargoCap, cargoUsed, living } from "../src/game/party.ts";
import { TUNING } from "../src/game/tuning.ts";
import { SCENES } from "../src/game/content/scenes/index.ts";
import type { GameState } from "../src/game/types.ts";

function checkInvariants(s: GameState, lastMiles: number, where: string): void {
  for (const [id, v] of Object.entries(s.res)) {
    assert.ok(Number.isInteger(v) && v >= 0, `${where}: ${id} is ${v}`);
  }
  assert.ok(Number.isInteger(s.scrip) && s.scrip >= 0, `${where}: scrip is ${s.scrip}`);
  assert.ok(cargoUsed(s.res) <= cargoCap(s) + 1e-6, `${where}: cargo ${cargoUsed(s.res)} exceeds ${cargoCap(s)}`);
  assert.ok(Number.isFinite(s.gap) && Number.isFinite(s.miles), `${where}: gap/miles not finite`);
  assert.ok(s.miles >= lastMiles - 1e-9 && s.miles <= TUNING.totalMiles + 1e-6, `${where}: miles ${s.miles}`);
  assert.ok(s.train.wagons >= 1 && s.train.condition >= 0 && s.train.condition <= 100, `${where}: train ${JSON.stringify(s.train)}`);
  assert.equal(s.party.filter((m) => m.isLeader).length, 1, `${where}: exactly one leader`);
  assert.ok(living(s).length <= TUNING.maxParty, `${where}: party over cap`);
  for (const m of s.party) {
    assert.ok(Number.isFinite(m.health) && Number.isFinite(m.nerve) && Number.isFinite(m.trust), `${where}: ${m.id} has NaN stats`);
    if (!m.alive) {
      assert.ok(m.fate, `${where}: ${m.id} is gone without a fate`);
      continue;
    }
    assert.ok(m.health >= 0 && m.health <= m.maxHealth + 1e-9, `${where}: ${m.id} health ${m.health}`);
    assert.ok(m.nerve >= 0 && m.nerve <= 100, `${where}: ${m.id} nerve ${m.nerve}`);
    assert.ok(m.trust >= 0 && m.trust <= 100, `${where}: ${m.id} trust ${m.trust}`);
    assert.ok(m.fog >= 0 && m.fog <= 3, `${where}: ${m.id} fog ${m.fog}`);
    if (m.dying) assert.ok(m.dyingSince !== undefined, `${where}: ${m.id} dying without a start day`);
  }
  for (const v of Object.values(s.bonds)) assert.ok(v >= -100 && v <= 100);
}

const STRATEGIES: Strategy[] = ["random", "reckless", "samaritan", "cautious"];

test("invariants hold on every step of many runs, and no screen is ever a dead end", () => {
  for (const strategy of STRATEGIES) {
    for (let seed = 1; seed <= 25; seed++) {
      let lastMiles = 0;
      let steps = 0;
      const result = runBot(strategy, seed, {}, 6000, (game, screen) => {
        steps++;
        const where = `${strategy}#${seed}@${steps} (${screen.kind}:${screen.title})`;
        checkInvariants(game.s, lastMiles, where);
        lastMiles = game.s.miles;
        assert.ok(screen.options.some((o) => !o.disabled), `${where}: no enabled option (soft-lock)`);
        const rngBefore = game.s.rng;
        game.screen();
        assert.equal(game.s.rng, rngBefore, `${where}: building a screen consumed randomness`);
      });
      checkInvariants(result.state, lastMiles, `${strategy}#${seed} final`);
      assert.ok(result.state.ending, "every run ends");
      assert.ok(result.state.ending!.lines.length > 0);
    }
  }
});

test("runs are deterministic: the same seed and choices give the same journey", () => {
  for (const strategy of STRATEGIES) {
    const a = runBot(strategy, 77);
    const b = runBot(strategy, 77);
    assert.equal(JSON.stringify(a.state), JSON.stringify(b.state), `${strategy} run diverged`);
  }
  const x = runBot("cautious", 1);
  const y = runBot("cautious", 2);
  assert.notEqual(JSON.stringify(x.state), JSON.stringify(y.state), "different seeds should differ");
});

function firstEnabled(game: Game): string {
  const screen = game.screen();
  if (screen.kind === "store") return "depart";
  return (screen.options.find((o) => !o.disabled) ?? screen.options[0]).id;
}

test("a run can be saved mid-journey and resumed with no drift", () => {
  const setup = (): Game => {
    const g = Game.create({ seed: 31, leaderName: "Jo", background: "nurse", companions: ["ines", "dov", "cutter", "wren"] });
    g.trade("rations", 110);
    g.trade("torches", 10);
    g.trade("ammo", 16);
    g.trade("medicine", 4);
    return g;
  };
  const straight = setup();
  const resumed = setup();
  let steps = 0;
  while (!straight.over && steps < 4000) {
    steps++;
    straight.choose(firstEnabled(straight));
  }
  // Same run, but round-tripped through JSON every 25 steps.
  let game = resumed;
  let n = 0;
  while (!game.over && n < 4000) {
    n++;
    game.choose(firstEnabled(game));
    if (n % 25 === 0) game = Game.restore(game.serialize());
  }
  assert.equal(n, steps);
  assert.equal(game.serialize(), straight.serialize());
});

// ---------------------------------------------------------------------------
// Design pillars, measured
// ---------------------------------------------------------------------------

function batch(strategy: Strategy, runs: number): RunResult[] {
  const out: RunResult[] = [];
  for (let seed = 1; seed <= runs; seed++) out.push(runBot(strategy, seed));
  return out;
}
const rate = (rs: RunResult[], f: (r: RunResult) => boolean) => rs.filter(f).length / rs.length;
const avg = (rs: RunResult[], f: (r: RunResult) => number) => rs.reduce((n, r) => n + f(r), 0) / rs.length;

test("pillar: discernment beats both reflexive kindness and reflexive suspicion", () => {
  const runs = 120;
  const cautious = batch("cautious", runs);
  const samaritan = batch("samaritan", runs);
  const reckless = batch("reckless", runs);
  const random = batch("random", runs);
  const win = (r: RunResult) => r.kind === "victory";
  const c = rate(cautious, win);
  const s = rate(samaritan, win);
  const r = rate(reckless, win);
  const x = rate(random, win);
  assert.ok(c >= 0.2, `careful play should be winnable (won ${c})`);
  assert.ok(c >= s + 0.08, `careful play (${c}) should clearly beat always-helping (${s})`);
  assert.ok(s >= r, `always-helping (${s}) should still beat never-stopping (${r})`);
  assert.ok(r <= 0.12, `never stopping should rarely win (${r})`);
  assert.ok(x <= 0.05, `random play should almost never win (${x})`);

  // Kindness is exploited: helpers spring traps regularly. Coldness leaves real people behind.
  assert.ok(avg(samaritan, (q) => q.state.stats.trapsSprung) >= 3, "always-helping gets tricked often");
  assert.ok(avg(reckless, (q) => q.state.stats.genuineTurnedAway) >= 2, "never-stopping abandons real people");

  // Resources are tight: a majority of careful runs still go hungry at some point, but not all.
  const hungry = rate(cautious, (q) => q.state.stats.daysNoRations > 0);
  assert.ok(hungry >= 0.25 && hungry <= 0.85, `food should be tight but not hopeless (${hungry} of careful runs ran dry)`);

  // Stopping costs: careful players spend far more hours on the side of the road than reckless ones.
  assert.ok(avg(cautious, (q) => q.state.stats.hoursLost) > avg(reckless, (q) => q.state.stats.hoursLost) * 2);

  // All three endings are reachable.
  const all = [...cautious, ...samaritan, ...reckless, ...random];
  for (const kind of ["victory", "consumed", "lost"]) assert.ok(all.some((q) => q.kind === kind), `no run ended in ${kind}`);
});

test("coverage: the bots see nearly all of the content", () => {
  const seen = new Set<string>();
  for (const strategy of STRATEGIES) {
    for (let seed = 1; seed <= 60; seed++) {
      runBot(strategy, seed, {}, 6000, (game) => {
        const p = game.s.pending;
        if (p.kind === "scene") seen.add(p.scene.id);
      });
    }
  }
  const missing = SCENES.filter((d) => !seen.has(d.id)).map((d) => d.id);
  assert.ok(missing.length <= Math.ceil(SCENES.length * 0.1), `bots never reached: ${missing.join(", ")}`);
  for (const id of ["ninefold-crossing", "glass-fork", "saint-ambrose", "toll-gate", "the-gate", "last-stand", "turned", "breakdown", "deserter"]) {
    assert.ok(seen.has(id), `scene ${id} was never reached`);
  }
});

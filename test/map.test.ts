import { test } from "node:test";
import assert from "node:assert/strict";
import { Game } from "../src/game/game.ts";
import type { GameState } from "../src/game/types.ts";
import { EDGES, MAP_OFFERS, NODES, NODE_BY_ID, OFFER_BY_ID, mainLength, outEdges } from "../src/game/routes.ts";
import { STORES } from "../src/game/world.ts";
import { accuracyOf, makeMapCopy, offerClues, priceOf } from "../src/game/map.ts";
import { sceneById } from "../src/game/content/scenes/index.ts";
import { chooseOption, makeRand, shop } from "../tools/bots.ts";

const COMPANIONS = ["ines", "dov", "cutter", "wren"];

function newGame(seed: number): Game {
  return Game.create({ seed, leaderName: "Jo", background: "surveyor", companions: COMPANIONS });
}

/** Play with the cautious bot until `stop` says so (or fail). */
function driveUntil(game: Game, stop: (g: Game) => boolean, rand = makeRand(99), limit = 3000, strategy: "cautious" | "samaritan" = "cautious"): void {
  let first = game.s.day === 0 && game.s.pending.kind === "store";
  for (let i = 0; i < limit && !game.over; i++) {
    if (stop(game)) return;
    if (game.s.pending.kind === "store") {
      shop(game, strategy, first);
      first = false;
    }
    game.choose(chooseOption(game, strategy, rand));
  }
  assert.ok(stop(game), "did not reach the wanted state");
}

const atForkNode = (node: string) => (g: Game) => g.s.pending.kind === "fork" && g.s.route.node === node;

function seedWhere(offerId: string, acc: "faithful" | "careless" | "misleading"): number {
  const offer = OFFER_BY_ID.get(offerId)!;
  for (let seed = 1; seed < 500; seed++) if (accuracyOf(seed, offer) === acc) return seed;
  throw new Error("no such seed");
}

test("the route graph is well formed and every route lands near 840 miles", () => {
  assert.equal(mainLength(), 840);
  const forks = NODES.filter((n) => n.kind === "fork");
  assert.ok(forks.length >= 3 && forks.length <= 5, `expected 3-5 forks, found ${forks.length}`);
  for (const f of forks) {
    const outs = outEdges(f.id);
    assert.ok(outs.length >= 2 && outs.length <= 3, `${f.id} has ${outs.length} roads`);
    assert.equal(new Set(outs.map((e) => e.to)).size, 1, `${f.id} roads must rejoin`);
    assert.equal(outs.filter((e) => e.main).length, 1, `${f.id} needs exactly one main road`);
    // Real trade-offs: no fork has two roads that are the same in every respect.
    const sig = outs.map((e) => [e.miles, e.danger, e.speed ?? 1, e.hazeMult ?? 1, e.wear ?? 1, e.forage ?? 1, !!e.cache].join("/"));
    assert.equal(new Set(sig).size, outs.length, `${f.id} has interchangeable roads`);
  }
  for (const n of NODES) {
    assert.ok(n.x >= 0 && n.x <= 1 && n.y >= 0 && n.y <= 1, `${n.id} off the map`);
    if (n.kind !== "end") assert.ok(outEdges(n.id).length >= 1, `${n.id} is a dead end`);
    if (n.storeId) assert.ok(STORES[n.storeId], `${n.id}: missing store ${n.storeId}`);
    if (n.scene) assert.ok(sceneById(n.scene), `${n.id}: missing scene ${n.scene}`);
  }
  for (const e of EDGES) {
    assert.ok(NODE_BY_ID.has(e.from) && NODE_BY_ID.has(e.to), e.id);
    for (const b of e.beats ?? []) assert.ok(sceneById(b.scene), `${e.id}: missing scene ${b.scene}`);
  }
  for (const o of MAP_OFFERS) {
    assert.ok(STORES[o.storeId], o.id);
    assert.ok(NODE_BY_ID.has(o.fromNode), o.id);
  }
  // Every combination of roads.
  let totals: number[] = [0];
  for (const n of NODES) {
    const outs = outEdges(n.id);
    if (!outs.length) continue;
    totals = totals.flatMap((t) => outs.map((e) => t + e.miles));
  }
  assert.ok(totals.length >= 24, "a good number of distinct routes");
  for (const t of totals) assert.ok(t >= 790 && t <= 880, `route of ${t} miles`);
});

test("a fork offers the player's map's description of each road, with stable choice ids", () => {
  const game = newGame(5);
  driveUntil(game, atForkNode("crows-parting"), makeRand(99), 3000, "samaritan");
  const screen = game.screen();
  assert.equal(screen.kind, "fork");
  assert.equal(screen.title, "Crow's Parting");
  const routes = screen.fork!.routes;
  assert.equal(routes.length, 3);
  assert.deepEqual(
    screen.options.map((o) => o.id),
    ["route:f1-company-road", "route:f1-drovers-cut", "route:f1-river-track"],
  );
  assert.deepEqual(routes.map((r) => r.id), screen.options.map((o) => o.id));
  // The rough default map knows lengths and nothing else.
  for (const r of routes) {
    assert.equal(r.source, "rough");
    assert.equal(r.danger, null);
    assert.equal(r.twist, "unknown");
    assert.equal(r.miles % 10, 0);
  }
  assert.ok(screen.observations.length === 3, "signs are visible at the fork");
  const map = screen.hud.map;
  assert.equal(map.position.atFork, true);
  assert.equal(map.position.node, "crows-parting");
  assert.equal(map.position.edge, null);
  const before = game.s.miles;
  const next = game.choose("route:f1-company-road");
  assert.equal(next.kind, "result");
  assert.equal(game.s.route.edge, "f1-company-road");
  assert.ok(game.s.miles >= before, "the rest of the day's travel is spent on the chosen road");
  game.choose("continue");
  assert.ok(game.s.route.path.includes("f1-company-road"));
  assert.throws(() => game.choose("route:not-a-road"));
});

test("hud().map is pure data in map space", () => {
  const game = newGame(8);
  driveUntil(game, (g) => g.s.route.edge === "e-tallow-pike");
  const map = game.hud().map;
  assert.ok(map.nodes.length >= 10);
  for (const n of map.nodes) {
    assert.ok(n.x >= 0 && n.x <= 1 && n.y >= 0 && n.y <= 1, n.id);
    assert.equal(typeof n.visited, "boolean");
  }
  for (const e of map.edges) {
    assert.ok(map.nodes.some((n) => n.id === e.from) && map.nodes.some((n) => n.id === e.to), e.id);
    for (const p of e.via) assert.ok(p[0] >= 0 && p[0] <= 1 && p[1] >= 0 && p[1] <= 1);
  }
  const pos = map.position;
  assert.equal(pos.edge, "e-tallow-pike");
  assert.ok(pos.fraction > 0 && pos.fraction < 1);
  assert.ok(pos.x >= 0 && pos.x <= 1 && pos.y >= 0 && pos.y <= 1);
  assert.ok(map.nodes.find((n) => n.id === "drovers-rest")!.visited);
  assert.deepEqual(map.wrong, []);
  // Plain JSON.
  assert.deepEqual(JSON.parse(JSON.stringify(map)), map);
  assert.ok(game.hud().milesToGo < 840 && game.hud().milesToGo > 700);
  assert.equal(game.hud().regionId, "tallow");
});

test("maps for sale carry hidden accuracy, honest prices and fair clues", () => {
  // Across seeds every accuracy occurs, and worse maps cost less.
  for (const offer of MAP_OFFERS) {
    const seen = new Set<string>();
    for (let seed = 1; seed < 200; seed++) {
      const acc = accuracyOf(seed, offer);
      seen.add(acc);
      if (acc === "misleading") assert.ok(priceOf(seed, offer) < offer.price * 0.6, "a misleading map is priced too well");
    }
    assert.equal(seen.size, 3, `${offer.id} should vary by seed`);
  }
  const game = newGame(seedWhere("survey-old", "careless"));
  const store = game.screen();
  assert.equal(store.kind, "store");
  const offers = store.store!.maps!;
  assert.equal(offers.length, 1);
  assert.equal(offers[0].id, "survey-old");
  assert.ok(offers[0].clues.length >= 2, "clues to weigh before paying");
  assert.ok(!JSON.stringify(store).includes("careless"), "accuracy is never shown");
  const buy = store.options.find((o) => o.id === "buymap:survey-old")!;
  assert.ok(buy && !buy.disabled);
  const scrip = game.s.scrip;
  const rngBefore = game.s.rng;
  game.screen();
  assert.equal(game.s.rng, rngBefore, "looking at the shop consumes no randomness");
  const after = game.choose("buymap:survey-old");
  assert.equal(game.s.scrip, scrip - offers[0].price);
  assert.equal(game.s.route.maps.length, 1);
  assert.equal(after.hud.map.maps[0].id, "survey-old");
  assert.ok(after.hud.map.edges.some((e) => e.source === "survey-old"));
  assert.ok(after.store!.maps![0].owned);
  assert.throws(() => game.choose("buymap:survey-old"), /unavailable/);
});

test("clues are fair: they mostly point at the truth, and sometimes do not", () => {
  let toward = 0;
  let against = 0;
  let noise = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const g = newGame(seed);
    for (const offer of MAP_OFFERS) {
      const acc = accuracyOf(seed, offer);
      for (const c of offerClues(g.s, offer)) {
        if (c.shows === "noise") noise++;
        else if (c.shows === acc) toward++;
        else against++;
      }
    }
  }
  assert.ok(toward > against * 2, `clues should mostly be honest (${toward} vs ${against})`);
  assert.ok(against > 0, "and now and then a clue misleads");
  assert.ok(noise >= 0);
});

test("a misleading map is believed until the land says otherwise", () => {
  const seed = seedWhere("survey-old", "misleading");
  const game = newGame(seed);
  // Put the map in hand directly (the shop is tested above) and set out.
  game.s.route.maps.push(makeMapCopy(seed, OFFER_BY_ID.get("survey-old")!));
  driveUntil(game, atForkNode("crows-parting"));
  const screen = game.screen();
  const cut = screen.fork!.routes.find((r) => r.id === "route:f1-drovers-cut")!;
  const company = screen.fork!.routes.find((r) => r.id === "route:f1-company-road")!;
  const noPhantom = screen.fork!.routes.length;
  // Depending on the roll, the lie may be stamped on this road or not; the phantom always is.
  assert.equal(noPhantom, 4, "a misleading map adds a road that is not there");
  assert.equal(cut.source, "survey-old");
  assert.ok(company.source === "survey-old");
  assert.equal(game.s.route.wrong.length, 0);

  // The phantom: pick it, find nothing, lose hours, choose again.
  const phantom = screen.fork!.routes.find((r) => r.id.startsWith("route:ph-"))!;
  const carry = game.s.carryHours;
  const missed = game.choose(phantom.id);
  assert.equal(missed.kind, "result");
  assert.equal(missed.title, "No such road");
  assert.ok(game.s.carryHours >= carry + 3.9 || game.s.carryHours >= 5.9, "time is lost");
  assert.equal(game.s.route.wrong.length, 1);
  assert.equal(game.s.route.wrong[0].kind, "route");
  const again = game.choose("continue");
  assert.equal(again.kind, "fork");
  assert.equal(again.fork!.routes.length, 3, "the phantom road is struck from the map");
  assert.equal(again.hud.map.edges.find((e) => e.id === phantom.id.slice(6))?.wrong, true);
});

test("a road that differs from the map reveals itself with a scene, and costs something", () => {
  // Force the situation: a map that swears the Drovers' Cut is clear and quick.
  const game = newGame(12);
  driveUntil(game, atForkNode("crows-parting"));
  const seed = game.s.seed;
  const lying = makeMapCopy(seed, OFFER_BY_ID.get("survey-old")!);
  lying.accuracy = "misleading";
  lying.claims["f1-drovers-cut"] = { miles: 36, danger: 1, twist: "clear", note: "Quick cut through Harrow's End: a market, a well, a bed." };
  lying.phantoms = [];
  game.s.route.maps.push(lying);
  const shown = game.screen().fork!.routes.find((r) => r.id === "route:f1-drovers-cut")!;
  assert.equal(shown.danger, 1);
  assert.equal(shown.twist, "clear");
  game.choose("route:f1-drovers-cut");
  const hoursBefore = game.s.stats.hoursLost;
  const foodBefore = game.s.res.rations;
  // Walk on until the burned village.
  driveUntil(game, (g) => g.s.pending.kind === "scene" && g.s.pending.scene.id === "route-harrow", makeRand(3));
  assert.equal(game.s.flags["route:prepared"], 0, "the map did not warn the train");
  const wrong = game.hud().map.wrong;
  assert.equal(wrong.length >= 1, true);
  assert.ok(wrong.some((w) => w.truth.includes("burned")), "the belief that was wrong is named");
  assert.ok(game.hud().map.edges.find((e) => e.id === "f1-drovers-cut")!.wrong);
  // Resolve it: searching costs hours.
  const scene = game.screen();
  const search = scene.options.find((o) => o.id === "search")!;
  assert.equal(search.hours, 3, "a surprised train loses the full three hours");
  game.choose("search");
  assert.ok(game.s.stats.hoursLost >= hoursBefore + 3 || game.s.res.rations !== foodBefore);
  // The same scene costs less when the map told the truth.
  const honest = newGame(12);
  driveUntil(honest, atForkNode("crows-parting"));
  const truth = makeMapCopy(honest.s.seed, OFFER_BY_ID.get("survey-old")!);
  truth.accuracy = "faithful";
  for (const e of EDGES) truth.claims[e.id] = { miles: e.miles, danger: e.danger, twist: e.id === "f1-drovers-cut" ? "known" : "clear" };
  truth.phantoms = [];
  honest.s.route.maps.push(truth);
  honest.choose("route:f1-drovers-cut");
  driveUntil(honest, (g) => g.s.pending.kind === "scene" && g.s.pending.scene.id === "route-harrow", makeRand(3));
  assert.equal(honest.s.flags["route:prepared"], 1);
  assert.equal(honest.hud().map.wrong.length, 0, "nothing was wrong");
  assert.equal(honest.screen().options.find((o) => o.id === "search")!.hours, 2, "preparation saves an hour");
});

function fingerprint(g: Game): string {
  return JSON.stringify(g.s);
}

test("mid-route save and restore resumes with no drift, on a road and at a fork", () => {
  for (const stopAt of ["road", "fork"]) {
    const a = newGame(21);
    if (stopAt === "road") driveUntil(a, (g) => g.s.route.edge === "f1-company-road" || (g.s.route.edge === "e-tallow-pike" && g.s.route.along > 10));
    else driveUntil(a, atForkNode("crows-parting"));
    const b = Game.restore(a.serialize());
    assert.equal(fingerprint(a), fingerprint(b));
    const ra = makeRand(5);
    const rb = makeRand(5);
    for (let i = 0; i < 250 && !a.over; i++) {
      if (a.s.pending.kind === "store") {
        shop(a, "cautious", false);
        shop(b, "cautious", false);
      }
      const ida = chooseOption(a, "cautious", ra);
      const idb = chooseOption(b, "cautious", rb);
      assert.equal(ida, idb);
      a.choose(ida);
      b.choose(idb);
      assert.equal(fingerprint(a), fingerprint(b), `${stopAt}: diverged at step ${i}`);
    }
    assert.ok(a.s.miles > 100, "the journey went on");
  }
});

test("a save from before the route map still loads and plays on", () => {
  const g = newGame(31);
  driveUntil(g, (x) => x.s.day >= 6 && x.s.pending.kind === "plan");
  const old = JSON.parse(g.serialize()) as Partial<GameState>;
  delete old.route;
  const restored = Game.restore(JSON.stringify(old));
  const r = restored.s.route;
  assert.ok(r.edge || r.node !== "cinder-ford", "placed on the road by its odometer");
  assert.ok(Math.abs(restored.s.miles - g.s.miles) < 1e-9);
  const total = r.path.length > 0;
  assert.ok(total);
  const rand = makeRand(4);
  for (let i = 0; i < 200 && !restored.over; i++) {
    if (restored.s.pending.kind === "store") shop(restored, "cautious", false);
    restored.choose(chooseOption(restored, "cautious", rand));
  }
  assert.ok(restored.s.miles > g.s.miles);
  // An old save waiting at the retired Glass Cross arrival becomes a fork.
  const stale = JSON.parse(g.serialize()) as GameState;
  delete (stale as Partial<GameState>).route;
  stale.miles = 380;
  stale.pending = { kind: "arrival", id: "glass-fork" };
  const fixed = Game.restore(JSON.stringify(stale));
  assert.equal(fixed.s.pending.kind, "fork");
  assert.equal(fixed.screen().kind, "fork");
  assert.equal(fixed.screen().fork!.routes.length, 3);
});

test("the same seed makes the same maps, clues and journey", () => {
  const run = (): string => {
    const g = newGame(44);
    driveUntil(g, atForkNode("crows-parting"), makeRand(7));
    return JSON.stringify([g.s, g.screen()]);
  };
  assert.equal(run(), run());
  const a = newGame(44).screen().store!.maps![0];
  const b = newGame(44).screen().store!.maps![0];
  assert.deepEqual(a, b);
  const seeds = new Set<string>();
  for (let s = 1; s <= 40; s++) seeds.add(newGame(s).screen().store!.maps![0].clues.join("|"));
  assert.ok(seeds.size > 10, "clues vary between seeds");
});

test("every fork on the way can be walked to the Reach, whichever roads are chosen", () => {
  for (const pick of [0, 1, 2]) {
    const g = newGame(60 + pick);
    // Cheat the survival side so only the route is under test.
    g.s.res.rations = 400;
    g.s.gap = 500;
    const rand = makeRand(pick);
    let steps = 0;
    while (!g.over && steps++ < 4000) {
      const p = g.s.pending;
      if (p.kind === "fork") {
        const opts = g.screen().options.filter((o) => !o.disabled && !o.id.startsWith("route:ph-"));
        g.choose(opts[Math.min(pick, opts.length - 1)].id);
        continue;
      }
      g.s.gap = Math.max(g.s.gap, 200);
      for (const m of g.s.party) {
        m.health = m.maxHealth;
        m.nerve = 80;
        m.dying = false;
        m.fog = 0;
      }
      g.s.res.rations = Math.max(g.s.res.rations, 100);
      if (p.kind === "store") {
        g.choose("depart");
        continue;
      }
      g.choose(chooseOption(g, "cautious", rand));
    }
    assert.ok(g.over, "the run ended");
    assert.ok(g.s.route.visited.includes("the-gate"), `route ${pick} reached the Gate`);
    const len = g.s.miles;
    assert.ok(len > 780 && len < 890, `route ${pick}: ${len} miles`);
  }
});

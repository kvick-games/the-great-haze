// Headless players used to sanity-check the engine and the design pillar:
// resources are tight, stopping costs you, and neither reflexive kindness nor
// reflexive suspicion is a winning strategy. These read engine internals on
// purpose; they are dev tooling, not part of the game.

import { Game } from "../src/game/game.ts";
import type { NewGameOptions } from "../src/game/game.ts";
import type { GameState, ResourceId, Screen, ScreenOption } from "../src/game/types.ts";
import { sceneById } from "../src/game/content/scenes/index.ts";
import { ENEMIES } from "../src/game/content/enemies.ts";
import { living } from "../src/game/party.ts";
import { PACES } from "../src/game/tuning.ts";

export type Strategy = "random" | "reckless" | "samaritan" | "cautious";

interface Rand {
  next(): number;
}

export function makeRand(seed: number): Rand {
  let s = seed | 0;
  return {
    next() {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), s | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

const enabled = (o: ScreenOption): boolean => !o.disabled;

// Priority list for the first market: [item, target quantity].
const SHOPPING: Record<Strategy, [ResourceId, number][]> = {
  cautious: [
    ["rations", 100],
    ["torches", 14],
    ["ammo", 24],
    ["medicine", 5],
    ["spares", 1],
    ["rations", 130],
    ["veils", 3],
    ["torches", 18],
    ["spares", 2],
  ],
  samaritan: [
    ["rations", 100],
    ["medicine", 8],
    ["torches", 12],
    ["ammo", 14],
    ["spares", 1],
    ["rations", 140],
  ],
  reckless: [
    ["rations", 70],
    ["torches", 14],
    ["ammo", 30],
    ["spares", 2],
    ["medicine", 3],
    ["rations", 110],
  ],
  random: [
    ["rations", 80],
    ["torches", 10],
    ["ammo", 20],
    ["medicine", 3],
    ["spares", 1],
  ],
};

export function shop(game: Game, strategy: Strategy, first: boolean): void {
  if (first) {
    for (const [item, target] of SHOPPING[strategy]) {
      const have = game.s.res[item];
      if (have < target) game.trade(item, target - have);
    }
    return;
  }
  // Later stores: keep a small purse, spend the rest on food, then torches.
  const keep = strategy === "cautious" ? 20 : 0;
  const store = game.screen().store!;
  const price = (id: ResourceId) => store.lines.find((l) => l.id === id)!.price;
  const spend = (id: ResourceId, share: number) => {
    const budget = Math.floor((game.s.scrip - keep) * share);
    if (budget > price(id)) game.trade(id, Math.floor(budget / price(id)));
  };
  if (game.s.res.medicine < 3) spend("medicine", 0.2);
  if (game.s.res.torches < 8) spend("torches", 0.25);
  spend("rations", 0.9);
}

function tellScore(state: GameState, sceneId: string): number {
  const p = state.pending;
  if (p.kind !== "scene") return 0;
  const def = sceneById(sceneId);
  if (!def?.tells) return 0;
  let score = 0;
  for (const t of p.scene.tells) {
    if (!t.revealed) continue;
    const match = def.tells.find((d) => d.text === t.text);
    if (!match) continue;
    if (match.shows === "genuine") score += 1;
    else if (match.shows === "trap") score -= 1;
  }
  return score;
}

function pickHelp(options: ScreenOption[], state: GameState, prefer: "full" | "cheap"): ScreenOption | undefined {
  const p = state.pending;
  if (p.kind !== "scene") return undefined;
  const def = sceneById(p.scene.id)!;
  const helps = def.options.filter((o) => o.tag === "help").map((o) => o.id);
  const avail = options.filter((o) => enabled(o) && helps.includes(o.id));
  if (!avail.length) return undefined;
  return prefer === "full" ? avail[0] : avail[avail.length - 1];
}

function pickRefuse(options: ScreenOption[], state: GameState): ScreenOption | undefined {
  const p = state.pending;
  if (p.kind !== "scene") return undefined;
  const def = sceneById(p.scene.id)!;
  const refuse = def.options.filter((o) => o.tag === "refuse").map((o) => o.id);
  return options.find((o) => enabled(o) && refuse.includes(o.id));
}

function cheapest(options: ScreenOption[]): ScreenOption {
  const avail = options.filter((o) => enabled(o) && o.id !== "look");
  return avail.reduce((best, o) => ((o.hours ?? 0) < (best.hours ?? 0) ? o : best), avail[0]);
}

export function chooseOption(game: Game, strategy: Strategy, rand: Rand): string {
  const s = game.s;
  const screen: Screen = game.screen();
  const opts = screen.options.filter(enabled);
  const p = s.pending;

  if (strategy === "random" && p.kind !== "setup") {
    if (p.kind === "store") return "depart";
    return opts[Math.floor(rand.next() * opts.length)].id;
  }

  switch (p.kind) {
    case "setup": {
      if (p.picked.length < 4) {
        const remaining = opts.filter((o) => o.id.startsWith("pick:") && !o.label.startsWith("[x]"));
        return remaining[Math.floor(rand.next() * remaining.length)].id;
      }
      return "confirm";
    }
    case "store":
      return "depart";
    case "arrival": {
      const shopOpt = opts.find((o) => o.id === "shop");
      if (shopOpt && strategy !== "reckless") return "shop";
      return opts.find((o) => o.id === "move")!.id;
    }
    case "result":
      return "continue";
    case "plan": {
      // Tend the dying first.
      const dying = opts.find((o) => o.id.endsWith(":dying"));
      if (dying) return dying.id;
      if (strategy !== "reckless") {
        const wound = opts.find((o) => o.id.endsWith(":wound") && s.res.medicine >= 3);
        if (wound) return wound.id;
        const sick = opts.find((o) => o.id.endsWith(":sick") && s.res.medicine >= 3);
        if (sick) return sick.id;
      }
      const repair = opts.find((o) => o.id === "repair");
      if (repair && s.train.condition < (strategy === "reckless" ? 35 : 55)) return "repair";
      // Rations and pace.
      const mouths = living(s).length;
      const days = s.res.rations / Math.max(1, mouths * 0.7);
      const forageAt = strategy === "cautious" ? 5 : strategy === "samaritan" ? 3 : 0;
      if (forageAt && days < forageAt && opts.some((o) => o.id === "forage") && (s.flags["forage:today"] ?? 0) !== s.day) {
        s.flags["forage:today"] = s.day;
        return "forage";
      }
      const wantRations = days < 6 ? "bare" : days < 14 ? "meager" : strategy === "samaritan" ? "meager" : "meager";
      if (s.rations !== wantRations && opts.some((o) => o.id === `rations:${wantRations}`)) return `rations:${wantRations}`;
      let wantPace: keyof typeof PACES = "steady";
      if (strategy === "reckless") wantPace = "hard";
      else if (strategy === "cautious") {
        const nerve = living(s).reduce((n, m) => n + m.nerve, 0) / Math.max(1, mouths);
        wantPace = s.gap < 22 && nerve > 35 ? "hard" : "steady";
      }
      if (s.pace !== wantPace && opts.some((o) => o.id === `pace:${wantPace}`)) return `pace:${wantPace}`;
      return "go";
    }
    case "combat": {
      const def = ENEMIES[p.combat.enemy];
      const avgHp = living(s).reduce((n, m) => n + m.health / m.maxHealth, 0) / Math.max(1, living(s).length);
      const has = (id: string) => opts.some((o) => o.id === id);
      if (avgHp < 0.3 && has("flee")) return "flee";
      if (def.lightWeak && has("torch")) return "torch";
      if (has("rocket") && p.combat.round >= 2) return "rocket";
      if (has("fire")) return "fire";
      const pay = opts.find((o) => o.id.startsWith("pay-"));
      if (pay) return pay.id;
      if (has("hold")) return "hold";
      return "flee";
    }
    case "scene": {
      const def = sceneById(p.scene.id)!;
      if (def.kind === "stranger" || def.tells) return chooseStranger(game, strategy, screen.options, def.id);
      if (def.kind === "dispute") {
        if (strategy === "reckless") return opts.find((o) => o.id === "hush")?.id ?? cheapest(opts).id;
        if (opts.some((o) => o.id === "mediate")) return "mediate";
        return cheapest(opts).id;
      }
      if (def.id === "breakdown") {
        return opts.find((o) => o.id === "sedate")?.id ?? "run-after";
      }
      if (def.id === "turned") {
        return opts.find((o) => o.id === "cure")?.id ?? opts.find((o) => o.id === "mercy")?.id ?? "fight";
      }
      if (def.id === "fogsick-quarantine") return opts.find((o) => o.id === "treat")?.id ?? "isolate";
      if (def.id === "deserter") return opts.find((o) => o.id === "shame")?.id ?? "confront";
      if (def.id === "last-stand") {
        return opts.find((o) => o.id === "firebreak")?.id ?? (s.train.wagons > 1 ? "cut-wagon" : "volunteer");
      }
      if (def.id === "the-gate") {
        return opts.find((o) => o.id === "enter")?.id ?? opts.find((o) => o.id === "leave-marked")!.id;
      }
      if (def.kind === "landmark") {
        // Route choices: the cautious take the safe road, the reckless the fast one.
        if (def.id === "glass-fork") return strategy === "reckless" ? "rail" : "pilgrim";
        if (def.id === "toll-gate") return opts.find((o) => o.id === "pay")?.id ?? cheapest(opts).id;
        return cheapest(opts).id;
      }
      // Hazards, finds, haze events, oddities, respites.
      if (strategy === "reckless") return cheapest(opts).id;
      if (def.kind === "respite") return opts[0].id;
      return chooseHazard(game, opts);
    }
    default:
      throw new Error(`Bot cannot handle ${p.kind}`);
  }
}

function chooseHazard(game: Game, opts: ScreenOption[]): string {
  const s = game.s;
  // Prefer options that pay for themselves: finds with meaningful gains are worth
  // a few hours; otherwise take the quickest safe-ish answer.
  const p = s.pending;
  if (p.kind !== "scene") return opts[0].id;
  const def = sceneById(p.scene.id)!;
  if (def.kind === "find") {
    if (s.res.rations < living(s).length * 8) return opts[0].id; // desperate: gamble
    return cheapest(opts).id;
  }
  // Hazards: pick the cheapest in time that does not burn a critical resource.
  const scored = opts.map((o) => ({ o, cost: (o.hours ?? 0) + (o.hint?.includes("Costs") ? 1.5 : 0) }));
  scored.sort((a, b) => a.cost - b.cost);
  return scored[0].o.id;
}

function chooseStranger(game: Game, strategy: Strategy, options: ScreenOption[], sceneId: string): string {
  const s = game.s;
  const opts = options.filter(enabled);
  const p = s.pending;
  if (p.kind !== "scene") return opts[0].id;

  if (strategy === "reckless") return pickRefuse(opts, s)?.id ?? cheapest(opts).id;
  if (strategy === "samaritan") return pickHelp(opts, s, "full")?.id ?? pickRefuse(opts, s)?.id ?? cheapest(opts).id;

  // Cautious: look, weigh the tells, act.
  const look = opts.find((o) => o.id === "look");
  const score = tellScore(s, sceneId);
  const wantLooks = s.gap < 25 ? 1 : 2;
  if (look && p.scene.looks < wantLooks && Math.abs(score) < 2) return "look";
  const kind = living(s).length;
  const flush = s.res.rations > kind * 10;
  if (score >= 1) return pickHelp(opts, s, "full")?.id ?? pickRefuse(opts, s)?.id ?? cheapest(opts).id;
  if (score === 0 && flush) return pickHelp(opts, s, "cheap")?.id ?? pickRefuse(opts, s)?.id ?? cheapest(opts).id;
  return pickRefuse(opts, s)?.id ?? cheapest(opts).id;
}

export interface RunResult {
  seed: number;
  strategy: Strategy;
  kind: string;
  headline: string;
  day: number;
  miles: number;
  survivors: number;
  score: number;
  state: GameState;
  steps: number;
}

export type StepHook = (game: Game, screen: Screen, chosen: string) => void;

export function runBot(strategy: Strategy, seed: number, opts: Partial<NewGameOptions> = {}, maxSteps = 6000, onStep?: StepHook): RunResult {
  const rand = makeRand(seed * 7919 + 13);
  const game = Game.create({ seed, leaderName: "Bot", background: "surveyor", ...opts });
  let steps = 0;
  let first = true;
  while (!game.over && steps < maxSteps) {
    steps++;
    const kind = game.s.pending.kind;
    if (kind === "store") {
      shop(game, strategy, first);
      first = false;
    }
    const id = chooseOption(game, strategy, rand);
    onStep?.(game, game.screen(), id);
    game.choose(id);
  }
  if (!game.over) throw new Error(`Run did not finish in ${maxSteps} steps (seed ${seed}, ${strategy}); pending=${game.s.pending.kind}`);
  const e = game.s.ending!;
  return {
    seed,
    strategy,
    kind: e.kind,
    headline: e.headline,
    day: game.s.day,
    miles: Math.round(game.s.miles),
    survivors: living(game.s).length,
    score: e.score,
    state: game.s,
    steps,
  };
}


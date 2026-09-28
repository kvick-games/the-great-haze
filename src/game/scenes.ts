// The scene engine: a scene is a moment that demands a decision. Hazards,
// strangers, finds, disputes and crises all run through here. Content lives in
// content/scenes; this file interprets it.

import type {
  GameState,
  Member,
  OptionDef,
  Outcome,
  QueueItem,
  SceneDef,
  SceneInstance,
  ScreenOption,
  Truth,
} from "./types.ts";
import type { Env } from "./effects.ts";
import { allConds, applyEffects, evalCond, fillText, resolveWho } from "./effects.ts";
import { able, bond, byId, firstName, hasTrait, living, perception } from "./party.ts";
import { hoursToMiles } from "./travel.ts";
import { sceneById } from "./content/scenes/index.ts";
import { ITEMS } from "./tuning.ts";

export function requireScene(id: string): SceneDef {
  const def = sceneById(id);
  if (!def) throw new Error(`Unknown scene: ${id}`);
  return def;
}

// ---------------------------------------------------------------------------
// Building a scene instance
// ---------------------------------------------------------------------------

function observerScore(m: Member): number {
  let score = 0;
  if (m.role === "scout") score += 2;
  if (hasTrait(m, "paranoid")) score += 1.5;
  if (hasTrait(m, "veteran")) score += 0.5;
  if (m.role === "medic") score += 0.25;
  return score + perception(m) * 0.5;
}

export function bestObserver(s: GameState): Member | undefined {
  const pool = able(s);
  if (!pool.length) return undefined;
  return pool.reduce((best, m) => (observerScore(m) > observerScore(best) ? m : best));
}

function observerBonus(m: Member | undefined): number {
  if (!m) return 0;
  return (m.role === "scout" ? 2 : 0) + (hasTrait(m, "paranoid") ? 1.5 : 0);
}

function pickPair(env: Env, def: SceneDef): { a: string; b: string } | undefined {
  if (!def.pairWeight) return undefined;
  const ms = living(env.s).filter((m) => !m.isLeader);
  const pairs: { a: Member; b: Member; w: number }[] = [];
  for (const a of ms) {
    for (const b of ms) {
      if (a.id === b.id) continue;
      const w = def.pairWeight(a, b, bond(env.s, a.id, b.id));
      if (w > 0) pairs.push({ a, b, w });
    }
  }
  const chosen = env.rng.weighted(pairs, (p) => p.w);
  return chosen ? { a: chosen.a.id, b: chosen.b.id } : undefined;
}

/** True if a dispute scene has at least one eligible pair right now. */
export function hasPair(env: Env, def: SceneDef): boolean {
  if (!def.pairWeight) return true;
  const ms = living(env.s).filter((m) => !m.isLeader);
  for (const a of ms) for (const b of ms) if (a.id !== b.id && def.pairWeight(a, b, bond(env.s, a.id, b.id)) > 0) return true;
  return false;
}

function revealTells(env: Env, inst: SceneInstance, count: number): string[] {
  const observer = byId(env.s, inst.observer);
  const def = requireScene(inst.id);
  const hidden = inst.tells.filter((t) => !t.revealed);
  const order = env.rng.shuffle(hidden);
  const shown: string[] = [];
  for (const t of order.slice(0, count)) {
    t.revealed = true;
    shown.push(t.text);
    const pPhantom = observer ? (1 - perception(observer)) * 0.6 : 0;
    if (pPhantom > 0 && env.rng.chance(pPhantom)) {
      // A frayed mind misreads the scene. Swap in a tell that points the wrong way.
      const wrongTruth: Truth = inst.truth === "genuine" ? "trap" : "genuine";
      const decoys = (def.tells ?? []).filter((d) => d.shows === wrongTruth);
      if (decoys.length) {
        t.text = env.rng.pick(decoys).text;
        t.phantom = true;
      } else {
        t.text = "For a moment {other}'s face is one you used to know.";
        t.phantom = true;
      }
    }
  }
  return shown;
}

export function buildScene(env: Env, item: Extract<QueueItem, { t: "scene" }>): SceneInstance {
  const def = requireScene(item.id);
  const s = env.s;
  const inst: SceneInstance = {
    id: def.id,
    truth: "none",
    actor: item.actor,
    a: item.a,
    b: item.b,
    tells: [],
    looks: 0,
  };
  env.bind = { actor: item.actor, a: item.a, b: item.b };
  if (def.pairWeight && !(inst.a && inst.b)) {
    const pair = pickPair(env, def);
    if (pair) {
      inst.a = pair.a;
      inst.b = pair.b;
    }
  }
  env.bind.a = inst.a;
  env.bind.b = inst.b;
  // Actor defaults to one of the pair for disputes, otherwise a random able member.
  if (!env.bind.actor && inst.a) env.bind.actor = inst.a;
  const actorList = resolveWho(env, "actor");
  inst.actor = actorList[0]?.id;
  const otherList = resolveWho(env, "other");
  inst.other = otherList[0]?.id ?? inst.b;
  env.bind.other = inst.other;
  if (def.tells && def.tells.length) {
    inst.truth = env.rng.chance(def.genuineOdds ?? 0.5) ? "genuine" : "trap";
    for (const t of def.tells) {
      let present = false;
      if (t.shows === inst.truth) present = env.rng.chance(t.p ?? 0.65);
      else if (t.shows === "noise") present = env.rng.chance(t.p ?? 0.4);
      if (present) inst.tells.push({ text: t.text, revealed: false });
    }
    const observer = bestObserver(s);
    inst.observer = observer?.id;
    if (inst.tells.length && env.rng.chance(0.75)) revealTells(env, inst, observerBonus(observer) >= 2 ? 2 : 1);
  }
  return inst;
}

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

export function bindFor(inst: SceneInstance): Env["bind"] {
  return { actor: inst.actor, other: inst.other, a: inst.a, b: inst.b };
}

export function optionHours(env: Env, opt: OptionDef): number {
  let h = opt.hours ?? 0;
  if (opt.hoursMod && evalCond(env, opt.hoursMod.if)) h = h * (opt.hoursMod.mult ?? 1) + (opt.hoursMod.add ?? 0);
  return Math.max(0, Math.round(h * 2) / 2);
}

function costText(cost: OptionDef["cost"]): string {
  if (!cost) return "";
  const parts: string[] = [];
  for (const [k, v] of Object.entries(cost)) {
    if (!v) continue;
    parts.push(k === "scrip" ? `${v} scrip` : `${v} ${ITEMS[k as keyof typeof ITEMS]?.name.toLowerCase() ?? k}`);
  }
  return parts.length ? `Costs ${parts.join(", ")}` : "";
}

function canAfford(env: Env, cost: OptionDef["cost"]): boolean {
  if (!cost) return true;
  for (const [k, v] of Object.entries(cost)) {
    if (!v) continue;
    if (k === "scrip") {
      if (env.s.scrip < v) return false;
    } else if (env.s.res[k as keyof typeof env.s.res] < v) return false;
  }
  return true;
}

export const MAX_LOOKS = 3;

export function sceneOptions(env: Env, inst: SceneInstance): ScreenOption[] {
  const def = requireScene(inst.id);
  env.bind = bindFor(inst);
  const out: ScreenOption[] = [];
  if (def.tells && def.tells.length) {
    const observer = byId(env.s, inst.observer);
    const spent = inst.looks >= MAX_LOOKS;
    out.push({
      id: "look",
      label: "Look closer",
      hint: spent
        ? "You have seen all there is to see."
        : `${observer ? firstName(observer) : "Someone"} studies the scene. Takes an hour; the Haze does not wait.`,
      hours: 1,
      disabled: spent ? "Nothing more to see." : undefined,
    });
  }
  for (const opt of def.options) {
    // An option that names its own actor (the hunter, the scout...) is labelled with that person.
    const optEnv: Env = { s: env.s, rng: env.rng, bind: { ...bindFor(inst) } };
    if (opt.actor) {
      const who = resolveWho(optEnv, opt.actor)[0];
      if (who) optEnv.bind.actor = who.id;
    }
    const requiresOk = allConds(env, opt.requires);
    const affordable = canAfford(env, opt.cost);
    const hint = [fillText(optEnv, opt.hint ?? ""), costText(opt.cost)].filter(Boolean).join(" ");
    out.push({
      id: opt.id,
      label: fillText(optEnv, opt.label),
      hint: hint || undefined,
      hours: optionHours(env, opt),
      disabled: !requiresOk ? (opt.why ?? "Not available.") : !affordable ? "You cannot afford it." : undefined,
    });
  }
  return out;
}

export function sceneText(env: Env, inst: SceneInstance): { lines: string[]; observations: string[] } {
  const def = requireScene(inst.id);
  env.bind = bindFor(inst);
  return {
    lines: def.intro.map((l) => fillText(env, l)),
    observations: inst.tells.filter((t) => t.revealed).map((t) => fillText(env, t.text)),
  };
}

// ---------------------------------------------------------------------------
// Resolving a choice
// ---------------------------------------------------------------------------

function pickOutcome(env: Env, outcomes: Outcome[]): Outcome {
  const chosen = env.rng.weighted(outcomes, (o) => {
    let w = o.weight ?? 1;
    for (const m of o.mods ?? []) if (evalCond(env, m.if)) w += m.add;
    return w;
  });
  return chosen ?? outcomes[outcomes.length - 1];
}

export interface SceneResult {
  title: string;
  lines: string[];
  notes: string[];
  /** True if the scene stays open (a "look closer"). */
  stay: boolean;
}

export function doLook(env: Env, inst: SceneInstance): void {
  env.bind = bindFor(inst);
  env.s.today.hoursUsed += 1;
  env.s.stats.hoursLost += 1;
  const observer = byId(env.s, inst.observer);
  inst.looks++;
  const hadHidden = inst.tells.some((t) => !t.revealed);
  const bonus = observerBonus(observer) >= 2 ? 2 : 1;
  const shown = revealTells(env, inst, bonus);
  const who = observer ? firstName(observer) : "Someone";
  if (shown.length) inst.note = `${who} watches for an hour and notices more.`;
  else if (hadHidden) inst.note = `${who} watches for an hour.`;
  else inst.note = `${who} watches for an hour and sees nothing new. That may itself mean something.`;
}

export function resolveOption(env: Env, inst: SceneInstance, optionId: string): SceneResult {
  const def = requireScene(inst.id);
  const opt = def.options.find((o) => o.id === optionId);
  if (!opt) throw new Error(`Scene ${def.id} has no option ${optionId}`);
  const s = env.s;
  env.bind = bindFor(inst);
  if (opt.actor) {
    const who = resolveWho(env, opt.actor)[0];
    if (who) {
      env.bind.actor = who.id;
      inst.actor = who.id;
    }
  }
  const notes: string[] = [];
  const hours = optionHours(env, opt);
  if (hours > 0) {
    s.today.hoursUsed += hours;
    s.stats.hoursLost += hours;
    const miles = Math.round(hoursToMiles(s, hours) * 10) / 10;
    notes.push(`Time: ${hours}h (about ${miles} miles of ground the Haze takes back)`);
  }
  if (opt.cost) {
    for (const [k, v] of Object.entries(opt.cost)) {
      if (!v) continue;
      if (k === "scrip") {
        s.scrip -= v;
        notes.push(`-${v} scrip`);
      } else {
        s.res[k as keyof typeof s.res] -= v;
        notes.push(`-${v} ${ITEMS[k as keyof typeof ITEMS].name.toLowerCase()}`);
      }
    }
  }
  if (opt.tag === "help") {
    s.stats.strangersHelped++;
    if (inst.truth === "trap") s.stats.trapsSprung++;
  } else if (opt.tag === "refuse") {
    s.stats.strangersRefused++;
    if (inst.truth === "genuine") s.stats.genuineTurnedAway++;
    else if (inst.truth === "trap") s.stats.trapsAvoided++;
  }
  const group = opt.results[inst.truth === "none" ? "any" : inst.truth] ?? opt.results.any;
  if (!group || !group.length) throw new Error(`Scene ${def.id} option ${opt.id} has no outcome for truth ${inst.truth}`);
  const outcome = pickOutcome(env, group);
  const text = fillText(env, outcome.text);
  applyEffects(env, outcome.fx, notes);
  return { title: fillText(env, def.title), lines: [text], notes, stay: false };
}

export function optionAvailable(env: Env, inst: SceneInstance, optionId: string): string | null {
  const def = requireScene(inst.id);
  env.bind = bindFor(inst);
  if (optionId === "look") return def.tells && def.tells.length && inst.looks < MAX_LOOKS ? null : "Nothing more to see.";
  const opt = def.options.find((o) => o.id === optionId);
  if (!opt) return "Unknown option.";
  if (!allConds(env, opt.requires)) return opt.why ?? "Not available.";
  if (!canAfford(env, opt.cost)) return "You cannot afford it.";
  return null;
}


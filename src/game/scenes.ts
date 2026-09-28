// The scene engine: a scene is a moment that demands a decision. Hazards,
// strangers, finds, disputes and crises all run through here. Content lives in
// content/scenes; this file interprets it.
//
// Scenes talk. The setup is a handful of spoken lines (`talk`), tells are noticed
// by a named observer who says so aloud, and options can carry a seeded
// charisma or perception check made by whoever in the party is best at it.

import type {
  CheckResult,
  GameState,
  Member,
  OptionDef,
  Outcome,
  QueueItem,
  SceneDef,
  SceneInstance,
  ScreenOption,
  SpokenLine,
  TellView,
  Truth,
} from "./types.ts";
import type { Env } from "./effects.ts";
import { allConds, applyEffects, evalCond, fillText, resolveWho } from "./effects.ts";
import { bond, byId, firstName, living, perception } from "./party.ts";
import { hoursToMiles } from "./travel.ts";
import { sceneById } from "./content/scenes/index.ts";
import { npcById } from "./content/npcs.ts";
import { ITEMS } from "./tuning.ts";
import { checkBonus, checkerFor, pickChecker, rollCheck } from "./checks.ts";
import type { Checker } from "./checks.ts";
import { sayLines, tellLine, verdictLine } from "./dialogue.ts";
import type { TalkCtx, Verdict } from "./dialogue.ts";

export function requireScene(id: string): SceneDef {
  const def = sceneById(id);
  if (!def) throw new Error(`Unknown scene: ${id}`);
  return def;
}

/** Difficulty of noticing a tell, and of reading a face. */
export const SPOT_DC = 8;
export const READ_DC = 10;
const SAID_KEEP = 4;

// ---------------------------------------------------------------------------
// Building a scene instance
// ---------------------------------------------------------------------------

export function bestObserver(s: GameState): Member | undefined {
  return pickChecker(s, "spot")?.member;
}

function targetOf(def: SceneDef): string {
  return def.stranger?.name ?? def.title;
}

/** A clean pass reveals one tell; a pass by a wide margin (or a natural 20) reveals two. */
function spotCount(check: CheckResult): number {
  return check.roll === 20 || check.roll + check.bonus - check.dc >= 6 ? 2 : 1;
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

function pushSaid(inst: SceneInstance, lines: (SpokenLine | undefined)[]): void {
  const said = inst.said ?? (inst.said = []);
  for (const l of lines) if (l) said.push(l);
  if (said.length > SAID_KEEP) said.splice(0, said.length - SAID_KEEP);
}

function revealTells(env: Env, inst: SceneInstance, count: number): string[] {
  const observer = byId(env.s, inst.observer);
  const def = requireScene(inst.id);
  const ctx: TalkCtx = { def, inst };
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
        const decoy = env.rng.pick(decoys);
        t.text = decoy.text;
        t.say = decoy.say;
        t.severity = decoy.severity ?? 2;
        t.phantom = true;
      } else {
        t.text = "For a moment {other}'s face is one you used to know.";
        t.say = undefined;
        t.phantom = true;
      }
    }
    if (t.say) {
      const shows = (def.tells ?? []).find((d) => d.text === t.text)?.shows ?? "noise";
      pushSaid(inst, [tellLine(env, ctx, t.say, shows)]);
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
  env.bind = { actor: item.actor, a: item.a, b: item.b, noLeader: def.others };
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
    def.tells.forEach((t, i) => {
      let present = false;
      if (t.shows === inst.truth) present = env.rng.chance(t.p ?? 0.65);
      else if (t.shows === "noise") present = env.rng.chance(t.p ?? 0.4);
      if (present) inst.tells.push({ id: t.id ?? `${def.id}:${i}`, text: t.text, revealed: false, severity: t.severity ?? 2, say: t.say });
    });
    const watcher = pickChecker(s, "spot");
    inst.observer = watcher?.member.id;
    if (inst.tells.length && watcher) {
      // The first impression is a perception check like any other.
      const check = rollCheck(env.rng, "spot", SPOT_DC, targetOf(def), watcher);
      inst.check = check;
      if (check.success) revealTells(env, inst, spotCount(check));
    }
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

/** Who would make an option's check, without rolling anything. */
export function checkerForOption(env: Env, opt: OptionDef): Checker | undefined {
  if (!opt.check) return undefined;
  const exclude = (opt.check.exclude ?? []).flatMap((w) => resolveWho(env, w)).map((m) => m.id);
  return pickChecker(env.s, opt.check.kind, exclude);
}

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
      check: observer && !spent ? { kind: "spot", by: observer.id, byName: firstName(observer), bonus: checkBonus("spot", observer).bonus } : undefined,
    });
    const reader = pickChecker(env.s, "see-lie");
    out.push({
      id: "read",
      label: "Have someone read them",
      hint: inst.read
        ? "You have already tried."
        : `${reader ? firstName(reader.member) : "Someone"} watches their face and hands. Half an hour.`,
      hours: 0.5,
      disabled: inst.read ? "You have already tried." : undefined,
      check: reader && !inst.read ? { kind: "see-lie", by: reader.member.id, byName: firstName(reader.member), bonus: reader.bonus } : undefined,
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
    const checker = checkerForOption(optEnv, opt);
    if (checker) optEnv.bind.by = checker.member.id;
    const hint = [fillText(optEnv, opt.hint ?? ""), costText(opt.cost)].filter(Boolean).join(" ");
    out.push({
      id: opt.id,
      label: fillText(optEnv, opt.label),
      hint: hint || undefined,
      hours: optionHours(env, opt),
      disabled: !requiresOk ? (opt.why ?? "Not available.") : !affordable ? "You cannot afford it." : undefined,
      check: checker && opt.check ? { kind: opt.check.kind, by: checker.member.id, byName: firstName(checker.member), bonus: checker.bonus } : undefined,
    });
  }
  return out;
}

export interface SceneText {
  lines: string[];
  observations: string[];
  talk: SpokenLine[];
  tells: TellView[];
}

export function sceneText(env: Env, inst: SceneInstance): SceneText {
  const def = requireScene(inst.id);
  env.bind = bindFor(inst);
  const ctx: TalkCtx = { def, inst };
  const seen = inst.tells.filter((t) => t.revealed);
  return {
    lines: def.intro.map((l) => fillText(env, l)),
    observations: seen.map((t) => fillText(env, t.text)),
    talk: [...sayLines(env, ctx, def.talk), ...(inst.said ?? [])],
    tells: seen.map((t, i) => ({ id: t.id ?? `${def.id}:${i}`, text: fillText(env, t.text), visible: true, severity: t.severity ?? 2 })),
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
  talk: SpokenLine[];
  check?: CheckResult;
}

export function doLook(env: Env, inst: SceneInstance): void {
  env.bind = bindFor(inst);
  env.s.today.hoursUsed += 1;
  env.s.stats.hoursLost += 1;
  const def = requireScene(inst.id);
  const watcher = byId(env.s, inst.observer);
  const by = watcher?.alive && !watcher.dying ? checkerFor(watcher, "spot") : pickChecker(env.s, "spot");
  inst.looks++;
  const hadHidden = inst.tells.some((t) => !t.revealed);
  const who = by ? firstName(by.member) : "Someone";
  if (!by) {
    inst.note = "Nobody is in a state to look.";
    return;
  }
  const check = rollCheck(env.rng, "spot", SPOT_DC, targetOf(def), by);
  inst.check = check;
  if (check.success && hadHidden) {
    revealTells(env, inst, spotCount(check));
    inst.note = `${who} watches for an hour and notices more.`;
  } else if (check.success) {
    inst.note = `${who} watches for an hour and sees nothing new. That may itself mean something.`;
  } else {
    inst.note = `${who} watches for an hour and is no wiser.`;
  }
}

/** Half an hour reading a face: a see-a-lie check. It can fail, and a bad enough fumble reads it backwards. */
export function doRead(env: Env, inst: SceneInstance): void {
  env.bind = bindFor(inst);
  env.s.today.hoursUsed += 0.5;
  env.s.stats.hoursLost += 0.5;
  const def = requireScene(inst.id);
  const ctx: TalkCtx = { def, inst };
  const reader = pickChecker(env.s, "see-lie");
  inst.read = true;
  if (!reader) {
    inst.note = "Nobody is in a state to judge.";
    return;
  }
  env.bind.by = reader.member.id;
  const check = rollCheck(env.rng, "see-lie", READ_DC, targetOf(def), reader);
  inst.check = check;
  let verdict: Verdict = "unsure";
  if (inst.truth !== "none") {
    if (check.success) verdict = inst.truth;
    else if (check.roll === 1) verdict = inst.truth === "genuine" ? "trap" : "genuine"; // a bad misread
  }
  const line = verdictLine(env, ctx, verdict, env.rng.next());
  pushSaid(inst, [line]);
  if (check.success && inst.tells.some((t) => !t.revealed)) revealTells(env, inst, 1);
  const who = firstName(reader.member);
  inst.note = check.success ? `${who} looks at them a long time.` : `${who} looks at them a long time and is not certain.`;
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
  // A dialogue check happens before the outcome is chosen and steers which outcomes are possible.
  let check: CheckResult | undefined;
  if (opt.check) {
    const checker = checkerForOption(env, opt);
    if (checker) {
      check = rollCheck(env.rng, opt.check.kind, opt.check.dc, opt.check.target ?? targetOf(def), checker);
      env.bind.by = checker.member.id;
    }
  }
  const group = opt.results[inst.truth === "none" ? "any" : inst.truth] ?? opt.results.any;
  if (!group || !group.length) throw new Error(`Scene ${def.id} option ${opt.id} has no outcome for truth ${inst.truth}`);
  const passed = check?.success ?? false;
  const fitting = group.filter((o) => !o.needs || (o.needs === "success") === passed);
  const outcome = pickOutcome(env, fitting.length ? fitting : group);
  const text = fillText(env, outcome.text);
  // Speakers are resolved before effects land, so someone the outcome kills still gets their last words.
  const ctx: TalkCtx = { def, inst };
  const talk = sayLines(env, ctx, outcome.talk);
  const aboard = new Set(s.party.map((m) => m.id));
  applyEffects(env, outcome.fx, notes);
  for (const m of s.party) {
    if (aboard.has(m.id)) continue;
    const npc = npcById(m.id);
    if (npc) talk.push(...sayLines(env, ctx, npc.join));
  }
  return { title: fillText(env, def.title), lines: [text], notes, stay: false, talk, check };
}

export function optionAvailable(env: Env, inst: SceneInstance, optionId: string): string | null {
  const def = requireScene(inst.id);
  env.bind = bindFor(inst);
  const hasTells = Boolean(def.tells && def.tells.length);
  if (optionId === "look") return hasTells && inst.looks < MAX_LOOKS ? null : "Nothing more to see.";
  if (optionId === "read") return hasTells && !inst.read ? null : "You have already tried.";
  const opt = def.options.find((o) => o.id === optionId);
  if (!opt) return "Unknown option.";
  if (!allConds(env, opt.requires)) return opt.why ?? "Not available.";
  if (!canAfford(env, opt.cost)) return "You cannot afford it.";
  return null;
}

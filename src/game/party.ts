// Party helpers: who is alive, who can act, bonds between members, death.

import type { GameState, Mark, Member, Trait, Role, MemberView, Resources } from "./types.ts";
import { ITEMS, TUNING } from "./tuning.ts";
import { npcById } from "./content/npcs.ts";

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

const NERVE_LOSS_MULT: Partial<Record<string, number>> = { stoic: 0.6, paranoid: 1.2, haunted: 1.2, coward: 1.3 };

/** Shake or steady a member's nerve. Losses are scaled by who they are. Returns the real change. */
export function changeNerve(m: Member, d: number): number {
  let delta = d;
  if (d < 0) {
    let mult = 1;
    for (const t of m.traits) mult *= NERVE_LOSS_MULT[t] ?? 1;
    if (m.marks && m.marks.includes("hexed")) mult *= 1.3;
    delta = -Math.round(-d * mult);
  }
  const before = m.nerve;
  m.nerve = clamp(m.nerve + delta, 0, 100);
  return m.nerve - before;
}

export const HISTORY_CAP = 40;

/** Record something notable in a member's history ("Day 12: quarrelled with Abel over rations"). */
export function remember(s: GameState, m: Member | undefined, text: string): void {
  if (!m) return;
  const list = m.history ?? (m.history = []);
  const last = list[list.length - 1];
  if (last && last.day === s.day && last.text === text) return;
  list.push({ day: s.day, text });
  if (list.length > HISTORY_CAP) list.splice(0, list.length - HISTORY_CAP);
}

export function living(s: GameState): Member[] {
  return s.party.filter((m) => m.alive);
}

/** Members who can act: alive and not dying. */
export function able(s: GameState): Member[] {
  return s.party.filter((m) => m.alive && !m.dying);
}

export function leader(s: GameState): Member {
  return s.party.find((m) => m.isLeader) as Member;
}

export function byId(s: GameState, id: string | undefined): Member | undefined {
  return id ? s.party.find((m) => m.id === id) : undefined;
}

export function hasTrait(m: Member, t: Trait): boolean {
  return m.traits.includes(t);
}

export function hasRole(s: GameState, r: Role): boolean {
  return able(s).some((m) => m.role === r);
}

export function anyTrait(s: GameState, t: Trait): boolean {
  return able(s).some((m) => m.traits.includes(t));
}

export function hasMark(m: Member, mark: Mark): boolean {
  return !!m.marks && m.marks.includes(mark);
}

/** Can this person hear the Haze coming? Haunted people and the witch-touched can. */
export function hearsHaze(m: Member): boolean {
  return hasTrait(m, "haunted") || hasMark(m, "witch-touched");
}

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function bond(s: GameState, a: string, b: string): number {
  return s.bonds[pairKey(a, b)] ?? 0;
}

export function addBond(s: GameState, a: string, b: string, d: number): void {
  if (a === b) return;
  const k = pairKey(a, b);
  s.bonds[k] = clamp((s.bonds[k] ?? 0) + d, -100, 100);
}

export function avgNerve(s: GameState): number {
  const ms = living(s);
  if (!ms.length) return 0;
  return ms.reduce((n, m) => n + m.nerve, 0) / ms.length;
}

export function avgTrust(s: GameState): number {
  const ms = living(s).filter((m) => !m.isLeader);
  if (!ms.length) return 100;
  return ms.reduce((n, m) => n + m.trust, 0) / ms.length;
}

export function cargoUsed(res: Resources): number {
  let total = 0;
  for (const id of Object.keys(ITEMS) as (keyof Resources)[]) total += res[id] * ITEMS[id].weight;
  return total;
}

export function cargoCap(s: GameState): number {
  return s.train.wagons * TUNING.cargoPerWagon;
}

export function conditionsOf(m: Member): string[] {
  const out: string[] = [];
  if (m.dying) out.push("dying");
  if (m.wounded) out.push("wounded");
  if (m.sick) out.push("sick");
  if (m.fog > 0) out.push(m.fog >= 3 ? "turning" : m.fog === 2 ? "fogsick II" : "fogsick I");
  if (m.nerve < TUNING.breakingNerve) out.push("breaking");
  else if (m.nerve < TUNING.lowNerve) out.push("frayed");
  for (const mark of m.marks ?? []) out.push(mark);
  return out;
}

export function memberView(m: Member): MemberView {
  return {
    id: m.id,
    name: m.name,
    role: m.role,
    traits: m.traits.slice(),
    health: Math.round(m.health),
    nerve: Math.round(m.nerve),
    trust: Math.round(m.trust),
    conditions: conditionsOf(m),
    isLeader: m.isLeader,
    history: (m.history ?? []).map((h) => ({ ...h })),
    look: m.recruited ? npcById(m.id)?.look : undefined,
  };
}

export function firstName(m: Member): string {
  const parts = m.name.split(" ");
  return parts[0] === "Sister" || parts[0] === "Brother" ? m.name : parts[0];
}

/** Perception multiplier: frayed minds see things that are not there. */
export function perception(m: Member): number {
  return clamp(0.35 + m.nerve / 100, 0.35, 1);
}

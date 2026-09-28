// Party helpers: who is alive, who can act, bonds between members, death.

import type { GameState, Member, Trait, Role, MemberView, Resources } from "./types.ts";
import { ITEMS, TUNING } from "./tuning.ts";
import { npcById } from "./content/npcs.ts";

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
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

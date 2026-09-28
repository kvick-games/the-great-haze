// Seeded dialogue and perception checks. A check is made by one specific member,
// chosen by role and traits, rolling a d20 plus a bonus from who they are and the
// state they are in: nerve, health, wounds, fever and the Haze in their lungs.
// Everything here is deterministic under the run's seed.

import type { CheckKind, CheckResult, GameState, Member, Role, Trait } from "./types.ts";
import type { Rng } from "./rng.ts";
import { able, clamp, firstName } from "./party.ts";

type Table = { roles?: Partial<Record<Role, number>>; traits?: Partial<Record<Trait, number>> };

/** What each kind of check rewards. Positive helps, negative hurts. */
const TABLES: Record<CheckKind, Table> = {
  persuade: {
    roles: { speaker: 3, medic: 1 },
    traits: { charming: 2, kind: 1, pious: 1, hothead: -1, coward: -1 },
  },
  calm: {
    roles: { medic: 2, speaker: 2 },
    traits: { kind: 2, stoic: 1, pious: 1, veteran: 1, charming: 1, hothead: -2, haunted: -1 },
  },
  haggle: {
    roles: { speaker: 2, mechanic: 1 },
    traits: { greedy: 2, charming: 2, paranoid: 1, kind: -1, pious: -1 },
  },
  "talk-down": {
    roles: { guard: 2, speaker: 1, hunter: 1 },
    traits: { veteran: 2, stoic: 1, charming: 1, hothead: -1, coward: -2 },
  },
  spot: {
    roles: { scout: 3, hunter: 1, medic: 1 },
    traits: { paranoid: 2, veteran: 1, haunted: 1, stoic: 0 },
  },
  "see-lie": {
    roles: { speaker: 2, scout: 1, medic: 1 },
    traits: { paranoid: 2, charming: 1, kind: 1, veteran: 1, coward: -1 },
  },
};

const PERCEPTION: CheckKind[] = ["spot", "see-lie"];

export interface Bonus {
  bonus: number;
  parts: string[];
}

const label = (n: number, what: string): string => `${what} ${n > 0 ? "+" : "−"}${Math.abs(n)}`;

/** Everything that adds to or subtracts from a member's roll for this kind of check. */
export function checkBonus(kind: CheckKind, m: Member): Bonus {
  const table = TABLES[kind];
  const parts: string[] = [];
  let bonus = 0;
  const add = (n: number, what: string) => {
    if (!n) return;
    bonus += n;
    parts.push(label(n, what));
  };
  add(table.roles?.[m.role] ?? 0, m.role);
  for (const t of m.traits) add(table.traits?.[t] ?? 0, t);
  // Nerve steadies or shakes everyone. Perception suffers most.
  const nerve = clamp(Math.round((m.nerve - 50) / 15), -3, 2);
  if (nerve) add(nerve, nerve > 0 ? "steady nerve" : m.nerve < 20 ? "shattered nerve" : "frayed nerve");
  if (m.health < m.maxHealth * 0.4) add(-1, "weak");
  if (m.wounded) add(-1, "hurt");
  if (m.sick) add(-1, "fevered");
  if (m.fog >= 1) add(PERCEPTION.includes(kind) ? -m.fog : -1, "fog in the lungs");
  return { bonus, parts };
}

export interface Checker {
  member: Member;
  bonus: number;
  parts: string[];
}

/**
 * The person best placed to make a check, without touching the random stream:
 * the highest bonus among those who can act. Ties go to whoever is earlier in the
 * party list, so the same state always names the same person.
 */
export function pickChecker(s: GameState, kind: CheckKind, exclude: string[] = []): Checker | undefined {
  let best: Checker | undefined;
  for (const m of able(s)) {
    if (exclude.includes(m.id)) continue;
    const b = checkBonus(kind, m);
    if (!best || b.bonus > best.bonus) best = { member: m, bonus: b.bonus, parts: b.parts };
  }
  if (best) return best;
  // Everyone free is excluded: fall back to anyone who can still stand.
  for (const m of able(s)) {
    const b = checkBonus(kind, m);
    if (!best || b.bonus > best.bonus) best = { member: m, bonus: b.bonus, parts: b.parts };
  }
  return best;
}

export function checkReason(m: Member, kind: CheckKind, parts: string[], bonus: number): string {
  const who = firstName(m);
  const why = parts.length ? parts.join(", ") : "no edge either way";
  const job = kind === "spot" ? "sharpest eyes" : kind === "see-lie" ? "best judge of people" : kind === "haggle" ? "best head for a bargain" : "best voice for it";
  return `${who} has the ${job} (${why}; total ${bonus >= 0 ? "+" : "−"}${Math.abs(bonus)}).`;
}

/** Roll it. A natural 20 always succeeds and a natural 1 always fails. */
export function rollCheck(rng: Rng, kind: CheckKind, dc: number, target: string, by: Checker): CheckResult {
  const roll = rng.int(1, 20);
  const success = roll === 20 || (roll !== 1 && roll + by.bonus >= dc);
  return {
    kind,
    by: by.member.id,
    byName: firstName(by.member),
    target,
    roll,
    bonus: by.bonus,
    dc,
    success,
    reason: checkReason(by.member, kind, by.parts, by.bonus),
  };
}

/** A check made by a specific person (an observer already chosen for the scene). */
export function checkerFor(m: Member, kind: CheckKind): Checker {
  const b = checkBonus(kind, m);
  return { member: m, bonus: b.bonus, parts: b.parts };
}

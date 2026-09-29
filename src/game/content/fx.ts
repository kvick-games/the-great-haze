// Tiny builders so scene content reads like prose rather than plumbing.

import type { AffairOp, Cond, Effect, EndingKind, Line, Mark, Outcome, RelKind, ResourceId, Who } from "../types.ts";
import type { Amount } from "../rng.ts";

export const fx = {
  res: (res: ResourceId, d: Amount): Effect => ({ t: "res", res, d }),
  scrip: (d: Amount): Effect => ({ t: "scrip", d }),
  hp: (who: Who, d: Amount): Effect => ({ t: "hp", who, d }),
  nerve: (who: Who, d: Amount): Effect => ({ t: "nerve", who, d }),
  trust: (who: Who, d: Amount): Effect => ({ t: "trust", who, d }),
  bond: (a: Who, b: Who, d: Amount): Effect => ({ t: "bond", a, b, d }),
  bondAll: (d: Amount): Effect => ({ t: "bondAll", d }),
  wound: (who: Who): Effect => ({ t: "status", who, s: "wounded" }),
  sick: (who: Who): Effect => ({ t: "status", who, s: "sick" }),
  fog: (who: Who, v = 1): Effect => ({ t: "status", who, s: "fog", v }),
  cureFog: (who: Who): Effect => ({ t: "cure", who, s: "fog" }),
  cureSick: (who: Who): Effect => ({ t: "cure", who, s: "sick" }),
  repair: (d: Amount): Effect => ({ t: "repair", d }),
  wagons: (d: number): Effect => ({ t: "wagons", d }),
  gap: (d: Amount): Effect => ({ t: "gap", d }),
  advance: (miles: Amount): Effect => ({ t: "advance", miles }),
  hours: (d: Amount): Effect => ({ t: "hours", d }),
  recruit: (id?: string, chance?: number): Effect => ({ t: "recruit", id, chance }),
  combat: (enemy: string): Effect => ({ t: "combat", enemy }),
  scene: (id: string, chance?: number, same?: boolean): Effect => ({ t: "scene", id, chance, same }),
  flag: (key: string, d = 1): Effect => ({ t: "flag", key, d }),
  kill: (who: Who, cause: string): Effect => ({ t: "kill", who, cause }),
  leave: (who: Who, cause: string, takes?: Partial<Record<ResourceId, number>>): Effect => ({ t: "leave", who, cause, takes }),
  rel: (a: Who, b: Who, kind: RelKind): Effect => ({ t: "rel", a, b, kind }),
  affair: (op: AffairOp): Effect => ({ t: "affair", op }),
  note: (who: Who, text: string): Effect => ({ t: "note", who, text }),
  end: (kind: EndingKind, headline: string, text: string[]): Effect => ({ t: "end", kind, headline, text }),
  // The witch storyline (see witch.ts).
  abduct: (ward = false): Effect => ({ t: "abduct", ward }),
  restore: (changed = 0.3, leave = 0): Effect => ({ t: "restore", changed, leave }),
  lose: (cause = "kept by the witch", abandon = false): Effect => ({ t: "lose", cause, abandon }),
  giveCrew: (cause = "stayed with the witch, in trade"): Effect => ({ t: "giveCrew", cause }),
  days: (d: Amount): Effect => ({ t: "days", d }),
  mark: (who: Who, mark: Mark, chance?: number): Effect => ({ t: "mark", who, mark, chance }),
  set: (key: string, v: Amount, day = false): Effect => ({ t: "flagSet", key, v, day }),
};

/** An outcome with spoken lines, optionally gated on the option's check. */
export function t(out: Outcome, talk: Line[], needs?: "success" | "fail"): Outcome {
  return needs ? { ...out, talk, needs } : { ...out, talk };
}

/** Build an outcome: text, effects, optional weight. */
export function o(text: string, effects: Effect[] = [], weight = 1, mods?: { if: Cond; add: number }[]): Outcome {
  return { text, fx: effects, weight, mods };
}

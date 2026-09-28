// Three curated, mostly linear scenarios cut from real, seeded runs of the real game engine.
// Each is pinned as (strategy, seed, beat window): the replay is deterministic, so the same
// pins always give the same beats. A fork swaps one choice at a beat and follows the bot
// for a few more beats, giving the single two-way branch each scenario is allowed.
//
// If game content changes (another package merged), the pins may drift: run
//   node tools/video/scenarios/search.ts <a|b|c> [maxSeed]
// to find fresh pins, and `npm test` (test/story.test.ts) tells you when they have.

import type { Strategy } from "../../bots.ts";

export interface ForkDef {
  /** Index of the beat (in the full run) whose choice is swapped. */
  atBeat: number;
  /** The choice taken instead. */
  alt: string;
  /** How many beats of the alternative to keep. */
  take: number;
  label: string;
}

export interface ScenarioDef {
  id: string;
  title: string;
  logline: string;
  strategy: Strategy;
  seed: number;
  /** Inclusive beat window in the full run. */
  from: number;
  to: number;
  /** Beats inside the window left out (repeated combat rounds, quiet travel). */
  skip?: number[];
  fork: ForkDef;
  /** What the scenario should demonstrate; the tests check it. */
  expects: { mutations: string[] };
}

export const SCENARIOS: ScenarioDef[] = [
  {
    id: "stranger-trap",
    title: "The girl on the road",
    logline: "A lost child on the road is bait. The party stops, a second trap springs at the stalled train, people are hurt, and their clothes are bloodied.",
    strategy: "samaritan",
    seed: 3,
    from: 24,
    to: 28,
    skip: [27],
    fork: { atBeat: 24, alt: "pass", take: 2, label: "Drive on without stopping" },
    expects: { mutations: ["wound", "costume"] },
  },
  {
    id: "night-death",
    title: "Abel at the fire",
    logline: "The red orchard gets into the party. Abel turns at night camp and the wagon-master has to end it while the others watch.",
    strategy: "samaritan",
    seed: 72,
    from: 59,
    to: 63,
    fork: { atBeat: 62, alt: "walk", take: 2, label: "Let him walk into the Haze" },
    expects: { mutations: ["fog", "death"] },
  },
  {
    id: "companion-turns",
    title: "Juniper",
    logline: "A lost girl is taken aboard and made one of the party; days later the fog sickness finds her, in a wound and a stained dress.",
    strategy: "samaritan",
    seed: 39,
    from: 55,
    to: 59,
    skip: [56],
    fork: { atBeat: 55, alt: "pass", take: 2, label: "Leave her on the road" },
    expects: { mutations: ["join", "fog"] },
  },
];

export function scenarioById(id: string): ScenarioDef {
  const s = SCENARIOS.find((x) => x.id === id);
  if (!s) throw new Error(`unknown scenario "${id}" (have ${SCENARIOS.map((x) => x.id).join(", ")})`);
  return s;
}

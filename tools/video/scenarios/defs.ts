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
    title: "The figure by the fire",
    logline: "A figure at a signal fire pleads for the train to come. It is bait: the party is hit, Sister Odalys is wounded and her habit is bloodied, and the quarrel that follows is settled badly before the wound is dressed.",
    strategy: "samaritan",
    seed: 73,
    from: 25,
    to: 29,
    fork: { atBeat: 25, alt: "pass", take: 2, label: "Keep going, past the fire" },
    expects: { mutations: ["wound", "costume"] },
  },
  {
    id: "night-death",
    title: "Dov in the dark",
    logline: "The Haze takes Dov by stages. At night camp he sits up wrong-eyed, and the wagon-master has to end it quietly while the others sleep, and grieves.",
    strategy: "samaritan",
    seed: 21,
    from: 27,
    to: 30,
    fork: { atBeat: 30, alt: "walk", take: 2, label: "Open the gate and let him walk out" },
    expects: { mutations: ["fog", "death"] },
  },
  {
    id: "companion-turns",
    title: "Juniper",
    logline: "A girl alone on the road is lifted onto the wagon and becomes Juniper Cole, one of the party. She hears the Haze say names at night, and days later the fog sickness finds her.",
    strategy: "samaritan",
    seed: 117,
    from: 8,
    to: 13,
    skip: [9, 12],
    fork: { atBeat: 8, alt: "pass", take: 2, label: "Drive on and leave her on the road" },
    expects: { mutations: ["join", "fog"] },
  },
];

export function scenarioById(id: string): ScenarioDef {
  const s = SCENARIOS.find((x) => x.id === id);
  if (!s) throw new Error(`unknown scenario "${id}" (have ${SCENARIOS.map((x) => x.id).join(", ")})`);
  return s;
}

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
    title: "The man on the roadside",
    logline: "A wounded man on the roadside begs to be tended. It is bait: the party is hit, Sister Odalys is wounded and her habit is bloodied, and the party reaches the bridge before the wound is dressed.",
    strategy: "samaritan",
    seed: 38,
    from: 12,
    to: 15,
    fork: { atBeat: 12, alt: "pass", take: 2, label: "Keep going, past the fire" },
    expects: { mutations: ["wound", "costume"] },
  },
  {
    id: "night-death",
    title: "Elspeth in the dark",
    logline: "The Haze takes Elspeth by stages. At night camp she sits up wrong-eyed, and the wagon-master has to end it quietly while the others sleep, and grieves.",
    strategy: "samaritan",
    seed: 774,
    from: 87,
    to: 91,
    fork: { atBeat: 90, alt: "walk", take: 2, label: "Open the gate and let her walk out" },
    expects: { mutations: ["fog", "death"] },
  },
  {
    id: "companion-turns",
    title: "Juniper",
    logline: "A girl alone on the road is lifted onto the wagon and becomes Juniper Cole, one of the party. A tongue of red fog rolls over the train that same evening, and the fog sickness finds her.",
    strategy: "samaritan",
    seed: 232,
    from: 6,
    to: 10,
    skip: [8],
    fork: { atBeat: 6, alt: "pass", take: 2, label: "Drive on and leave her on the road" },
    expects: { mutations: ["join", "fog"] },
  },
];

export function scenarioById(id: string): ScenarioDef {
  const s = SCENARIOS.find((x) => x.id === id);
  if (!s) throw new Error(`unknown scenario "${id}" (have ${SCENARIOS.map((x) => x.id).join(", ")})`);
  return s;
}

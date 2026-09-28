// Deterministic replay of a bot-driven run, with optional choice overrides, recording the story as it goes.
// Scenarios are pinned as (strategy, seed, step window); a fork is the same run with one choice swapped.

import { Game } from "../../../src/game/game.ts";
import type { NewGameOptions } from "../../../src/game/game.ts";
import { chooseOption, makeRand, shop } from "../../bots.ts";
import type { Strategy } from "../../bots.ts";
import { StoryRecorder } from "../../../src/story/recorder.ts";
import type { CharacterSpecOptions } from "../../../src/story/characters.ts";
import type { Beat } from "../../../src/story/mutations.ts";

export interface ReplayPlan {
  strategy: Strategy;
  seed: number;
  game?: Partial<NewGameOptions>;
  /** step number (count of choices made so far) -> choice id to take instead of the bot's. */
  overrides?: Record<number, string>;
  /** Stop once this many choices have been made. */
  stopAfterStep?: number;
  storyOptions?: CharacterSpecOptions;
}

export interface ReplayResult {
  recorder: StoryRecorder;
  /** Every choice made, in order. */
  choices: string[];
  /** For each recorded beat (by position in recorder.beats), the step whose choice produced it. */
  stepOfBeat: number[];
  game: Game;
}

export function replay(plan: ReplayPlan): ReplayResult {
  const rand = makeRand(plan.seed * 7919 + 13);
  const game = Game.create({ seed: plan.seed, leaderName: "Bot", background: "surveyor", ...plan.game });
  const choices: string[] = [];
  const stepOfBeat: number[] = [];
  let recorder: StoryRecorder | null = null;
  let first = true;
  let step = 0;
  while (!game.over && step < 6000 && (plan.stopAfterStep === undefined || step < plan.stopAfterStep)) {
    if (game.s.pending.kind === "store") {
      shop(game, plan.strategy, first);
      first = false;
    }
    let id = chooseOption(game, plan.strategy, rand);
    const forced = plan.overrides?.[step];
    if (forced !== undefined) id = forced;
    const before = game.serialize();
    if (!recorder) recorder = StoryRecorder.start(before, { seed: plan.seed, options: plan.storyOptions ?? {} });
    game.choose(id);
    const beat = recorder.record(before, game.serialize(), id);
    if (beat) stepOfBeat[recorder.beats.length - 1] = step;
    choices.push(id);
    step++;
  }
  if (!recorder) throw new Error("no choices made");
  return { recorder, choices, stepOfBeat, game };
}

export function beatLine(b: Beat): string {
  const muts = b.mutations.filter((m) => m.kind !== "region" && m.kind !== "wagons").map((m) => `${m.kind}:${m.subject}`).join(",");
  return `#${b.index} d${b.day} ${b.kind}/${b.stakes} ${b.sceneId ?? "-"}(${b.truth ?? "-"}) ${b.choiceId} :: ${b.title} [${muts}]`;
}

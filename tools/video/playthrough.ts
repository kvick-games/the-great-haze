// Play a seeded bot through the game and record its story. Shared by the exporter,
// the tests and the browser smoke check.

import { runBot } from "../bots.ts";
import type { RunResult, Strategy } from "../bots.ts";
import type { NewGameOptions } from "../../src/game/game.ts";
import type { Screen } from "../../src/game/types.ts";
import { StoryRecorder } from "../../src/story/recorder.ts";
import type { CharacterSpecOptions } from "../../src/story/characters.ts";

export interface RecordedRun {
  recorder: StoryRecorder;
  result: RunResult;
}

export function recordBotRun(strategy: Strategy, seed: number, game: Partial<NewGameOptions> = {}, storyOptions: CharacterSpecOptions = {}): RecordedRun {
  let recorder: StoryRecorder | null = null;
  let prev: { state: string; choice: string; screen: Screen } | null = null;
  const result = runBot(strategy, seed, game, 6000, (g, screen, chosen) => {
    const now = g.serialize();
    if (!recorder) recorder = StoryRecorder.start(now, { seed, options: storyOptions });
    else if (prev) recorder.record(prev.state, now, prev.choice, undefined, { before: prev.screen, after: screen });
    prev = { state: now, choice: chosen, screen };
  });
  const rec = recorder as StoryRecorder | null;
  if (!rec) throw new Error("The bot made no choices");
  const last = prev as { state: string; choice: string; screen: Screen } | null;
  if (last) rec.record(last.state, JSON.stringify(result.state), last.choice, undefined, { before: last.screen });
  return { recorder: rec, result };
}

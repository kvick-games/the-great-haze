// Find seeds whose runs contain the story shapes the curated scenarios want. Development tool:
// its output is pasted into defs.ts as pinned (strategy, seed, window).
//   node tools/video/scenarios/search.ts [a|b|c] [maxSeed]

import { replay, beatLine } from "./replay.ts";
import { MATCHERS } from "./match.ts";
import type { Strategy } from "../../bots.ts";

const which = process.argv[2] ?? "a";
const maxSeed = Number(process.argv[3] ?? 200);
const matcher = MATCHERS[which];
if (!matcher) throw new Error(`unknown scenario ${which}`);
let shown = 0;
for (const strategy of ["samaritan", "cautious", "random", "reckless"] as Strategy[]) {
  for (let seed = 1; seed <= maxSeed && shown < 6; seed++) {
    const r = replay({ strategy, seed });
    const beats = r.recorder.beats;
    const at = matcher(beats);
    if (at === null) continue;
    shown++;
    console.log(`\n== ${which}: ${strategy} seed ${seed}, beats ${at.from}..${at.to} (steps ${r.stepOfBeat[at.from]}..${r.stepOfBeat[at.to]})`);
    for (let i = Math.max(0, at.from - 1); i <= Math.min(beats.length - 1, at.to + 1); i++) console.log((i >= at.from && i <= at.to ? "  * " : "    ") + beatLine(beats[i]));
  }
}

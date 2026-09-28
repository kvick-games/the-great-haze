// Find seeds whose runs contain the story shapes the curated scenarios want. Development tool:
// its output is pasted into defs.ts as pinned (strategy, seed, window). Windows are ranked by
// how much the game's own speech is in them and whether a dialogue check happens.
//   node tools/video/scenarios/search.ts [a|b|c] [maxSeed] [strategies,comma,separated]

import { replay, beatLine } from "./replay.ts";
import { MATCHERS } from "./match.ts";
import type { Strategy } from "../../bots.ts";

const which = process.argv[2] ?? "a";
const maxSeed = Number(process.argv[3] ?? 200);
const strategies = (process.argv[4] ?? "samaritan,cautious,random,reckless").split(",") as Strategy[];
const matcher = MATCHERS[which];
if (!matcher) throw new Error(`unknown scenario ${which}`);

interface Hit {
  strategy: Strategy;
  seed: number;
  from: number;
  to: number;
  score: number;
  stepFrom: number;
  stepTo: number;
  lines: string[];
}
const hits: Hit[] = [];
for (const strategy of strategies) {
  for (let seed = 1; seed <= maxSeed; seed++) {
    const r = replay({ strategy, seed });
    const beats = r.recorder.beats;
    for (const at of matcher(beats)) {
      const lines: string[] = [];
      for (let i = Math.max(0, at.from - 1); i <= Math.min(beats.length - 1, at.to + 1); i++) lines.push((i >= at.from && i <= at.to ? "  * " : "    ") + beatLine(beats[i]));
      hits.push({ strategy, seed, from: at.from, to: at.to, score: at.score ?? 0, stepFrom: r.stepOfBeat[at.from], stepTo: r.stepOfBeat[at.to], lines });
    }
  }
}
hits.sort((a, b) => b.score - a.score);
for (const h of hits.slice(0, 6)) {
  console.log(`\n== ${which}: ${h.strategy} seed ${h.seed}, beats ${h.from}..${h.to} (steps ${h.stepFrom}..${h.stepTo}) score ${h.score}`);
  for (const l of h.lines) console.log(l);
}
console.log(`\n${hits.length} windows in total`);

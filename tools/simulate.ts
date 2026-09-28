// Balance harness: run many seeded games per strategy and summarise.
//   npm run simulate -- [runs=200] [difficulty=normal]
import { runBot } from "./bots.ts";
import type { RunResult, Strategy } from "./bots.ts";
import { living } from "../src/game/party.ts";

const runs = Number(process.argv[2] ?? 200);
const difficulty = (process.argv[3] ?? "normal") as "normal" | "dire";
const strategies: Strategy[] = ["random", "reckless", "samaritan", "cautious"];

const pct = (n: number, d: number) => `${((100 * n) / d).toFixed(0)}%`.padStart(4);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

console.log(`Simulating ${runs} runs per strategy (${difficulty})\n`);
console.log("strategy   win   consumed lost  | avg day  avg mi  | survivors(win) | starved  noFood  hoursLost | helped refused trapped turnedAway");
for (const strategy of strategies) {
  const results: RunResult[] = [];
  for (let seed = 1; seed <= runs; seed++) results.push(runBot(strategy, seed, { difficulty }));
  const wins = results.filter((r) => r.kind === "victory");
  const consumed = results.filter((r) => r.kind === "consumed");
  const lost = results.filter((r) => r.kind === "lost");
  const st = (f: (r: RunResult) => number) => mean(results.map(f)).toFixed(1).padStart(6);
  console.log(
    strategy.padEnd(10),
    pct(wins.length, runs),
    "  ",
    pct(consumed.length, runs),
    "   ",
    pct(lost.length, runs),
    " |",
    mean(results.map((r) => r.day)).toFixed(0).padStart(6),
    mean(results.map((r) => r.miles)).toFixed(0).padStart(7),
    "  |",
    mean(wins.map((r) => living(r.state).length)).toFixed(1).padStart(8),
    "       |",
    st((r) => r.state.stats.starvedDays),
    pct(results.filter((r) => r.state.stats.daysNoRations > 0).length, runs).padStart(6),
    st((r) => r.state.stats.hoursLost),
    " |",
    st((r) => r.state.stats.strangersHelped),
    st((r) => r.state.stats.strangersRefused),
    st((r) => r.state.stats.trapsSprung),
    st((r) => r.state.stats.genuineTurnedAway),
  );
  // Why the losers lost.
  const causes = new Map<string, number>();
  for (const r of results.filter((x) => x.kind !== "victory")) {
    const leader = r.state.party.find((m) => m.isLeader);
    const key = r.kind === "consumed" ? `consumed: ${r.headline}` : `lost: ${leader && !leader.alive ? `leader ${leader.fate}` : r.headline}`;
    causes.set(key, (causes.get(key) ?? 0) + 1);
  }
  const deaths = new Map<string, number>();
  for (const r of results) for (const m of r.state.party) if (!m.alive && m.fate) deaths.set(m.fate.replace(/^.*: /, ""), (deaths.get(m.fate) ?? 0) + 1);
  const deathTop = [...deaths.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  console.log("           deaths/departures per 100 runs: " + deathTop.map(([k, v]) => `${Math.round((v * 100) / runs)} ${k}`).join(" | "));
  const top = [...causes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  console.log("           " + top.map(([k, v]) => `${v}× ${k}`).join(" | "));
}

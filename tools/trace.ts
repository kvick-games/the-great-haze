// Print a full transcript of a bot run.
//   npm run trace -- <strategy> <seed>     e.g.  npm run trace -- cautious 7
import { runBot } from "./bots.ts";
import type { Strategy } from "./bots.ts";

const strategy = (process.argv[2] ?? "cautious") as Strategy;
const seed = Number(process.argv[3] ?? 1);

const result = runBot(strategy, seed, {}, 6000, (_game, s, chosen) => {
  const h = s.hud;
  console.log(
    `\n=== [${s.kind}] ${s.title}  (day ${h.day}, mile ${h.miles}, gap ${h.gap}, food ${h.res.rations}, torches ${h.res.torches}, shot ${h.res.ammo}, physic ${h.res.medicine}, wagons ${h.condition}%)`,
  );
  for (const l of s.lines) console.log("  " + l);
  for (const l of s.observations) console.log("  > " + l);
  for (const l of s.notes) console.log("  * " + l);
  if (["plan", "result", "scene"].includes(s.kind)) {
    console.log(
      "  party: " +
        h.party.map((m) => `${m.name.split(" ")[0]} ${m.health}hp/${m.nerve}n${m.conditions.length ? " [" + m.conditions.join(",") + "]" : ""}`).join("; "),
    );
  }
  console.log(`  -> ${chosen}`);
});
console.log(`\nEND (${strategy}, seed ${seed}): ${result.kind}: ${result.headline}. Score ${result.score}. Day ${result.day}, ${result.miles} miles, ${result.survivors} alive.`);
for (const l of result.state.ending?.lines ?? []) console.log("  " + l);

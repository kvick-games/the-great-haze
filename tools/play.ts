// Play The Great Haze in a terminal. This drives the same engine-agnostic core
// that a Dream Engine scene will drive; it is a dev harness, not the game's UI.
//
//   npm run play -- [--seed 42] [--name Jo] [--background nurse] [--difficulty dire]
//                   [--save run.json] [--load run.json]
//
// Menus take a number. In the store: `b rations 10`, `s torches 2`, or `go`.
// Type `q` to quit (the run is saved if --save was given).

import { createInterface } from "node:readline";
import { readFileSync, writeFileSync } from "node:fs";
import { Game } from "../src/game/game.ts";
import type { Hud, ResourceId, Screen } from "../src/game/types.ts";
import { RESOURCE_IDS } from "../src/game/types.ts";
import { BACKGROUNDS } from "../src/game/content/roster.ts";
import { DIFFICULTY } from "../src/game/tuning.ts";

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ""), process.argv[i + 1] ?? "");

const tty = process.stdout.isTTY;
const c = (code: string, s: string) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const red = (s: string) => c("31", s);
const dim = (s: string) => c("2", s);
const bold = (s: string) => c("1", s);
const yellow = (s: string) => c("33", s);
const cyan = (s: string) => c("36", s);

function bar(v: number, max = 100, width = 10): string {
  const n = Math.max(0, Math.min(width, Math.round((v / max) * width)));
  return "█".repeat(n) + "░".repeat(width - n);
}

function wrap(text: string, width = 92, indent = "  "): string {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    if ((line + " " + word).trim().length > width) {
      out.push(indent + line.trim());
      line = word;
    } else line += " " + word;
  }
  if (line.trim()) out.push(indent + line.trim());
  return out.join("\n");
}

const ZONE_COLOR: Record<Hud["zone"], (s: string) => string> = {
  far: cyan,
  near: yellow,
  close: red,
  upon: (s) => c("1;31", s),
};

function renderHud(h: Hud): string {
  const r = h.res;
  const lines: string[] = [];
  lines.push(dim("─".repeat(94)));
  lines.push(
    ` Day ${bold(String(h.day))} · ${h.region} · mile ${h.miles}/840 · Haze ${ZONE_COLOR[h.zone](`${h.gap} mi behind (${h.zone.toUpperCase()})`)} · it moves ~${h.hazeToday}/day`,
  );
  lines.push(
    ` Food ${r.rations} · Torches ${r.torches} · Shot ${r.ammo} · Physic ${r.medicine} · Spares ${r.spares} · Veils ${r.veils} · Rockets ${r.rockets} · Scrip ${h.scrip}`,
  );
  lines.push(` Cargo ${h.cargoUsed}/${h.cargoCap} · Wagons ${h.wagons} (${h.condition}% sound) · Pace ${h.pace} · Rations ${h.rations}`);
  for (const m of h.party) {
    const cond = m.conditions.length ? red(` [${m.conditions.join(", ")}]`) : "";
    lines.push(
      `  ${m.name.padEnd(20)} ${dim(m.role.padEnd(8))} HP ${bar(m.health)} ${String(m.health).padStart(3)}  Nerve ${bar(m.nerve)} ${String(m.nerve).padStart(3)}${cond}`,
    );
  }
  lines.push(dim("─".repeat(94)));
  return lines.join("\n");
}

function render(s: Screen): string {
  const out: string[] = [];
  out.push("");
  out.push(bold(red(`━━ ${s.title} ━━`)));
  if (s.kind !== "setup" && s.kind !== "ending") out.push(renderHud(s.hud));
  if (s.kind === "plan") out.push(dim(wrap(s.hud.sky)));
  for (const l of s.lines) out.push(l ? wrap(l) : "");
  for (const l of s.observations) out.push(yellow(wrap("› " + l)));
  for (const l of s.notes) out.push(dim(wrap("· " + l)));
  if (s.store) {
    out.push("");
    out.push(`  ${"item".padEnd(16)} ${"price".padStart(5)} ${"sells".padStart(6)} ${"have".padStart(5)} ${"stock".padStart(6)}  note`);
    for (const l of s.store.lines) {
      out.push(`  ${l.id.padEnd(16)} ${String(l.price).padStart(5)} ${String(l.sellPrice).padStart(6)} ${String(l.owned).padStart(5)} ${String(l.stock >= 900 ? "∞" : l.stock).padStart(6)}  ${dim(l.blurb)}`);
    }
    out.push(dim("\n  commands: b <item> <n> (buy) · s <item> <n> (sell) · go (leave)"));
  }
  if (s.ending) out.push("", bold(`  Score: ${s.ending.score}`));
  s.options.forEach((o, i) => {
    const time = o.hours ? yellow(` [${o.hours}h]`) : "";
    const label = `${String(i + 1).padStart(2)}) ${o.label}${time}`;
    out.push(o.disabled ? dim(`${label}  (${o.disabled})`) : label);
    if (o.hint && !o.disabled) out.push(dim(wrap(o.hint, 88, "      ")));
  });
  return out.join("\n");
}

function newGame(): Game {
  const load = args.get("load");
  if (load) return Game.restore(readFileSync(load, "utf8"));
  const bg = args.get("background");
  if (bg && !BACKGROUNDS.some((b) => b.id === bg)) {
    console.error(`Unknown background. Choose: ${BACKGROUNDS.map((b) => b.id).join(", ")}`);
    process.exit(1);
  }
  const diff = (args.get("difficulty") ?? "normal") as keyof typeof DIFFICULTY;
  return Game.create({
    seed: args.get("seed") ? Number(args.get("seed")) : undefined,
    leaderName: args.get("name") ?? "Wagon-Master",
    background: bg,
    difficulty: diff,
  });
}

function findItem(name: string): ResourceId | undefined {
  return RESOURCE_IDS.find((id) => id.startsWith(name.toLowerCase()));
}

async function main(): Promise<void> {
  const game = newGame();
  const save = args.get("save");
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: false });
  const lines = rl[Symbol.asyncIterator]();
  const ask = async (prompt: string): Promise<string | null> => {
    process.stdout.write(prompt);
    const r = await lines.next();
    return r.done ? null : r.value.trim();
  };

  console.log(bold(red("\n  T H E   G R E A T   H A Z E")));
  console.log(dim("  A wagon train. A bleeding sky. Eight hundred and forty miles.\n"));

  let message = "";
  while (!game.over) {
    const s = game.screen();
    console.log(render(s));
    if (message) console.log(yellow("  " + message));
    message = "";
    const raw = await ask("\n> ");
    if (raw === null || raw === "q") break;
    try {
      if (s.kind === "store") {
        const [cmd, item, n] = raw.split(/\s+/);
        if (cmd === "go" || cmd === "") {
          game.choose("depart");
        } else if ((cmd === "b" || cmd === "s") && item) {
          const id = findItem(item);
          if (!id) message = `Unknown item: ${item}`;
          else message = game.trade(id, (cmd === "b" ? 1 : -1) * Math.max(1, Number(n ?? 1)));
        } else {
          const idx = Number(raw);
          if (Number.isInteger(idx) && s.options[idx - 1]) game.choose(s.options[idx - 1].id);
          else message = "Use: b <item> <n>, s <item> <n>, or go.";
        }
        continue;
      }
      const idx = Number(raw);
      if (!Number.isInteger(idx) || idx < 1 || idx > s.options.length) {
        message = "Choose a number from the list.";
        continue;
      }
      const opt = s.options[idx - 1];
      if (opt.disabled) {
        message = opt.disabled;
        continue;
      }
      game.choose(opt.id);
    } catch (e) {
      message = e instanceof Error ? e.message : String(e);
    }
  }
  if (game.over) console.log(render(game.screen()));
  if (save) {
    writeFileSync(save, game.serialize());
    console.log(dim(`\n  Saved to ${save}`));
  }
  rl.close();
}

main();

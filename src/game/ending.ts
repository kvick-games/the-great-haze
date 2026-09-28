// Run endings. `finish` is called from anywhere the run can end (a death, the
// Haze catching up, reaching the Gate) and freezes the state into an epilogue.

import type { EndingKind, GameState } from "./types.ts";
import { living } from "./party.ts";
import { TUNING } from "./tuning.ts";

export function computeScore(s: GameState, kind: EndingKind): number {
  const survivors = living(s);
  if (kind !== "victory") return Math.floor(s.miles / (kind === "consumed" ? 3 : 4));
  let score = 400;
  score += survivors.length * 150;
  score += Math.round(survivors.reduce((n, m) => n + m.health / 10, 0));
  score += Math.min(s.res.rations, 60);
  score += Math.round(s.scrip / 10);
  score += Math.round(Math.max(0, s.gap) * 2);
  score += survivors.filter((m) => m.recruited).length * 40;
  score -= survivors.filter((m) => m.fog > 0).length * 60;
  return score;
}

export function finish(s: GameState, kind: EndingKind, headline: string, lines: string[]): void {
  if (s.ending) return;
  const epilogue = lines.slice();
  epilogue.push("");
  for (const m of s.party) {
    if (m.alive) {
      const marked = m.fog > 0 ? ` marked by the Haze (stage ${m.fog})` : "";
      const verdict = m.dying ? "dying when it ended" : "survived";
      epilogue.push(`${m.name} (${m.role}) — ${verdict}${marked ? `,${marked}` : ""}.`);
    } else {
      epilogue.push(`${m.name} (${m.role}) — ${m.fate ?? "lost along the way"}.`);
    }
  }
  epilogue.push("");
  epilogue.push(
    `${Math.round(s.miles)} of ${TUNING.totalMiles} miles in ${s.day} days. ` +
      `${living(s).length} of ${s.party.length} who walked with you at the end.`,
  );
  s.ending = { kind, headline, lines: epilogue, score: computeScore(s, kind) };
  s.pending = { kind: "ending" };
  s.queue = [];
}

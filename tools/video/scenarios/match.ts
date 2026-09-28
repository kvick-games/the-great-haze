// Story-shape matchers for the search tool: given a run's beats, where does the wanted arc sit?
// Each returns every window that fits, scored, so the search can prefer the ones where the
// game's own spoken lines are strong and a dialogue check happens.

import { NPCS } from "../../../src/game/content/npcs.ts";
import { sceneById } from "../../../src/game/content/scenes/index.ts";
import type { Beat } from "../../../src/story/mutations.ts";

export interface Window {
  from: number;
  to: number;
  /** Higher is better: more speech, a check, grief. */
  score?: number;
}
export type Matcher = (beats: Beat[]) => Window[];

const has = (b: Beat, kind: string, subject?: string) => b.mutations.some((m) => m.kind === kind && (subject === undefined || m.subject === subject));
const slice = (beats: Beat[], w: Window) => beats.slice(w.from, w.to + 1);
const anyIn = (beats: Beat[], w: Window, kind: string) => slice(beats, w).some((b) => has(b, kind));

/** How much the game itself says in a window: spoken beats, a check that was made, distinct speakers. */
function speechScore(beats: Beat[], w: Window): number {
  const bs = slice(beats, w);
  const talk = bs.filter((b) => (b.talk ?? []).some((l) => l.phase === "outcome")).length;
  const speakers = new Set(bs.flatMap((b) => (b.talk ?? []).map((l) => l.key))).size;
  const checks = bs.filter((b) => b.check).length;
  return talk * 2 + speakers + checks * 4;
}

/** (a) A roadside stranger who is a trap: the party takes the bait, and the wound and the costume change follow at once. */
const stranger: Matcher = (beats) => {
  const out: Window[] = [];
  for (let i = 0; i < beats.length - 4; i++) {
    const b = beats[i];
    if (!b.sceneId || b.truth !== "trap" || b.choiceId === "pass" || sceneById(b.sceneId)?.kind !== "stranger") continue;
    if (!(b.talk ?? []).some((l) => l.kind === "stranger")) continue; // the stranger has to speak
    const woundAt = beats.slice(i + 1, i + 5).findIndex((x) => has(x, "wound"));
    if (woundAt < 0) continue;
    const to = i + 1 + woundAt;
    const win = { from: i, to: Math.max(i + 3, to) };
    if (!anyIn(beats, win, "costume")) continue;
    // Keep it one story: no other scene starts in between, only what the trap sets off.
    const stray = slice(beats, win).slice(1).filter((x) => x.sceneId && x.sceneId !== b.sceneId).length;
    if (stray > 1) continue;
    out.push({ ...win, score: speechScore(beats, win) + (b.check ? 4 : 0) - stray * 6 });
  }
  return out;
};

/** (b) The turned one is put down at night camp: the fog takes them by stages, the others watch, and grief is in the room. */
const death: Matcher = (beats) => {
  const out: Window[] = [];
  for (let i = 2; i < beats.length - 1; i++) {
    const b = beats[i];
    if (b.sceneId !== "turned" || b.choiceId !== "mercy" || !has(b, "death")) continue;
    const dead = b.mutations.find((m) => m.kind === "death")!.subject;
    const w = { from: Math.max(0, i - 3), to: Math.min(beats.length - 1, i + 1) };
    const bs = slice(beats, w);
    if (!bs.some((x) => x.kind === "camp") || !bs.some((x) => x.mutations.some((m) => m.kind === "fog" && m.subject === dead))) continue;
    const grief = bs.flatMap((x) => x.talk ?? []).filter((l) => l.mood === "grieving").length;
    out.push({ ...w, score: speechScore(beats, w) + grief * 3 });
  }
  return out;
};

/** (c) One of the nine named companions joins, then is taken by the fog sickness. */
const NPC_IDS = new Set(NPCS.map((n) => n.id));
const companion: Matcher = (beats) => {
  const out: Window[] = [];
  for (let i = 0; i < beats.length - 2; i++) {
    const j = beats[i].mutations.find((m) => m.kind === "join" && NPC_IDS.has(m.subject));
    if (!j) continue;
    for (let k = i + 1; k <= Math.min(beats.length - 1, i + 5); k++) {
      if (!beats[k].mutations.some((m) => (m.kind === "fog" || m.kind === "turning") && m.subject === j.subject)) continue;
      const win = { from: i, to: k };
      const own = slice(beats, win).flatMap((x) => x.talk ?? []).filter((l) => l.key === j.subject).length;
      out.push({ ...win, score: speechScore(beats, win) + own * 3 });
      break;
    }
  }
  return out;
};

export const MATCHERS: Record<string, Matcher> = { a: stranger, b: death, c: companion };

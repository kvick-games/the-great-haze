// Story-shape matchers for the search tool: given a run's beats, where does the wanted arc sit?

import type { Beat } from "../../../src/story/mutations.ts";

export interface Window {
  from: number;
  to: number;
}
export type Matcher = (beats: Beat[]) => Window | null;

const has = (b: Beat, kind: string, subject?: string) => b.mutations.some((m) => m.kind === kind && (subject === undefined || m.subject === subject));
const anyIn = (beats: Beat[], w: Window, kind: string) => beats.slice(w.from, w.to + 1).some((b) => has(b, kind));

/** (a) A roadside stranger who is a trap: the party takes the bait, someone is hurt, the costume changes. */
const STRANGER_SCENES = new Set(["wounded-traveler", "lost-child", "mother-and-child", "stranded-caravan"]);
const stranger: Matcher = (beats) => {
  for (let i = 0; i < beats.length - 4; i++) {
    const b = beats[i];
    if (!b.sceneId || !STRANGER_SCENES.has(b.sceneId) || b.truth !== "trap" || b.choiceId === "pass") continue;
    const w = { from: i, to: Math.min(beats.length - 1, i + 4) };
    const woundAt = beats.slice(w.from, w.to + 1).findIndex((x) => has(x, "wound"));
    if (woundAt < 0 || !anyIn(beats, w, "costume")) continue;
    return { from: i, to: Math.max(i + 3, i + woundAt) };
  }
  return null;
};

/** (b) A death in the party at night camp, with the others left standing around it. */
const death: Matcher = (beats) => {
  for (let i = 1; i < beats.length - 3; i++) {
    const b = beats[i];
    if (!(b.kind === "death" || has(b, "death")) || has(b, "turning")) continue;
    const w = { from: Math.max(0, i - 2), to: Math.min(beats.length - 1, i + 3) };
    if (beats.slice(w.from, w.to + 1).some((x) => x.kind === "camp") && b.participants.length >= 2) return w;
  }
  return null;
};

/** (c) A companion joins, then is taken by the fog sickness. */
const companion: Matcher = (beats) => {
  for (let i = 0; i < beats.length - 2; i++) {
    if (!beats[i].sceneId) continue; // a recruit met on the road, not the muster at Cinder Ford
    const j = beats[i].mutations.find((m) => m.kind === "join");
    if (!j) continue;
    for (let k = i + 1; k <= Math.min(beats.length - 1, i + 5); k++) {
      if (beats[k].mutations.some((m) => (m.kind === "fog" || m.kind === "turning") && m.subject === j.subject)) return { from: i, to: k };
    }
  }
  return null;
};

export const MATCHERS: Record<string, Matcher> = { a: stranger, b: death, c: companion };

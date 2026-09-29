// Turn a scenario definition into beats, shots, and the character references they need.

import { replay } from "./replay.ts";
import type { ReplayResult } from "./replay.ts";
import { scenarioById } from "./defs.ts";
import type { ScenarioDef } from "./defs.ts";
import type { Beat } from "../../../src/story/mutations.ts";
import { shotForBeat } from "../../../src/story/shots.ts";
import type { ShotRequest } from "../../../src/story/shots.ts";
import type { StoryRecorder } from "../../../src/story/recorder.ts";
import { baseSheets, runSheets } from "../refs.ts";
import type { RefNeed } from "../refs.ts";

export interface Segment {
  /** "main" or "fork". */
  name: string;
  beats: Beat[];
  shots: ShotRequest[];
  recorder: StoryRecorder;
  /** The choice ids that produced each beat. */
  choices: string[];
}

export interface Scenario {
  def: ScenarioDef;
  main: Segment;
  fork: Segment;
  /** Everyone who appears in either segment. */
  cast: string[];
  /** Reference stills needed (base sheets plus each look used), de-duplicated. */
  refNeeds: RefNeed[];
}

/** Most reference images a clip on a 12 GiB card gets. Identity first, then the base look for anyone drawn differently. */
export const MAX_REFS = 6;
export const MAX_NAMED = 4;

export function selectRefs(req: ShotRequest): ShotRequest["references"] {
  const out: ShotRequest["references"] = [];
  const add = (r: ShotRequest["references"][number] | undefined) => {
    if (r && out.length < MAX_REFS && !out.some((x) => x.datom_id === r.datom_id && x.slot_key === r.slot_key)) out.push(r);
  };
  const chars = [...new Set(req.references.map((r) => r.character))];
  const lead = chars.slice(0, MAX_NAMED);
  for (const c of lead) add(req.references.find((r) => r.character === c && r.state !== "ending"));
  // A transition shot attaches the ending state beside the opening one.
  for (const c of lead) add(req.references.find((r) => r.character === c && r.state === "ending"));
  for (const c of lead) add(req.references.find((r) => r.character === c && r.slot_key === "hero"));
  for (const c of chars.slice(MAX_NAMED)) add(req.references.find((r) => r.character === c));
  return out;
}

function segment(name: string, r: ReplayResult, indexes: number[]): Segment {
  const beats = indexes.map((i) => r.recorder.beats[i]);
  const shots = beats.map((b) => shotForBeat(b, r.recorder.log, { specs: r.recorder.characters, resolution: "480P" }));
  return { name, beats, shots, recorder: r.recorder, choices: indexes.map((i) => r.choices[r.stepOfBeat[i]]) };
}

export function buildScenario(idOrDef: string | ScenarioDef): Scenario {
  const def = typeof idOrDef === "string" ? scenarioById(idOrDef) : idOrDef;
  const full = replay({ strategy: def.strategy, seed: def.seed });
  const inWindow: number[] = [];
  for (let i = def.from; i <= def.to && i < full.recorder.beats.length; i++) if (!def.skip?.includes(i)) inWindow.push(i);
  const main = segment("main", full, inWindow);

  const forkStep = full.stepOfBeat[def.fork.atBeat];
  const alt = replay({ strategy: def.strategy, seed: def.seed, overrides: { [forkStep]: def.fork.alt }, stopAfterStep: forkStep + 40 });
  const altIdx: number[] = [];
  for (let i = 0; i < alt.recorder.beats.length && altIdx.length < def.fork.take; i++) if (alt.stepOfBeat[i] >= forkStep) altIdx.push(i);
  const fork = segment("fork", alt, altIdx);

  const chosen = [...main.shots, ...fork.shots].flatMap((s) => selectRefs(s));
  const cast = [...new Set(chosen.map((r) => r.character))];
  const wanted = new Set(chosen.map((r) => `${r.datom_id}:${r.slot_key}`));
  const seen = new Set<string>();
  const refNeeds: RefNeed[] = [];
  for (const seg of [main, fork]) {
    for (const n of runSheets(seg.recorder.log, seg.recorder.runRecord.options)) {
      const id = `${n.datom_id}:${n.slot_key}`;
      if (seen.has(id)) continue;
      const base = n.version === 1;
      const key = cast.includes(n.character);
      // Base: the three stills that carry identity. Later looks: only the ones a shot really uses.
      if (!key || (base && !["hero", "front_view", "three_quarter"].includes(n.slot_key)) || (!base && !wanted.has(id))) continue;
      seen.add(id);
      refNeeds.push(n);
    }
  }
  // Archetypes (a stranger, raiders) are not in the datom log; give them their base stills too.
  for (const key of cast) {
    if (refNeeds.some((n) => n.character === key)) continue;
    for (const n of baseSheets([key], main.recorder.runRecord.options)) if (["hero", "front_view", "three_quarter"].includes(n.slot_key)) refNeeds.push(n);
  }
  return { def, main, fork, cast, refNeeds };
}

// The recorder keeps one run's story: the datom log, the beats, and enough of the
// starting state to derive the story graph. The web client, the bot exporter and the
// tests all drive it the same way: call record(before, after, choiceId) per choice.

import { baseLook, characterSpecs, lookLabel, lookSignature, slotKeyFor } from "./characters.ts";
import type { CharacterSpec, CharacterSpecOptions } from "./characters.ts";
import { DatomLog, fnv1a, stableStringify } from "./datoms.ts";
import type { DatomLogJson, Json, TxOp } from "./datoms.ts";
import { ATTR, charEntity, chronicle, lookOps, newLog, toSnapshot } from "./mutations.ts";
import type { Beat, BeatScreens, SnapshotInput, StorySnapshot } from "./mutations.ts";

export interface RunRecord {
  runId: string;
  seed: number | string;
  leaderName: string;
  leaderRole?: string;
  options: CharacterSpecOptions;
  initial: StorySnapshot;
  beats: Beat[];
}

export interface RecorderSave {
  version: 1;
  run: RunRecord;
  log: DatomLogJson;
  /** Choices seen that made no story (nothing changed). */
  skipped: number;
}

export class StoryRecorder {
  log: DatomLog;
  beats: Beat[] = [];
  skipped = 0;
  readonly run: Omit<RunRecord, "beats">;
  private specs: CharacterSpec[];

  private constructor(run: Omit<RunRecord, "beats">, log: DatomLog) {
    this.run = run;
    this.log = log;
    this.specs = characterSpecs(run.options);
  }

  /** Begin a run from its first state (the muster is not yet chosen; only the leader exists). */
  static start(initialInput: SnapshotInput, opts: { seed?: number | string; runId?: string; options?: CharacterSpecOptions } = {}): StoryRecorder {
    const initial = toSnapshot(initialInput);
    const leader = initial.party.find((m) => m.isLeader);
    const options: CharacterSpecOptions = { ...(opts.options ?? {}), leader: { name: leader?.name ?? "The Wagon-Master", role: leader?.role, traits: leader?.traits } };
    const seed = opts.seed ?? 0;
    const runId = opts.runId ?? `run-${fnv1a(stableStringify([seed, leader?.name ?? ""]))}`;
    const rec = new StoryRecorder({ runId, seed, leaderName: leader?.name ?? "The Wagon-Master", leaderRole: leader?.role, options, initial }, newLog());
    const ops: TxOp[] = [];
    for (const m of initial.party) {
      const key = m.isLeader ? "leader" : m.id;
      const spec = rec.specs.find((s) => s.key === key);
      const look = baseLook(spec?.kit ?? []);
      const sig = lookSignature(look);
      ops.push(...lookOps(key, look));
      ops.push({ e: charEntity(key), a: ATTR.region, v: initial.region });
      ops.push({ e: charEntity(key), a: ATTR.sigs, v: [sig] });
      ops.push({ e: charEntity(key), a: ATTR.version, v: 1 });
      ops.push({ e: charEntity(key), a: ATTR.slot, v: slotKeyFor(lookLabel(look, spec?.kit ?? []), 1) });
      ops.push({ e: charEntity(key), a: ATTR.label, v: "base" });
    }
    ops.push({ e: "party", a: ATTR.region, v: initial.region });
    rec.log.transact(ops, { start: true });
    return rec;
  }

  get runRecord(): RunRecord {
    return { ...this.run, beats: this.beats };
  }

  /** The specs for everyone this run knows about (base cast plus any NPCs supplied). */
  get characters(): CharacterSpec[] {
    return this.specs;
  }

  /** Chronicle one choice. `screens` (the screen before the choice and the one it returned) adds speech, the check and the route. Returns the recorded beat, or null when nothing worth telling happened. */
  record(before: SnapshotInput, after: SnapshotInput, choiceId: string, text?: string[], screens?: BeatScreens): Beat | null {
    const { beat, mutations } = chronicle(before, after, choiceId, { index: this.beats.length, log: this.log, specs: this.specs, text, screens });
    if (beat.stakes === "quiet" && !mutations.length) {
      this.skipped++;
      return null;
    }
    const ops = mutations.flatMap((m) => m.ops);
    beat.tx = this.log.transact(ops, { beat: beat.id, kind: beat.kind, template: beat.templateKey, choice: choiceId } as Json);
    this.beats.push(beat);
    return beat;
  }

  serialize(): string {
    const save: RecorderSave = { version: 1, run: this.runRecord, log: this.log.toJSON(), skipped: this.skipped };
    return stableStringify(save);
  }

  static restore(raw: string): StoryRecorder {
    const save = JSON.parse(raw) as RecorderSave;
    if (save.version !== 1) throw new Error("Unknown story save version");
    const { beats, ...run } = save.run;
    const rec = new StoryRecorder(run, DatomLog.fromJSON(save.log));
    rec.beats = beats;
    rec.skipped = save.skipped;
    return rec;
  }
}


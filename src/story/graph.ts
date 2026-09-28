// The run as a Hyperlab story graph (a "sequence": kind hyperlab.sequence, version 2).
//
// Entities are instances bound to Ether datoms. A state is a COMPLETE snapshot of every
// entity. A transition is one story beat, written as Hyperlab's own action types; the
// state after it is derived by applying those actions, never written by hand (Hyperlab
// only lets the start state be edited). The graph is derived from a RunRecord, so it can
// always be rebuilt from the saved datom log and beats.

import { characterSpecs, environmentSpecs, PROPS, ROLE_PROP } from "./characters.ts";
import type { CharacterSpec } from "./characters.ts";
import { etherId, fnv1a, stableStringify } from "./datoms.ts";
import type { EtherType, Json } from "./datoms.ts";
import type { Mutation } from "./mutations.ts";
import type { RunRecord } from "./recorder.ts";

export { enumerateStaticGraph } from "./catalog.ts";
export type { StaticBeat, StaticGraph } from "./catalog.ts";

export const CONTRACTS = {
  character: "contract.state/CharacterStoryState@1",
  prop: "contract.state/PropStoryState@1",
  environment: "contract.state/EnvironmentStoryState@1",
  fact: "story.fact/OpenFact@1",
} as const;

export const ACTION_TYPES = [
  "move_character",
  "take_prop",
  "unequip_prop",
  "equip_prop",
  "place_prop",
  "set_presence",
  "set_flag",
  "set_fact",
  "clear_fact",
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export interface ReferenceBinding {
  datom_id: string;
  slot_key: string;
  role?: string;
  selector?: string;
}

export interface Fact {
  contract: typeof CONTRACTS.fact;
  value: Json;
  reference_bindings: ReferenceBinding[];
  note?: string;
  introduced_by?: string;
}

export type Action =
  | { type: "move_character"; character_id: string; environment_id: string }
  | { type: "take_prop"; prop_id: string; character_id: string }
  | { type: "unequip_prop"; prop_id: string; character_id: string }
  | { type: "equip_prop"; prop_id: string; character_id: string; slot: string }
  | { type: "place_prop"; prop_id: string; environment_id: string; anchor: string }
  | { type: "set_presence"; entity_id: string; present: boolean }
  | { type: "set_flag"; entity_id: string; flag: string; value: boolean | null }
  | { type: "set_fact"; entity_id: string; fact_id: string; contract: typeof CONTRACTS.fact; value: Json; reference_bindings: ReferenceBinding[]; note?: string }
  | { type: "clear_fact"; entity_id: string; fact_id: string };

export interface CharacterState {
  present: boolean;
  location: string | null;
  flags: Record<string, boolean | null>;
  facts?: Record<string, Fact>;
}

export type Placement = { kind: "located"; environment_id: string; anchor?: string } | { kind: "carried"; character_id: string } | { kind: "equipped"; character_id: string; slot: string };

export interface PropState {
  present: boolean;
  placement: Placement | null;
  flags: Record<string, boolean | null>;
  facts?: Record<string, Fact>;
}

export interface EnvironmentState {
  present: boolean;
  flags: Record<string, boolean | null>;
  facts?: Record<string, Fact>;
}

export type EntityState = CharacterState | PropState | EnvironmentState;

export interface SeqEntity {
  instance_id: string;
  datom_id: string;
  datom_type: EtherType;
  state_contract: string;
  display_cache: { name: string };
  ui: { x: number; y: number };
}

export interface SeqState {
  id: string;
  name: string;
  x: number;
  y: number;
  state: Record<string, EntityState>;
  canonical_state_hash: string;
  takes: unknown[];
  primary_take_id: string | null;
}

export interface SeqTransition {
  id: string;
  from_state_id: string;
  to_state_id: string;
  label: string;
  preconditions: unknown[];
  actions: Action[];
  enabled: boolean;
  ordinal: number;
}

export interface SequenceFile {
  kind: "hyperlab.sequence";
  version: 2;
  id: string;
  revision: number;
  description: string;
  start_state_id: string;
  settings: { loop_to_start_on_dead_end: boolean; auto_advance_delay_ms: number; shot_source?: string };
  entities: SeqEntity[];
  states: SeqState[];
  transitions: SeqTransition[];
  rules: unknown[];
  simulation_runs: unknown[];
  generation_plans: unknown[];
}

// ---------------------------------------------------------------------------
// Ids
// ---------------------------------------------------------------------------

export const charInstance = (key: string): string => `char.${key}`;
export const propInstance = (prop: string, owner: string): string => `prop.${prop}.${owner}`;
export const envInstance = (key: string): string => `env.${key}`;

export function envKeyFor(day: number, region: string): string {
  return day === 0 ? "cinder-ford" : `region.${region}`;
}

// ---------------------------------------------------------------------------
// Applying actions (the rule Hyperlab uses to derive a state from its parent)
// ---------------------------------------------------------------------------

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function isCharacter(s: EntityState): s is CharacterState {
  return "location" in s;
}
function isProp(s: EntityState): s is PropState {
  return "placement" in s;
}

export function applyAction(state: Record<string, EntityState>, a: Action, introducedBy?: string): void {
  const need = (id: string): EntityState => {
    const e = state[id];
    if (!e) throw new Error(`Action ${a.type} names unknown entity ${id}`);
    return e;
  };
  switch (a.type) {
    case "move_character": {
      const c = need(a.character_id);
      if (!isCharacter(c)) throw new Error(`${a.character_id} is not a character`);
      c.location = a.environment_id;
      return;
    }
    case "take_prop": {
      const p = need(a.prop_id);
      if (isProp(p)) p.placement = { kind: "carried", character_id: a.character_id };
      return;
    }
    case "unequip_prop": {
      const p = need(a.prop_id);
      if (isProp(p)) p.placement = { kind: "carried", character_id: a.character_id };
      return;
    }
    case "equip_prop": {
      const p = need(a.prop_id);
      if (isProp(p)) p.placement = { kind: "equipped", character_id: a.character_id, slot: a.slot };
      return;
    }
    case "place_prop": {
      const p = need(a.prop_id);
      if (isProp(p)) p.placement = { kind: "located", environment_id: a.environment_id, anchor: a.anchor };
      return;
    }
    case "set_presence": {
      const e = need(a.entity_id);
      e.present = a.present;
      if (!a.present) {
        if (isCharacter(e)) e.location = null;
        else if (isProp(e)) e.placement = null;
      }
      return;
    }
    case "set_flag": {
      need(a.entity_id).flags[a.flag] = a.value;
      return;
    }
    case "set_fact": {
      const e = need(a.entity_id);
      e.facts = e.facts ?? {};
      const fact: Fact = { contract: a.contract, value: a.value, reference_bindings: a.reference_bindings };
      if (a.note) fact.note = a.note;
      if (introducedBy) fact.introduced_by = introducedBy;
      e.facts[a.fact_id] = fact;
      return;
    }
    case "clear_fact": {
      const e = need(a.entity_id);
      if (e.facts) delete e.facts[a.fact_id];
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// Mutations to actions
// ---------------------------------------------------------------------------

interface Ctx {
  envId: string;
  propSlot: (prop: string) => string;
  charDatom: (key: string) => string;
  hasEntity: (id: string) => boolean;
  present: (id: string) => boolean;
}

interface Phased {
  phase: number;
  action: Action;
}

function fact(entity_id: string, fact_id: string, value: Json, refs: ReferenceBinding[] = [], note?: string): Action {
  const a: Action = { type: "set_fact", entity_id, fact_id, contract: CONTRACTS.fact, value, reference_bindings: refs };
  if (note) a.note = note;
  return a;
}

function mutationActions(m: Mutation, ctx: Ctx): Phased[] {
  const out: Phased[] = [];
  const add = (phase: number, action: Action) => out.push({ phase, action });
  const c = charInstance(m.subject);
  if (m.subject === "party") return out;
  if (m.subject === "train") {
    add(1, fact(charInstance("leader"), "wagons", m.to ?? null, [], m.summary));
    return out;
  }
  if (!ctx.hasEntity(c)) return out;
  switch (m.kind) {
    case "join": {
      add(0, { type: "set_presence", entity_id: c, present: true });
      add(0, { type: "move_character", character_id: c, environment_id: ctx.envId });
      break;
    }
    case "death":
    case "departure":
    case "turning": {
      const flag = m.kind === "death" ? "dead" : m.kind === "turning" ? "turned" : "departed";
      add(1, { type: "set_flag", entity_id: c, flag, value: true });
      const fate = m.summary;
      add(1, fact(c, "fate", fate, [], m.summary));
      add(3, { type: "set_presence", entity_id: c, present: false });
      break;
    }
    case "wound":
      add(1, { type: "set_flag", entity_id: c, flag: "wounded", value: true });
      break;
    case "heal":
      add(1, { type: "set_flag", entity_id: c, flag: "wounded", value: false });
      break;
    case "dying":
      add(1, { type: "set_flag", entity_id: c, flag: "dying", value: true });
      break;
    case "stabilize":
      add(1, { type: "set_flag", entity_id: c, flag: "dying", value: false });
      break;
    case "maim":
      add(1, fact(c, "maimed", true, [], m.summary));
      break;
    case "fog":
      add(1, fact(c, "fog_stage", m.to ?? 0, [], m.summary));
      break;
    case "fog-ease":
      if (m.to === 0) add(1, { type: "clear_fact", entity_id: c, fact_id: "fog_stage" });
      else add(1, fact(c, "fog_stage", m.to ?? 0, [], m.summary));
      break;
    case "sick":
      add(1, { type: "set_flag", entity_id: c, flag: "sick", value: true });
      break;
    case "recover":
      add(1, { type: "set_flag", entity_id: c, flag: "sick", value: false });
      break;
    case "starving":
      add(1, { type: "set_flag", entity_id: c, flag: "gaunt", value: true });
      break;
    case "costume":
      if (m.to === "travel") add(1, { type: "clear_fact", entity_id: c, fact_id: "costume" });
      else add(1, fact(c, "costume", m.to ?? null, [], m.summary));
      break;
    case "prop-gained": {
      const p = propInstance(m.prop!, m.subject);
      if (!ctx.hasEntity(p)) break;
      if (!ctx.present(p)) add(0, { type: "set_presence", entity_id: p, present: true });
      add(1, { type: "equip_prop", prop_id: p, character_id: c, slot: ctx.propSlot(m.prop!) });
      break;
    }
    case "prop-lost": {
      const p = propInstance(m.prop!, m.subject);
      if (!ctx.hasEntity(p)) break;
      add(0, { type: "unequip_prop", prop_id: p, character_id: c });
      add(0, { type: "place_prop", prop_id: p, environment_id: ctx.envId, anchor: "ground" });
      break;
    }
    case "look": {
      const to = m.ops.find((o) => o.a === "visual/version")?.v ?? 1;
      const slot = String(m.ops.find((o) => o.a === "visual/slot")?.v ?? "hero");
      const label = String(m.ops.find((o) => o.a === "visual/label")?.v ?? "base");
      add(2, fact(c, "look", { version: to, slot, label }, [{ datom_id: ctx.charDatom(m.subject), slot_key: slot, role: "identity" }], m.summary));
      break;
    }
    default:
      break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Building the sequence
// ---------------------------------------------------------------------------

export interface BuiltGraph {
  sequence: SequenceFile;
  /** Beat index (in run.beats) to the state that follows it, for shot lookups. */
  stateAfterBeat: Record<string, string>;
  specs: CharacterSpec[];
}

function stateHash(s: Record<string, EntityState>): string {
  const t = stableStringify(s);
  return fnv1a(t) + fnv1a(t.split("").reverse().join(""));
}

export function buildStoryGraph(run: RunRecord): BuiltGraph {
  const specs = characterSpecs(run.options);
  const spec = (k: string) => specs.find((s) => s.key === k);
  const chars: string[] = [];
  const noteChar = (k: string) => {
    if (k.startsWith("archetype.")) return;
    if (!chars.includes(k) && spec(k)) chars.push(k);
  };
  noteChar("leader");
  for (const m of run.initial.party) noteChar(m.isLeader ? "leader" : m.id);
  for (const b of run.beats) {
    for (const k of b.participants) noteChar(k);
    for (const m of b.mutations) if (m.subject !== "party" && m.subject !== "train") noteChar(m.subject);
  }
  const propOwners: { prop: string; owner: string }[] = [];
  const notePropOwner = (prop: string, owner: string) => {
    if (!PROPS[prop]) return;
    if (!propOwners.some((p) => p.prop === prop && p.owner === owner)) propOwners.push({ prop, owner });
  };
  for (const k of chars) for (const p of spec(k)?.kit ?? []) notePropOwner(p, k);
  for (const b of run.beats) for (const m of b.mutations) if (m.prop && (m.kind === "prop-gained" || m.kind === "prop-lost")) notePropOwner(m.prop, m.subject);
  const startEnv = "cinder-ford";
  const envKeys = [startEnv];
  for (const b of run.beats) {
    const k = envKeyFor(b.day, b.region);
    if (!envKeys.includes(k)) envKeys.push(k);
    const r = `region.${b.region}`;
    if (!envKeys.includes(r)) envKeys.push(r);
  }
  const envSpecs = environmentSpecs();

  const entities: SeqEntity[] = [];
  chars.forEach((k, i) => {
    entities.push({ instance_id: charInstance(k), datom_id: etherId("char", k), datom_type: "concept.character", state_contract: CONTRACTS.character, display_cache: { name: spec(k)!.name }, ui: { x: 0, y: i * 90 } });
  });
  propOwners.forEach((p, i) => {
    entities.push({ instance_id: propInstance(p.prop, p.owner), datom_id: etherId("prop", p.prop), datom_type: "concept.prop", state_contract: CONTRACTS.prop, display_cache: { name: `${PROPS[p.prop].name} (${spec(p.owner)?.name ?? p.owner})` }, ui: { x: 240, y: i * 60 } });
  });
  envKeys.forEach((k, i) => {
    const e = envSpecs.find((x) => x.key === k);
    entities.push({ instance_id: envInstance(k), datom_id: etherId("env", k), datom_type: "concept.environment", state_contract: CONTRACTS.environment, display_cache: { name: e?.name ?? k }, ui: { x: 480, y: i * 90 } });
  });

  // Start state: the leader stands in Cinder Ford with their kit; everyone else is absent.
  const start: Record<string, EntityState> = {};
  const initialKeys = run.initial.party.filter((m) => m.alive).map((m) => (m.isLeader ? "leader" : m.id));
  for (const k of chars) {
    const here = initialKeys.includes(k);
    start[charInstance(k)] = { present: here, location: here ? envInstance(startEnv) : null, flags: {} };
  }
  for (const p of propOwners) {
    const carried = initialKeys.includes(p.owner) && (spec(p.owner)?.kit ?? []).includes(p.prop);
    start[propInstance(p.prop, p.owner)] = carried
      ? { present: true, placement: { kind: "equipped", character_id: charInstance(p.owner), slot: PROPS[p.prop].slot }, flags: {} }
      : { present: false, placement: null, flags: {} };
  }
  for (const k of envKeys) start[envInstance(k)] = { present: true, flags: {} };

  const seqId = `seq-${run.runId}`;
  const states: SeqState[] = [];
  const transitions: SeqTransition[] = [];
  const stateAfterBeat: Record<string, string> = {};
  states.push({ id: "state-0", name: "Cinder Ford", x: 0, y: 0, state: clone(start), canonical_state_hash: stateHash(start), takes: [], primary_take_id: null });
  let cur = clone(start);
  let curId = "state-0";
  let partyEnv = envInstance(startEnv);

  for (const b of run.beats) {
    const envId = envInstance(envKeyFor(b.day, b.region));
    const ctx: Ctx = {
      envId,
      propSlot: (p) => PROPS[p]?.slot ?? "main_hand",
      charDatom: (k) => etherId("char", k),
      hasEntity: (id) => id in cur,
      present: (id) => cur[id]?.present === true,
    };
    const phased: Phased[] = [];
    // The whole train moves together when the region (or the town) changes.
    if (envId !== partyEnv) {
      for (const k of chars) {
        const c = cur[charInstance(k)] as CharacterState;
        if (c.present) phased.push({ phase: 0, action: { type: "move_character", character_id: charInstance(k), environment_id: envId } });
      }
      partyEnv = envId;
    }
    for (const m of b.mutations) phased.push(...mutationActions(m, ctx));
    if (!phased.length) {
      phased.push({ phase: 1, action: fact(charInstance("leader"), "last_beat", b.templateKey, [], b.title) });
    } else if (b.stakes !== "quiet") {
      phased.push({ phase: 4, action: fact(charInstance("leader"), "last_beat", b.templateKey, [], b.title) });
    }
    // A join brings their kit with them, after they are present.
    const extra: Phased[] = [];
    for (const m of b.mutations) {
      if (m.kind !== "join") continue;
      for (const op of m.ops) {
        if (op.a !== "look/kit") continue;
        const prop = String(op.v);
        const p = propInstance(prop, m.subject);
        if (!(p in cur)) continue;
        extra.push({ phase: 1, action: { type: "set_presence", entity_id: p, present: true } });
        extra.push({ phase: 1, action: { type: "equip_prop", prop_id: p, character_id: charInstance(m.subject), slot: PROPS[prop].slot } });
      }
    }
    phased.push(...extra);
    const actions = phased
      .map((p, i) => ({ ...p, i }))
      .sort((x, y) => x.phase - y.phase || x.i - y.i)
      .map((p) => p.action)
      .filter((a) => {
        // Never ask to move an absent character.
        if (a.type === "move_character") return (cur[a.character_id] as CharacterState | undefined) !== undefined;
        return true;
      });
    const tId = `t-${b.index}`;
    const next = clone(cur);
    for (const a of actions) applyAction(next, a, tId);
    const sId = `state-${b.index + 1}`;
    states.push({ id: sId, name: b.title.slice(0, 60), x: (b.index + 1) * 260, y: (b.index % 2) * 140, state: clone(next), canonical_state_hash: stateHash(next), takes: [], primary_take_id: null });
    transitions.push({ id: tId, from_state_id: curId, to_state_id: sId, label: `${b.title} [${b.choiceId}]`, preconditions: [], actions, enabled: true, ordinal: b.index });
    stateAfterBeat[b.id] = sId;
    cur = next;
    curId = sId;
  }

  const sequence: SequenceFile = {
    kind: "hyperlab.sequence",
    version: 2,
    id: seqId,
    revision: 1,
    description: `The Great Haze, run ${run.runId} (seed ${run.seed}): ${run.leaderName}'s train, one transition per story beat.`,
    start_state_id: "state-0",
    settings: { loop_to_start_on_dead_end: false, auto_advance_delay_ms: 0, shot_source: "the-great-haze" },
    entities,
    states,
    transitions,
    rules: [],
    simulation_runs: [],
    generation_plans: [],
  };
  return { sequence, stateAfterBeat, specs };
}

/** Structural checks a sequence must pass to load in Hyperlab. Empty means valid. */
export function validateSequence(seq: SequenceFile): string[] {
  const problems: string[] = [];
  const ids = new Set(seq.entities.map((e) => e.instance_id));
  const stateIds = new Set(seq.states.map((s) => s.id));
  if (seq.kind !== "hyperlab.sequence" || seq.version !== 2) problems.push("wrong kind or version");
  if (!stateIds.has(seq.start_state_id)) problems.push("start state missing");
  const contractOf: Record<string, string> = {
    "concept.character": CONTRACTS.character,
    "concept.prop": CONTRACTS.prop,
    "concept.environment": CONTRACTS.environment,
  };
  for (const e of seq.entities) if (contractOf[e.datom_type] !== e.state_contract) problems.push(`entity ${e.instance_id} has the wrong state contract`);
  for (const s of seq.states) {
    for (const id of ids) if (!(id in s.state)) problems.push(`state ${s.id} is missing ${id}`);
    for (const id of Object.keys(s.state)) if (!ids.has(id)) problems.push(`state ${s.id} has stray ${id}`);
    for (const e of seq.entities) {
      const st = s.state[e.instance_id];
      if (!st) continue;
      if (isCharacter(st)) {
        if (!st.present && st.location !== null) problems.push(`state ${s.id}: absent ${e.instance_id} has a location`);
        if (st.present && (st.location === null || !ids.has(st.location))) problems.push(`state ${s.id}: present ${e.instance_id} has no valid location`);
      }
      if (isProp(st)) {
        const pl = st.placement;
        if (st.present && !pl) problems.push(`state ${s.id}: present ${e.instance_id} has no placement`);
        if (pl && pl.kind !== "located" && !ids.has(pl.character_id)) problems.push(`state ${s.id}: ${e.instance_id} held by unknown ${pl.character_id}`);
        if (pl && pl.kind === "located" && !ids.has(pl.environment_id)) problems.push(`state ${s.id}: ${e.instance_id} placed in unknown ${pl.environment_id}`);
      }
      for (const [fid, f] of Object.entries(st.facts ?? {})) {
        if (f.contract !== CONTRACTS.fact) problems.push(`state ${s.id}: fact ${fid} has the wrong contract`);
        if (!Array.isArray(f.reference_bindings)) problems.push(`state ${s.id}: fact ${fid} has no reference_bindings`);
      }
    }
  }
  for (const t of seq.transitions) {
    if (!stateIds.has(t.from_state_id) || !stateIds.has(t.to_state_id)) problems.push(`transition ${t.id} links a missing state`);
    if (!t.actions.length) problems.push(`transition ${t.id} has no actions`);
    for (const a of t.actions) if (!(ACTION_TYPES as readonly string[]).includes(a.type)) problems.push(`transition ${t.id}: bad action ${a.type}`);
  }
  return problems;
}

export { ROLE_PROP };

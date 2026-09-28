// Datoms, in the two senses this project needs.
//
// 1. Ether records: the typed records Hyperlab keeps for characters, props and
//    environments ({id, type, name, meta, links[]}). They are the things a video
//    is generated FROM. Their ids are deterministic, so exporting twice is a no-op.
// 2. The datom log: a small append-only log of game-side facts in EAVT form
//    ([entity, attribute, value, tx, added]). It is the game's own source of truth
//    for "what changed and when". The Hyperlab adapter maps it onto set_fact /
//    clear_fact / equip_prop / set_presence actions.
//
// Pure TypeScript: no DOM, Node, engine or rendering imports; deterministic.

export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

/** JSON with sorted object keys, so equal values always serialise identically. */
export function stableStringify(v: unknown): string {
  if (v === undefined) return "null";
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(stableStringify).join(",") + "]";
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify(o[k])).join(",") + "}";
}

/** 32-bit FNV-1a as 8 hex chars. Enough for cache keys and state hashes; not a security primitive. */
export function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ---------------------------------------------------------------------------
// Ether records
// ---------------------------------------------------------------------------

export type EtherType = "concept.character" | "concept.prop" | "concept.environment";

/** A slot is a link with rel "slot.<key>" and mode "virtual" until an asset is attached. */
export interface EtherLink {
  rel: string;
  mode: "virtual";
}

export interface EtherRecord {
  id: string;
  type: EtherType;
  name: string;
  meta: { [k: string]: Json };
  links: EtherLink[];
}

/** The slots iface.character defines. `hero` is the identity anchor. */
export const CHARACTER_SLOTS = [
  "hero",
  "front_view",
  "three_quarter",
  "left_view",
  "right_view",
  "back_view",
  "character_sheet",
  "outfit_variants",
  "state_variants",
] as const;

export function slotLink(slotKey: string): EtherLink {
  return { rel: `slot.${slotKey}`, mode: "virtual" };
}

/** Deterministic record ids, namespaced so they never collide with anything else in an Ether store. */
export function etherId(kind: "char" | "prop" | "env", key: string): string {
  return `gh-${kind}-${slug(key)}`;
}

/**
 * Adding a look never rewrites the base record: the base fields are copied as they were
 * and only a new slot link is appended (Hyperlab keeps injured or costumed looks as
 * state_variants / outfit_variants slots on the SAME character record).
 */
export function withSlots(rec: EtherRecord, slotKeys: string[]): EtherRecord {
  const have = new Set(rec.links.map((l) => l.rel));
  const links = rec.links.slice();
  for (const k of slotKeys) {
    const link = slotLink(k);
    if (!have.has(link.rel)) {
      links.push(link);
      have.add(link.rel);
    }
  }
  return { ...rec, links };
}

// ---------------------------------------------------------------------------
// The datom log
// ---------------------------------------------------------------------------

/** [entity, attribute, value, tx, added] */
export type Datom = readonly [string, string, Json, number, boolean];

export interface TxOp {
  e: string;
  a: string;
  v: Json;
  /** Retract this value (or, for a one-valued attribute, whatever it is now). */
  retract?: boolean;
}

export interface DatomLogJson {
  version: 1;
  many: string[];
  tx: number;
  datoms: Datom[];
  notes: { [tx: string]: Json };
}

export class DatomLog {
  private readonly many: Set<string>;
  private rows: Datom[] = [];
  private notes = new Map<number, Json>();
  private tx = 0;

  /** Attributes named in `many` hold sets of values; every other attribute holds one value. */
  constructor(many: Iterable<string> = []) {
    this.many = new Set(many);
  }

  get lastTx(): number {
    return this.tx;
  }

  get size(): number {
    return this.rows.length;
  }

  /**
   * Append one transaction and return its tx number. Every call takes a tx, even an empty
   * one, so a story beat and its tx stay in lock-step. Assertions that would not change
   * the world are dropped, so the log never records a no-op.
   */
  transact(ops: TxOp[], note?: Json): number {
    const tx = ++this.tx;
    for (const op of ops) {
      const cur = this.valuesAt(op.e, op.a, tx - 1);
      if (op.retract) {
        for (const v of cur) {
          if (this.many.has(op.a) && stableStringify(v) !== stableStringify(op.v)) continue;
          this.rows.push([op.e, op.a, v, tx, false]);
        }
        continue;
      }
      if (this.many.has(op.a)) {
        if (cur.some((v) => stableStringify(v) === stableStringify(op.v))) continue;
        this.rows.push([op.e, op.a, op.v, tx, true]);
        continue;
      }
      if (cur.length === 1 && stableStringify(cur[0]) === stableStringify(op.v)) continue;
      for (const v of cur) this.rows.push([op.e, op.a, v, tx, false]);
      this.rows.push([op.e, op.a, op.v, tx, true]);
    }
    if (note !== undefined) this.notes.set(tx, note);
    return tx;
  }

  private valuesAt(e: string, a: string, asOf: number): Json[] {
    const out: Json[] = [];
    for (const [re, ra, v, tx, added] of this.rows) {
      if (re !== e || ra !== a || tx > asOf) continue;
      const key = stableStringify(v);
      const at = out.findIndex((x) => stableStringify(x) === key);
      if (added) {
        if (at < 0) out.push(v);
      } else if (at >= 0) out.splice(at, 1);
    }
    return out;
  }

  /** The entity's attributes as of a tx (default: now). One-valued attributes map to the value, sets to an array. */
  entity(e: string, asOf: number = this.tx): { [attr: string]: Json } {
    const attrs = new Set<string>();
    for (const [re, ra, , tx] of this.rows) if (re === e && tx <= asOf) attrs.add(ra);
    const out: { [attr: string]: Json } = {};
    for (const a of [...attrs].sort()) {
      const vals = this.valuesAt(e, a, asOf);
      if (!vals.length) continue;
      out[a] = this.many.has(a) ? vals.slice().sort((x, y) => (stableStringify(x) < stableStringify(y) ? -1 : 1)) : vals[vals.length - 1];
    }
    return out;
  }

  get(e: string, a: string, asOf: number = this.tx): Json | undefined {
    return this.entity(e, asOf)[a];
  }

  entities(asOf: number = this.tx): string[] {
    const ids = new Set<string>();
    for (const [e, , , tx] of this.rows) if (tx <= asOf) ids.add(e);
    return [...ids].sort();
  }

  /** Every assertion and retraction touching an entity (and optionally one attribute), oldest first. */
  history(e: string, a?: string): Datom[] {
    return this.rows.filter((r) => r[0] === e && (a === undefined || r[1] === a));
  }

  /** A copy of the log containing only what was true at `tx`. */
  asOf(tx: number): DatomLog {
    const copy = new DatomLog(this.many);
    copy.rows = this.rows.filter((r) => r[3] <= tx);
    for (const [t, n] of this.notes) if (t <= tx) copy.notes.set(t, n);
    copy.tx = Math.min(tx, this.tx);
    return copy;
  }

  note(tx: number): Json | undefined {
    return this.notes.get(tx);
  }

  toJSON(): DatomLogJson {
    const notes: { [tx: string]: Json } = {};
    for (const [t, n] of [...this.notes].sort((x, y) => x[0] - y[0])) notes[String(t)] = n;
    return { version: 1, many: [...this.many].sort(), tx: this.tx, datoms: this.rows.map((r) => [...r] as unknown as Datom), notes };
  }

  /** Stable text: the same log always serialises to the same bytes. */
  stableJSON(): string {
    return stableStringify(this.toJSON());
  }

  static fromJSON(json: DatomLogJson): DatomLog {
    const log = new DatomLog(json.many);
    log.rows = json.datoms.map((r) => [r[0], r[1], r[2], r[3], r[4]] as Datom);
    for (const [t, n] of Object.entries(json.notes)) log.notes.set(Number(t), n);
    log.tx = Math.max(json.tx, log.rows.reduce((m, r) => Math.max(m, r[3]), 0));
    return log;
  }
}

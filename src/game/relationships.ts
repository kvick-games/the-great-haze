// Relationships between party members: who likes whom, who is courting, who is
// married, who is cheating, and who knows. Deterministic under the run's seed.
//
// Affinity (-100..100) is the shared `GameState.bonds` score. This module adds
// what a pair *is* (stranger, friend, courting, lovers, spouses, estranged...),
// a hidden fidelity for every person, and secrets: an affair is a secret with a
// set of who-knows. Each tryst gives everyone else a chance to notice; a noticer
// then decides, by how they feel about the wronged partner and the cheater,
// whether to tell, keep quiet, gossip, tell the wagon-master or squeeze the
// cheater for silence. The player only learns what a member of the party learns
// and brings to them, or what they see with their own eyes.
//
// Nothing here imports the effect interpreter (effects.ts imports us), and it
// never imports story content.

import type { GameState, Member, NoticeRoll, QueueItem, RelKind, RelSceneItem, RelState, Relation, Secret, AffairOp, Trait } from "./types.ts";
import { COUPLE_KINDS } from "./rel-types.ts";
import type { Env } from "./effects.ts";
import type { Rng } from "./rng.ts";
import { hashSeed } from "./rng.ts";
import { addBond, able, avgNerve, bond, byId, changeNerve, clamp, firstName, hasTrait, living, pairKey, remember } from "./party.ts";
import { checkerFor, rollCheck } from "./checks.ts";
import { zoneOf } from "./tuning.ts";
import { sceneById } from "./content/scenes/index.ts";

// ---------------------------------------------------------------------------
// Tuning
// ---------------------------------------------------------------------------

export const REL = {
  /** Difficulty of noticing an affair. */
  noticeDc: 14,
  /** Chance per night that an affair's two people are together. */
  trystChance: 0.35,
  /** No affairs start before this day. */
  affairFirstDay: 6,
  /** Base chance per night that an attached person strays, before fidelity. */
  strayBase: 0.006,
  /** Extra chance per night at zero fidelity. */
  strayFaith: 0.02,
  /** Most relationship scenes queued in one night. */
  scenesPerNight: 2,
  /** Backlog of scenes waiting for a quiet night. */
  laterMax: 6,
};

/** Fidelity adjustments by trait. Higher = less likely to stray. */
const FAITH_TRAIT: Partial<Record<Trait, number>> = {
  pious: 18,
  kind: 8,
  stoic: 6,
  veteran: 2,
  charming: -12,
  greedy: -8,
  hothead: -8,
  haunted: -6,
  coward: -2,
};

export function emptyRel(): RelState {
  return { pairs: {}, faith: {}, secrets: [], nextSecret: 1, later: [] };
}

/** Repair a state from an older save, and hand back the relationship block. */
export function ensureRel(s: GameState): RelState {
  const r = (s.rel ??= emptyRel());
  r.pairs ??= {};
  r.faith ??= {};
  r.secrets ??= [];
  r.nextSecret ??= r.secrets.reduce((n, x) => Math.max(n, x.id + 1), 1);
  r.later ??= [];
  for (const m of s.party) m.history ??= [];
  return r;
}

// ---------------------------------------------------------------------------
// Reading relations
// ---------------------------------------------------------------------------

export function kindFromScore(score: number): RelKind {
  if (score >= 55) return "close-friend";
  if (score >= 22) return "friend";
  if (score <= -40) return "rival";
  return "stranger";
}

export function isCouple(kind: RelKind): boolean {
  return COUPLE_KINDS.includes(kind);
}

export function relOf(s: GameState, a: string, b: string): Relation | undefined {
  return s.rel?.pairs[pairKey(a, b)];
}

/** What two people are to each other (falls back to what their affinity suggests). */
export function kindOf(s: GameState, a: string, b: string): RelKind {
  return relOf(s, a, b)?.kind ?? kindFromScore(bond(s, a, b));
}

export function setKind(s: GameState, a: string, b: string, kind: RelKind): void {
  ensureRel(s).pairs[pairKey(a, b)] = { kind, since: s.day };
}

/** The living member `id` is coupled with, if any. */
export function partnerOf(s: GameState, id: string): Member | undefined {
  for (const m of living(s)) {
    if (m.id === id || m.isLeader) continue;
    if (isCouple(kindOf(s, id, m.id))) return m;
  }
  return undefined;
}

export function faithOf(s: GameState, id: string): number {
  const stored = s.rel?.faith[id];
  if (stored !== undefined) return stored;
  const m = byId(s, id);
  return faithBase(m, (hashSeed(`${s.seed}:${id}:faith`) >>> 0) / 4294967296);
}

function faithBase(m: Member | undefined, roll: number): number {
  let v = 40 + roll * 50;
  for (const t of m?.traits ?? []) v += FAITH_TRAIT[t] ?? 0;
  return Math.round(clamp(v, 4, 98));
}

const stoch = (rng: Rng, x: number): number => {
  const f = Math.floor(x);
  return f + (rng.chance(x - f) ? 1 : 0);
};

// ---------------------------------------------------------------------------
// Mustering
// ---------------------------------------------------------------------------

const MIN_SCORE: Partial<Record<RelKind, number>> = { spouses: 60, lovers: 46, courting: 28 };

/** Give a person their hidden disposition and default relations to everyone aboard. */
export function enterParty(s: GameState, rng: Rng, m: Member): void {
  const r = ensureRel(s);
  if (m.isLeader) return;
  r.faith[m.id] = faithBase(m, rng.next());
  for (const o of s.party) {
    if (o.id === m.id || o.isLeader) continue;
    const k = pairKey(m.id, o.id);
    if (!r.pairs[k]) r.pairs[k] = { kind: kindFromScore(bond(s, m.id, o.id)), since: s.day };
  }
}

/** Seed who is already something to whom when the party is mustered. */
export function seedRelations(s: GameState, rng: Rng): void {
  const r = ensureRel(s);
  const ms = s.party.filter((m) => !m.isLeader);
  for (const m of ms) enterParty(s, rng, m);
  const pairs: [Member, Member][] = [];
  for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) pairs.push([ms[i], ms[j]]);
  for (const [a, b] of rng.shuffle(pairs)) {
    if (partnerOf(s, a.id) || partnerOf(s, b.id)) continue;
    if (bond(s, a.id, b.id) <= -12) continue;
    if (!rng.chance(0.22)) continue;
    const kind: RelKind = rng.weighted<RelKind>(["spouses", "lovers", "courting"], (k) => (k === "lovers" ? 35 : k === "spouses" ? 30 : 35)) ?? "courting";
    const want = (MIN_SCORE[kind] ?? 30) + rng.int(0, 14);
    const cur = bond(s, a.id, b.id);
    if (cur < want) addBond(s, a.id, b.id, want - cur);
    r.pairs[pairKey(a.id, b.id)] = { kind, since: 0 };
    remember(s, a, kind === "spouses" ? `Set out already married to ${firstName(b)}.` : kind === "lovers" ? `Set out with ${firstName(b)}, who was already a lover.` : `Set out courting ${firstName(b)}.`);
    remember(s, b, kind === "spouses" ? `Set out already married to ${firstName(a)}.` : kind === "lovers" ? `Set out with ${firstName(a)}, who was already a lover.` : `Set out courting ${firstName(a)}.`);
  }
  for (const [a, b] of pairs) {
    const rel = r.pairs[pairKey(a.id, b.id)];
    if (rel && !isCouple(rel.kind)) rel.kind = kindFromScore(bond(s, a.id, b.id));
  }
}

// ---------------------------------------------------------------------------
// What the player is allowed to see
// ---------------------------------------------------------------------------

export interface RelationView {
  otherId: string;
  otherName: string;
  kind: string;
  score: number;
  label: string;
}

const ORDER: Record<RelKind, number> = { spouses: 0, lovers: 1, courting: 2, "close-friend": 3, friend: 4, rival: 5, estranged: 6, stranger: 7 };

export function relationLabel(kind: RelKind, score: number): string {
  switch (kind) {
    case "spouses":
      return score < 15 ? "married, strained" : "married";
    case "lovers":
      return score < 15 ? "lovers, strained" : "lovers";
    case "courting":
      return "courting";
    case "rival":
      return "rivals";
    case "estranged":
      return "estranged";
    case "close-friend":
      return "close friends";
    case "friend":
      return "friends";
    case "stranger":
      return score <= -15 ? "wary of each other" : score >= 10 ? "acquaintances" : "strangers";
  }
}

/** True if the wagon-master knows about a live affair between these two. */
function knownAffair(s: GameState, a: string, b: string): Secret | undefined {
  return s.rel?.secrets.find((x) => !x.ended && x.playerKnows && ((x.culprit === a && x.lover === b) || (x.culprit === b && x.lover === a)));
}

/**
 * How `memberId` stands with everyone else aboard, as the wagon-master knows it.
 * Affairs nobody has told the wagon-master about, and every hidden disposition,
 * are left out: those pairs show what they show in public.
 */
export function relationsOf(s: GameState, memberId: string): RelationView[] {
  const me = byId(s, memberId);
  if (!me || me.isLeader) return [];
  const out: (RelationView & { kindKey: RelKind })[] = [];
  for (const o of living(s)) {
    if (o.id === me.id || o.isLeader) continue;
    const score = Math.round(bond(s, me.id, o.id));
    let kind = kindOf(s, me.id, o.id);
    let label = relationLabel(kind, score);
    if (knownAffair(s, me.id, o.id)) {
      kind = "lovers";
      label = "secret lovers (an affair)";
    }
    out.push({ otherId: o.id, otherName: o.name, kind, score, label, kindKey: kind });
  }
  out.sort((x, y) => ORDER[x.kindKey] - ORDER[y.kindKey] || y.score - x.score);
  return out.map(({ kindKey: _k, ...v }) => v);
}

// ---------------------------------------------------------------------------
// Changing a relation (with the history the player is entitled to)
// ---------------------------------------------------------------------------

const KIND_NOTE: Record<RelKind, string> = {
  stranger: "let things cool with",
  friend: "made friends with",
  "close-friend": "became close friends with",
  rival: "fell out badly with",
  courting: "began courting",
  lovers: "became lovers with",
  spouses: "married",
  estranged: "parted from",
};

/** Change what a pair is, and record it where the player can see it. */
export function changeKind(s: GameState, a: Member, b: Member, kind: RelKind): void {
  if (a.isLeader || b.isLeader) return;
  if (kindOf(s, a.id, b.id) === kind) return;
  setKind(s, a.id, b.id, kind);
  remember(s, a, `${KIND_NOTE[kind]} ${firstName(b)}.`);
  remember(s, b, `${KIND_NOTE[kind]} ${firstName(a)}.`);
}

/** End a couple. Their affinity takes a knock and both are shaken. */
export function breakUp(s: GameState, a: Member, b: Member, hardness = 1): void {
  changeKind(s, a, b, "estranged");
  addBond(s, a.id, b.id, -Math.round(12 * hardness));
  changeNerve(a, -Math.round(5 * hardness));
  changeNerve(b, -Math.round(5 * hardness));
}

// ---------------------------------------------------------------------------
// Secrets
// ---------------------------------------------------------------------------

export function activeSecrets(s: GameState): Secret[] {
  return s.rel.secrets.filter((x) => !x.ended);
}

export function findSecret(s: GameState, a?: string, b?: string, other?: string): Secret | undefined {
  return activeSecrets(s).find((x) => (!b || x.culprit === b) && (!other || x.lover === other) && (!a || x.wronged.includes(a)));
}

function wrongedAlive(s: GameState, sec: Secret): Member[] {
  return sec.wronged.map((id) => byId(s, id)).filter((m): m is Member => !!m && m.alive);
}

/** Make the whole train, and the wagon-master, know. */
function makePublic(s: GameState, sec: Secret): void {
  sec.playerKnows = true;
  sec.publicDay ??= s.day;
  for (const m of living(s)) {
    if (m.isLeader || m.id === sec.culprit || m.id === sec.lover) continue;
    if (!sec.knows.includes(m.id)) sec.knows.push(m.id);
  }
  for (const w of sec.wronged) {
    if (!sec.wrongedKnows.includes(w)) sec.wrongedKnows.push(w);
    if (!sec.responded.includes(w)) sec.responded.push(w);
  }
}

function endSecret(sec: Secret, how: string): void {
  if (sec.ended) return;
  sec.ended = how;
  sec.blackmailer = undefined;
}

/** Called when a scene about an affair is built: playing it teaches the player. */
export function markSecretSeen(s: GameState, mode: "player" | "public", a?: string, b?: string, other?: string): void {
  const sec = findSecret(s, a, b, other);
  if (!sec) return;
  sec.playerKnows = true;
  sec.glimpsed = true;
  if (mode === "public") makePublic(s, sec);
}

/** Apply an `affair` effect from scene content. */
export function applyAffairOp(env: Env, op: AffairOp): void {
  const s = env.s;
  const sec = findSecret(s, env.bind.a, env.bind.b, env.bind.other) ?? findSecret(s, undefined, env.bind.b, env.bind.other);
  if (!sec) return;
  switch (op) {
    case "reveal":
      makePublic(s, sec);
      return;
    case "tell-wronged": {
      const w = env.bind.a && sec.wronged.includes(env.bind.a) ? env.bind.a : sec.wronged[0];
      if (!sec.wrongedKnows.includes(w)) sec.wrongedKnows.push(w);
      if (!sec.responded.includes(w)) sec.responded.push(w);
      if (!sec.knows.includes(w)) sec.knows.push(w);
      sec.playerKnows = true;
      return;
    }
    case "cover":
      sec.covered = true;
      sec.playerKnows = true;
      return;
    case "end":
      endSecret(sec, "ended");
      return;
    case "silence":
      sec.blackmailer = undefined;
      return;
    case "keep":
      sec.playerKnows = true;
      return;
  }
}

// ---------------------------------------------------------------------------
// Noticing
// ---------------------------------------------------------------------------

const CAREFUL: Trait[] = ["stoic", "paranoid", "veteran"];
const BOLD: Trait[] = ["hothead", "charming"];

/** How hard this affair is to see right now. */
export function noticeDc(s: GameState, sec: Secret): number {
  let dc = REL.noticeDc - Math.min(3, Math.floor(sec.trysts / 2));
  if (sec.covered) dc += 3;
  for (const id of [sec.culprit, sec.lover]) {
    const m = byId(s, id);
    if (!m) continue;
    if (m.traits.some((t) => CAREFUL.includes(t))) dc += 1;
    if (m.traits.some((t) => BOLD.includes(t))) dc -= 1;
  }
  return dc;
}

/** One member's chance to notice a tryst. Uses the same spot check as everything else. */
export function rollNotice(rng: Rng, s: GameState, sec: Secret, observer: Member): NoticeRoll {
  let dc = noticeDc(s, sec);
  const base = checkerFor(observer, "spot");
  const parts = base.parts.slice();
  let bonus = base.bonus;
  const add = (n: number, what: string) => {
    if (!n) return;
    bonus += n;
    parts.push(`${what} ${n > 0 ? "+" : "−"}${Math.abs(n)}`);
  };
  if (sec.wronged.includes(observer.id)) add(3, "suspicion");
  else if (sec.wronged.some((w) => bond(s, observer.id, w) >= 40)) add(1, "watches out for a friend");
  if (observer.role === "guard") add(1, "on watch");
  if (observer.isLeader) dc += 2;
  const check = rollCheck(rng, "spot", dc, "an affair", { ...base, bonus, parts });
  return { by: observer.id, byName: firstName(observer), roll: check.roll, bonus: check.bonus, dc, success: check.success, reason: check.reason };
}

export type NoticeAction = "tell" | "tell-leader" | "quiet" | "gossip" | "blackmail";

/** How a noticer weighs what to do, by how they feel about everyone involved. */
export function actionWeights(s: GameState, n: Member, sec: Secret): Record<NoticeAction, number> {
  const w = sec.wronged.filter((id) => !sec.wrongedKnows.includes(id) && id !== n.id);
  const cw = w.length ? Math.max(...w.map((id) => bond(s, n.id, id))) : -50;
  const cc = bond(s, n.id, sec.culprit);
  const cl = bond(s, n.id, sec.lover);
  const has = (t: Trait) => hasTrait(n, t);
  let tell = Math.max(0, cw - 8 + (has("kind") ? 6 : 0) + (has("pious") ? 8 : 0) + (has("hothead") ? 4 : 0) + Math.max(0, -cc) * 0.4 + Math.max(0, -cl) * 0.3);
  if (cw >= 55) tell += 25;
  if (!w.length) tell = 0;
  const quiet = 10 + Math.max(0, cc) * 0.8 + Math.max(0, cl) * 0.6 + (has("stoic") ? 14 : 0) + (has("coward") ? 10 : 0) + (cw < 0 ? 15 : 0);
  const blackmail = has("greedy") ? Math.max(0, 18 - cw * 0.25 + (cc < 0 ? 6 : 0)) : 0;
  const gossip = Math.max(0, 4 + (has("charming") ? 6 : 0) + (has("hothead") ? 5 : 0) + (has("paranoid") ? 2 : 0) + (cw < 20 && cc < 20 ? 8 : 0) - (has("stoic") ? 4 : 0));
  const tellLeader = sec.playerKnows ? 0 : 4 + n.trust / 12 + (has("kind") ? 3 : 0) + (has("veteran") ? 3 : 0) + (has("pious") ? 3 : 0);
  return { tell, "tell-leader": tellLeader, quiet, gossip, blackmail };
}

export function chooseAction(rng: Rng, s: GameState, n: Member, sec: Secret): NoticeAction {
  const weights = actionWeights(s, n, sec);
  const acts = Object.keys(weights) as NoticeAction[];
  return rng.weighted(acts, (a) => weights[a]) ?? "quiet";
}

// ---------------------------------------------------------------------------
// The engine's scene queue for relationships
// ---------------------------------------------------------------------------

interface Ctx {
  env: Env;
  now: RelSceneItem[];
  urgent: Set<RelSceneItem>;
  notes: string[];
}

function queueScene(c: Ctx, item: RelSceneItem, urgent = false): void {
  c.now.push(item);
  if (urgent) c.urgent.add(item);
}

const cooled = (s: GameState, name: string, days: number): boolean => s.day - (s.flags[`relCool:${name}`] ?? -99) >= days;
const cool = (s: GameState, name: string): void => {
  s.flags[`relCool:${name}`] = s.day;
};

function sceneFor(s: GameState, i: RelSceneItem): boolean {
  return !!sceneById(i.id) && [i.actor, i.a, i.b, i.other].every((id) => !id || byId(s, id)?.alive);
}

// ---------------------------------------------------------------------------
// A wronged partner learns
// ---------------------------------------------------------------------------

type Learned = "told" | "caught";

function wrongedLearns(c: Ctx, sec: Secret, wid: string, source: Member | undefined, how: Learned): void {
  const { env } = c;
  const s = env.s;
  if (sec.wrongedKnows.includes(wid)) return;
  sec.wrongedKnows.push(wid);
  if (!sec.knows.includes(wid)) sec.knows.push(wid);
  if (source && how === "told") sec.teller = source.id;
  const w = byId(s, wid);
  if (!w || !w.alive) return;
  respond(c, sec, w, source, how);
}

function respond(c: Ctx, sec: Secret, w: Member, source: Member | undefined, how: Learned): void {
  const { env } = c;
  const s = env.s;
  const rng = env.rng;
  const x = byId(s, sec.culprit);
  const l = byId(s, sec.lover);
  if (!x || !l || !x.alive || !l.alive) return;
  const has = (t: Trait) => hasTrait(w, t);
  const wActor = source && source.id !== l.id && source.id !== w.id ? source.id : w.id === l.id ? x.id : w.id;
  const weights: Record<string, number> = {
    public: 5 + (has("hothead") ? 4 : 0) + (has("paranoid") ? 1 : 0) - (has("coward") ? 3 : 0) - (has("stoic") ? 2 : 0),
    private: 3 + (has("stoic") ? 3 : 0) + (has("kind") ? 2 : 0) + (has("coward") ? 3 : 0) + (has("pious") ? 2 : 0),
    brood: 2 + (has("stoic") ? 2 : 0) + (has("coward") ? 3 : 0) + (has("haunted") ? 2 : 0),
    brawl: has("hothead") ? 4 + (bond(s, w.id, l.id) < 0 ? 2 : 0) : 0,
  };
  if (how === "caught") weights.brood = 0;
  const pick = rng.weighted(Object.keys(weights), (k) => weights[k]) ?? "public";
  sec.responded.push(w.id);
  if (pick === "public") {
    queueScene(c, { id: how === "caught" ? "rel-caught-in-act" : "rel-confrontation", a: w.id, b: x.id, other: l.id, actor: wActor === l.id ? w.id : wActor }, true);
  } else if (pick === "brawl") {
    queueScene(c, { id: "rel-triangle-brawl", a: w.id, b: x.id, other: l.id, actor: w.id }, true);
  } else if (pick === "brood") {
    sec.brooding[w.id] = s.day;
    changeNerve(w, -4);
  } else {
    // A private word, off the wagon-master's stage: it ends, or it goes on with a grudge.
    changeNerve(w, -5);
    addBond(s, w.id, l.id, -12);
    addBond(s, w.id, x.id, -10);
    if (rng.chance(0.4 + faithOf(s, x.id) / 200)) {
      endSecret(sec, "confronted in private");
      addBond(s, x.id, l.id, -10);
      changeNerve(l, -4);
    } else {
      addBond(s, w.id, x.id, -8);
      sec.brooding[w.id] = s.day;
    }
  }
}

// ---------------------------------------------------------------------------
// A noticer decides
// ---------------------------------------------------------------------------

function act(c: Ctx, sec: Secret, n: Member, action: NoticeAction, depth: number): void {
  const { env } = c;
  const s = env.s;
  const rng = env.rng;
  switch (action) {
    case "quiet":
      return;
    case "tell": {
      const pending = sec.wronged.filter((id) => !sec.wrongedKnows.includes(id) && id !== n.id);
      if (!pending.length) return;
      const best = pending.reduce((p, q) => (bond(s, n.id, q) > bond(s, n.id, p) ? q : p));
      wrongedLearns(c, sec, best, n, "told");
      return;
    }
    case "tell-leader": {
      if (sec.playerKnows || !sceneWorthy(s, sec)) return;
      const w = sec.wronged.find((id) => !sec.wrongedKnows.includes(id)) ?? sec.wronged[0];
      queueScene(c, { id: "rel-confidant", a: w, b: sec.culprit, other: sec.lover, actor: n.id });
      return;
    }
    case "gossip": {
      const pool = living(s).filter((m) => !m.isLeader && m.id !== n.id && m.id !== sec.culprit && m.id !== sec.lover && !sec.knows.includes(m.id));
      if (!pool.length) return;
      const g = rng.pick(pool);
      sec.knows.push(g.id);
      if (sec.wronged.includes(g.id)) {
        wrongedLearns(c, sec, g.id, n, "told");
        return;
      }
      if (!sec.playerKnows && cooled(s, "whispers", 6) && rng.chance(0.45)) {
        cool(s, "whispers");
        queueScene(c, { id: "rel-whispers", a: sec.wronged[0], b: sec.culprit, other: sec.lover, actor: n.id });
      }
      if (depth < 2 && rng.chance(0.55)) act(c, sec, g, chooseAction(rng, s, g, sec), depth + 1);
      return;
    }
    case "blackmail":
      if (sec.blackmailer) return;
      sec.blackmailer = n.id;
      addBond(s, n.id, sec.culprit, -6);
      return;
  }
}

function sceneWorthy(s: GameState, sec: Secret): boolean {
  const w = sec.wronged.map((id) => byId(s, id));
  return w.every((m) => m?.alive) && !!byId(s, sec.culprit)?.alive && !!byId(s, sec.lover)?.alive;
}

/** The result of one night's tryst, for tests and for the log. */
export interface TrystReport {
  rolls: NoticeRoll[];
  noticed: string[];
}

/** An affair's two people meet. Everyone else gets a chance to notice, and the noticers decide. */
export function runTryst(env: Env, sec: Secret): TrystReport {
  return runTrystIn(env, sec, { env, now: [], urgent: new Set(), notes: [] });
}

function runTrystIn(env: Env, sec: Secret, c: Ctx): TrystReport {
  const s = env.s;
  sec.trysts++;
  sec.last = s.day;
  addBond(s, sec.culprit, sec.lover, 2);
  const report: TrystReport = { rolls: [], noticed: [] };
  const watchers = living(s).filter((m) => m.id !== sec.culprit && m.id !== sec.lover && !sec.knows.includes(m.id));
  // The wronged look first: if they see it themselves there is nothing left to be told.
  watchers.sort((a, b) => Number(sec.wronged.includes(b.id)) - Number(sec.wronged.includes(a.id)));
  for (const m of watchers) {
    if (m.dying) continue;
    if (m.isLeader) {
      if (sec.playerKnows || sec.glimpsed) continue;
      const roll = rollNotice(env.rng, s, sec, m);
      report.rolls.push(roll);
      if (roll.success && sceneWorthy(s, sec)) {
        sec.glimpsed = true;
        report.noticed.push(m.id);
        const w = sec.wronged.find((id) => !sec.wrongedKnows.includes(id)) ?? sec.wronged[0];
        queueScene(c, { id: env.rng.chance(0.4) ? "rel-affair-evidence" : "rel-affair-glimpse", a: w, b: sec.culprit, other: sec.lover, actor: w }, false);
      }
      continue;
    }
    if (sec.knows.includes(m.id)) continue;
    const roll = rollNotice(env.rng, s, sec, m);
    report.rolls.push(roll);
    if (!roll.success) continue;
    report.noticed.push(m.id);
    sec.knows.push(m.id);
    if (sec.wronged.includes(m.id)) {
      wrongedLearns(c, sec, m.id, undefined, "caught");
    } else {
      act(c, sec, m, chooseAction(env.rng, s, m, sec), 0);
    }
  }
  return report;
}

// ---------------------------------------------------------------------------
// The night
// ---------------------------------------------------------------------------

function nonLeaders(s: GameState): Member[] {
  return living(s).filter((m) => !m.isLeader);
}

/** All pairs of living non-leaders, each once. */
function pairsOf(s: GameState): [Member, Member][] {
  const ms = nonLeaders(s);
  const out: [Member, Member][] = [];
  for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) out.push([ms[i], ms[j]]);
  return out;
}

function temper(a: Member, b: Member): number {
  let x = 0;
  for (const m of [a, b]) {
    if (hasTrait(m, "kind")) x += 0.15;
    if (hasTrait(m, "charming")) x += 0.1;
    if (hasTrait(m, "hothead")) x -= 0.15;
    if (hasTrait(m, "paranoid")) x -= 0.1;
  }
  if (hasTrait(a, "greedy") && hasTrait(b, "greedy")) x -= 0.3;
  if (hasTrait(a, "pious") && hasTrait(b, "pious")) x += 0.25;
  if (hasTrait(a, "haunted") && hasTrait(b, "haunted")) x += 0.3;
  if (hasTrait(a, "hothead") && hasTrait(b, "hothead")) x -= 0.3;
  if (hasTrait(a, "stoic") && hasTrait(b, "stoic")) x += 0.1;
  return x;
}

/** Days on the road pull people together or apart. */
function drift(env: Env, c: Ctx): void {
  const { s, rng } = env;
  const zone = zoneOf(s.gap);
  const hunger = s.res.rations === 0 ? -0.25 : s.rations === "bare" ? -0.15 : 0;
  const weary = avgNerve(s) < 30 ? -0.2 : 0;
  for (const [a, b] of pairsOf(s)) {
    const k = kindOf(s, a.id, b.id);
    const score = bond(s, a.id, b.id);
    let x = temper(a, b) + hunger + weary + (rng.next() - 0.5) * 0.7;
    // Shared danger draws steady people together and cracks the frayed.
    if (zone === "close" || zone === "upon") x += a.nerve >= 35 && b.nerve >= 35 ? 0.2 : -0.25;
    if (isCouple(k)) x += a.nerve < 25 || b.nerve < 25 ? -0.3 : 0.45;
    else {
      x -= score / 250;
      if (k === "rival") x -= 0.2;
      if (k === "estranged" && a.nerve > 45 && b.nerve > 45) x += 0.1;
      if (k === "friend" || k === "close-friend") x += 0.05;
    }
    const d = stoch(rng, x);
    if (d) addBond(s, a.id, b.id, d);
    // Friendship and enmity settle on their own.
    const rel = relOf(s, a.id, b.id);
    if (!isCouple(k)) {
      const after = bond(s, a.id, b.id);
      if (k === "estranged") {
        if (after >= 18) setKind(s, a.id, b.id, kindFromScore(after));
      } else {
        const next = kindFromScore(after);
        if (next !== k) {
          setKind(s, a.id, b.id, next);
          if (next === "close-friend" && !(s.flags[`cf:${pairKey(a.id, b.id)}`] ?? 0)) {
            s.flags[`cf:${pairKey(a.id, b.id)}`] = 1;
            remember(s, a, `Grew close to ${firstName(b)}.`);
            remember(s, b, `Grew close to ${firstName(a)}.`);
            if (cooled(s, "friends", 4) && rng.chance(0.5)) {
              cool(s, "friends");
              queueScene(c, { id: "rel-friends-bond", a: a.id, b: b.id, actor: a.id });
            }
          } else if (next === "rival" && !(s.flags[`rv:${pairKey(a.id, b.id)}`] ?? 0)) {
            s.flags[`rv:${pairKey(a.id, b.id)}`] = 1;
            remember(s, a, `Fell out with ${firstName(b)}.`);
            remember(s, b, `Fell out with ${firstName(a)}.`);
          }
        }
      }
    } else if (rel) {
      // keep the record fresh for couples
      rel.since = rel.since;
    }
  }
}

/** Sparks, courtships, proposals, break-ups, jealousy and rival suitors. */
function romance(env: Env, c: Ctx): void {
  const { s, rng } = env;
  const pairs = pairsOf(s);
  const days = (a: Member, b: Member): number => s.day - (relOf(s, a.id, b.id)?.since ?? 0);

  // Break-ups first: a couple whose affection has died.
  for (const [a, b] of pairs) {
    const k = kindOf(s, a.id, b.id);
    if (!isCouple(k)) continue;
    const score = bond(s, a.id, b.id);
    const limit = k === "courting" ? 8 : k === "lovers" ? 0 : -15;
    if (score < limit && days(a, b) >= 2 && rng.chance(0.5)) {
      breakUp(s, a, b, k === "spouses" ? 1.5 : 1);
      if (rng.chance(0.7)) queueScene(c, { id: "rel-breakup", a: a.id, b: b.id, actor: rng.chance(0.5) ? a.id : b.id }, true);
    }
  }

  // Sparks between the unattached.
  if (cooled(s, "court", 3)) {
    const cands = pairs.filter(([a, b]) => !partnerOf(s, a.id) && !partnerOf(s, b.id) && bond(s, a.id, b.id) >= 30 && !["rival", "estranged"].includes(kindOf(s, a.id, b.id)));
    for (const [a, b] of rng.shuffle(cands)) {
      const p = 0.05 + (bond(s, a.id, b.id) - 30) / 500 + (hasTrait(a, "charming") || hasTrait(b, "charming") ? 0.02 : 0);
      if (!rng.chance(p)) continue;
      cool(s, "court");
      const [x, y] = rng.chance(0.5) ? [a, b] : [b, a];
      changeKind(s, x, y, "courting");
      addBond(s, x.id, y.id, 4);
      queueScene(c, { id: "rel-courtship-spark", a: x.id, b: y.id, actor: x.id });
      break;
    }
  }

  // Courtships deepen; lovers may marry.
  for (const [a, b] of pairs) {
    const k = kindOf(s, a.id, b.id);
    const score = bond(s, a.id, b.id);
    const [x, y] = rng.chance(0.5) ? [a, b] : [b, a];
    if (k === "courting") {
      if (days(a, b) >= 3 && score >= 52 && rng.chance(0.1)) {
        changeKind(s, a, b, "lovers");
        if (rng.chance(0.6)) queueScene(c, { id: "rel-lovers-moment", a: x.id, b: y.id, actor: x.id });
      } else if (days(a, b) >= 12 && score < 45 && rng.chance(0.03)) {
        setKind(s, a.id, b.id, kindFromScore(score));
        remember(s, a, `Let the courtship with ${firstName(b)} fade.`);
        remember(s, b, `Let the courtship with ${firstName(a)} fade.`);
      }
    } else if (k === "lovers" && days(a, b) >= 5 && score >= 66 && cooled(s, "proposal", 6) && rng.chance(0.06)) {
      cool(s, "proposal");
      queueScene(c, { id: "rel-proposal", a: x.id, b: y.id, actor: x.id });
    }
  }

  // Jealousy: a coupled person sees their partner drawn to someone else.
  if (cooled(s, "jealous", 4)) {
    for (const a of nonLeaders(s)) {
      const p = partnerOf(s, a.id);
      if (!p) continue;
      const rival = nonLeaders(s).find((m) => m.id !== a.id && m.id !== p.id && bond(s, p.id, m.id) >= 40 && !isCouple(kindOf(s, p.id, m.id)));
      if (!rival) continue;
      const chance = 0.03 + (hasTrait(a, "paranoid") ? 0.04 : 0) + (hasTrait(a, "hothead") ? 0.03 : 0) - (hasTrait(a, "stoic") ? 0.02 : 0);
      if (rng.chance(chance)) {
        cool(s, "jealous");
        queueScene(c, { id: "rel-jealous-spat", a: a.id, b: p.id, other: rival.id, actor: a.id });
        break;
      }
    }
  }

  // Rival suitors.
  if (cooled(s, "triangle", 8)) {
    for (const a of nonLeaders(s)) {
      const t = partnerOf(s, a.id);
      if (!t) continue;
      const suitor = nonLeaders(s).find((m) => m.id !== a.id && m.id !== t.id && !partnerOf(s, m.id) && bond(s, m.id, t.id) >= 38);
      if (suitor && rng.chance(0.06)) {
        cool(s, "triangle");
        queueScene(c, { id: "rel-triangle-standoff", a: a.id, b: suitor.id, other: t.id, actor: a.id });
        break;
      }
    }
  }

  // Couples under strain quarrel in front of everyone.
  if (cooled(s, "lquarrel", 5)) {
    for (const [a, b] of rng.shuffle(pairs)) {
      if (!isCouple(kindOf(s, a.id, b.id))) continue;
      if (bond(s, a.id, b.id) >= 35 && a.nerve >= 35 && b.nerve >= 35) continue;
      if (rng.chance(0.06)) {
        cool(s, "lquarrel");
        queueScene(c, { id: "rel-lovers-quarrel", a: a.id, b: b.id, actor: a.id });
        break;
      }
    }
  }

  // Old wounds heal.
  if (cooled(s, "reconcile", 5)) {
    for (const [a, b] of rng.shuffle(pairs)) {
      if (kindOf(s, a.id, b.id) !== "estranged" || bond(s, a.id, b.id) < 8 || days(a, b) < 3) continue;
      if (rng.chance(0.1)) {
        cool(s, "reconcile");
        queueScene(c, { id: "rel-reconcile", a: a.id, b: b.id, actor: a.id });
        break;
      }
    }
  }
}

function newAffair(c: Ctx): void {
  const { s, rng } = c.env;
  if (s.day < REL.affairFirstDay || activeSecrets(s).length > 0 || nonLeaders(s).length < 3) return;
  for (const x of rng.shuffle(nonLeaders(s))) {
    const p = partnerOf(s, x.id);
    if (!p || x.dying || !x.alive) continue;
    const faith = faithOf(s, x.id);
    const toward = bond(s, x.id, p.id);
    let chance = REL.strayBase + ((100 - faith) / 100) * REL.strayFaith;
    if (toward < 10) chance *= 2;
    else if (toward >= 70) chance *= 0.5;
    if (!rng.chance(chance)) continue;
    const cands = nonLeaders(s).filter((m) => m.id !== x.id && m.id !== p.id && !m.dying && bond(s, x.id, m.id) >= 15);
    const lover = rng.weighted(cands, (m) => bond(s, x.id, m.id) + 15 + (hasTrait(m, "charming") ? 8 : 0));
    if (!lover) continue;
    const wronged = [p.id];
    const q = partnerOf(s, lover.id);
    if (q && q.id !== x.id && !wronged.includes(q.id)) wronged.push(q.id);
    const sec: Secret = {
      id: s.rel.nextSecret++,
      kind: "affair",
      culprit: x.id,
      lover: lover.id,
      wronged,
      started: s.day,
      last: s.day,
      trysts: 0,
      knows: [],
      wrongedKnows: [],
      responded: [],
      brooding: {},
      playerKnows: false,
      glimpsed: false,
    };
    s.rel.secrets.push(sec);
    addBond(s, x.id, lover.id, 6);
    runTrystIn(c.env, sec, c);
    return;
  }
}

/** Affairs: they begin, they go on, they are noticed, told, confronted and end. */
function affairs(env: Env, c: Ctx): void {
  const { s, rng } = env;
  // Anyone gone ends it for good.
  for (const sec of activeSecrets(s)) {
    const x = byId(s, sec.culprit);
    const l = byId(s, sec.lover);
    if (!x?.alive || !l?.alive) endSecret(sec, "one of them is gone");
    else if (!wrongedAlive(s, sec).length) endSecret(sec, "nobody left to wrong");
    else if (!sec.wronged.every((w) => isCouple(kindOf(s, w, sec.wronged[0] === w ? sec.culprit : sec.lover)) || !byId(s, w)?.alive)) {
      // Their partner left them, or they left: the secret has no one left to hide from.
      if (sec.wronged.every((w) => !isCouple(kindOf(s, w, sec.culprit)) && !isCouple(kindOf(s, w, sec.lover)))) endSecret(sec, "the couple parted");
    }
  }
  newAffair(c);
  for (const sec of activeSecrets(s)) {
    const x = byId(s, sec.culprit) as Member;
    const l = byId(s, sec.lover) as Member;
    const faith = faithOf(s, x.id);
    const fresh = sec.last === s.day && sec.trysts === 1;
    // Trysts.
    if (!fresh && able(s).includes(x) && able(s).includes(l) && rng.chance(REL.trystChance)) runTrystIn(env, sec, c);

    // Brooding partners: it festers, then comes out.
    for (const wid of Object.keys(sec.brooding)) {
      const w = byId(s, wid);
      if (!w?.alive) {
        delete sec.brooding[wid];
        continue;
      }
      changeNerve(w, -1);
      if (s.day - sec.brooding[wid] >= 2 && rng.chance(0.18) && sceneWorthy(s, sec)) {
        delete sec.brooding[wid];
        const brawl = hasTrait(w, "hothead") && rng.chance(0.4);
        queueScene(c, { id: brawl ? "rel-triangle-brawl" : "rel-confrontation", a: w.id, b: x.id, other: l.id, actor: w.id }, true);
      }
    }

    // Blackmail comes to a head.
    if (sec.blackmailer && byId(s, sec.blackmailer)?.alive && cooled(s, "blackmail", 5) && rng.chance(0.2) && sceneWorthy(s, sec)) {
      cool(s, "blackmail");
      queueScene(c, { id: "rel-blackmail", a: sec.wronged[0], b: x.id, other: l.id, actor: sec.blackmailer });
    }

    // A guilty conscience.
    const allWrongedKnow = sec.wronged.every((w) => sec.wrongedKnows.includes(w));
    if (!allWrongedKnow && sec.trysts >= 2 && faith >= 45 && rng.chance(0.03 * (faith / 50)) && sceneWorthy(s, sec)) {
      queueScene(c, { id: "rel-confession", a: sec.wronged.find((w) => !sec.wrongedKnows.includes(w)) ?? sec.wronged[0], b: x.id, other: l.id, actor: x.id });
    } else if (!allWrongedKnow && sec.trysts >= 3 && rng.chance(0.02 + (faith / 100) * 0.03)) {
      // They end it quietly on their own.
      if (sec.playerKnows && sceneWorthy(s, sec)) queueScene(c, { id: "rel-affair-ends", a: sec.wronged[0], b: x.id, other: l.id, actor: x.id });
      else {
        endSecret(sec, "broken off");
        addBond(s, x.id, l.id, -12);
        changeNerve(l, -6);
      }
    }
    if (sec.ended) continue;

    // Friends who kept quiet may find they cannot.
    if (!allWrongedKnow && sec.knows.length && rng.chance(0.08)) {
      const keeper = byId(s, rng.pick(sec.knows));
      if (keeper?.alive && !keeper.isLeader && !sec.wronged.includes(keeper.id)) {
        const w = actionWeights(s, keeper, sec);
        if (rng.chance(w.tell / Math.max(1, w.tell + w.quiet))) act(c, sec, keeper, "tell", 0);
      }
    }

    // Everyone knows and nothing changes: it burns out.
    const knownFor = sec.publicDay !== undefined ? s.day - sec.publicDay : allWrongedKnow ? 6 : 0;
    if (allWrongedKnow && knownFor >= 6 && rng.chance(0.25)) {
      endSecret(sec, "burned out");
      addBond(s, x.id, l.id, -8);
    }
  }
}

/** A dying friend or lover draws someone to their side. */
function loyalty(env: Env, c: Ctx): void {
  const { s, rng } = env;
  for (const d of nonLeaders(s)) {
    if (!d.dying || d.dyingSince !== s.day) continue;
    const carers = able(s).filter((m) => !m.isLeader && m.id !== d.id && (isCouple(kindOf(s, m.id, d.id)) || bond(s, m.id, d.id) >= 45));
    if (!carers.length) continue;
    const carer = carers.reduce((p, q) => (bond(s, q.id, d.id) > bond(s, p.id, d.id) ? q : p));
    if (rng.chance(0.65)) queueScene(c, { id: "rel-vigil", a: carer.id, b: d.id, actor: carer.id, other: d.id }, true);
  }
  // A hurt friend may draw someone into a risk on their behalf.
  if (cooled(s, "rescue", 10)) {
    for (const d of nonLeaders(s)) {
      if (d.dying || !d.wounded || d.health >= d.maxHealth * 0.5) continue;
      const carers = able(s).filter((m) => !m.isLeader && m.id !== d.id && (isCouple(kindOf(s, m.id, d.id)) || bond(s, m.id, d.id) >= 45));
      if (!carers.length) continue;
      if (rng.chance(0.06)) {
        cool(s, "rescue");
        const carer = rng.pick(carers);
        queueScene(c, { id: "rel-loyalty-rescue", a: carer.id, b: d.id, actor: carer.id, other: d.id });
        break;
      }
    }
  }
}

/** The relationships' share of a night. Returns scenes to queue and public notes. */
export function relationsNight(env: Env): { items: QueueItem[]; notes: string[] } {
  const s = env.s;
  ensureRel(s);
  const c: Ctx = { env, now: [], urgent: new Set(), notes: [] };
  drift(env, c);
  romance(env, c);
  affairs(env, c);
  loyalty(env, c);
  // Older scenes first, then the urgent, then the rest.
  const pending = [...s.rel.later, ...c.now.filter((i) => c.urgent.has(i)), ...c.now.filter((i) => !c.urgent.has(i))].filter((i) => sceneFor(s, i));
  const take = pending.slice(0, REL.scenesPerNight);
  s.rel.later = pending.slice(REL.scenesPerNight, REL.scenesPerNight + REL.laterMax);
  const items: QueueItem[] = take.map((i) => ({ t: "scene", ...i }));
  return { items, notes: c.notes };
}

// ---------------------------------------------------------------------------
// Death and departure
// ---------------------------------------------------------------------------

/** Someone has died. The ones who loved them take it hard. */
export function onDeath(env: Env, dead: Member): void {
  const s = env.s;
  ensureRel(s);
  for (const sec of activeSecrets(s)) if (sec.culprit === dead.id || sec.lover === dead.id) endSecret(sec, "one of them died");
  if (dead.isLeader) return;
  let best: { m: Member; grief: number; scene: string } | undefined;
  for (const m of living(s)) {
    if (m.isLeader || m.id === dead.id) continue;
    const k = kindOf(s, m.id, dead.id);
    const secretLover = s.rel.secrets.some((x) => (x.culprit === m.id && x.lover === dead.id) || (x.culprit === dead.id && x.lover === m.id));
    let grief = 0;
    let scene = "";
    if (k === "spouses") (grief = 24), (scene = "rel-grief-lover");
    else if (k === "lovers") (grief = 18), (scene = "rel-grief-lover");
    else if (k === "courting") (grief = 10), (scene = "rel-grief-lover");
    else if (secretLover) (grief = 16), (scene = "rel-grief-friend");
    else if (k === "close-friend") (grief = 8), (scene = "rel-grief-friend");
    else if (k === "friend") grief = 3;
    if (!grief) continue;
    changeNerve(m, -grief);
    if (isCouple(k)) remember(s, m, `Lost ${firstName(dead)}, the one they loved.`);
    if (scene && (!best || grief > best.grief)) best = { m, grief, scene };
  }
  if (best && sceneById(best.scene)) env.s.queue.push({ t: "scene", id: best.scene, actor: best.m.id, lost: dead.id });
}

/** Someone has left the train. A lover may follow. */
export function onDeparture(env: Env, gone: Member): void {
  const s = env.s;
  ensureRel(s);
  for (const sec of activeSecrets(s)) if (sec.culprit === gone.id || sec.lover === gone.id) endSecret(sec, "one of them left");
  if (gone.isLeader) return;
  const lover = living(s).find((m) => !m.isLeader && m.id !== gone.id && isCouple(kindOf(s, m.id, gone.id)));
  if (lover && sceneById("rel-lover-follows")) env.s.queue.push({ t: "scene", id: "rel-lover-follows", actor: lover.id, lost: gone.id });
}

// Chronicle: compare the game before and after one choice and say what happened to
// the people in it. The result is a story beat (what a video would show) plus a list
// of datom mutations (what permanently changed: a wound, a lost hand, a death, a
// bloodied coat, a rifle that ran dry). Life-altering and costume or equipment
// changes bump the character's visual version, which is what makes a video
// generator draw them differently from then on.
//
// Pure and deterministic: the same two snapshots always give the same answer.

import { sceneById } from "../game/content/scenes/index.ts";
import type { CheckResult, GameState, Hud, Pending, ResourceId, Role, Screen, SpokenLine, Trait } from "../game/types.ts";
import { regionAt } from "../game/world.ts";
import { matchOutcome, truthGroup } from "./catalog.ts";
import { baseLook, characterSpecs, lookLabel, lookSignature, slotKeyFor, strangerKey } from "./characters.ts";
import type { CharacterSpec, Costume, Look } from "./characters.ts";
import { DatomLog } from "./datoms.ts";
import type { Json, TxOp } from "./datoms.ts";

// ---------------------------------------------------------------------------
// The datom vocabulary
// ---------------------------------------------------------------------------

export const ATTR = {
  status: "char/status",
  fate: "char/fate",
  wounded: "body/wounded",
  sick: "body/sick",
  dying: "body/dying",
  maimed: "body/maimed",
  gaunt: "body/gaunt",
  fog: "body/fog",
  costume: "look/costume",
  costumeDay: "look/costume_day",
  kit: "look/kit",
  region: "place/region",
  sigs: "visual/sigs",
  version: "visual/version",
  slot: "visual/slot",
  label: "visual/label",
} as const;

/** Attributes that hold sets rather than single values. */
export const MANY_ATTRS = [ATTR.kit];

export const charEntity = (key: string): string => `char:${key}`;
export const keyOfEntity = (e: string): string => e.replace(/^char:/, "");

export function newLog(): DatomLog {
  return new DatomLog(MANY_ATTRS);
}

// ---------------------------------------------------------------------------
// Snapshots
// ---------------------------------------------------------------------------

export interface StoryMember {
  id: string;
  name: string;
  role: Role;
  traits: Trait[];
  health: number;
  maxHealth: number;
  nerve: number;
  wounded: boolean;
  sick: boolean;
  dying: boolean;
  fog: number;
  alive: boolean;
  fate?: string;
  isLeader: boolean;
  recruited: boolean;
}

export interface SceneRef {
  id: string;
  truth: string;
  actor?: string;
  other?: string;
  a?: string;
  b?: string;
}

export interface StorySnapshot {
  marker: "story-snapshot";
  day: number;
  miles: number;
  gap: number;
  region: string;
  res: Record<ResourceId, number>;
  wagons: number;
  starvedDays: number;
  party: StoryMember[];
  pending: Pending["kind"] | "unknown";
  scene: SceneRef | null;
  /** Enemy id when a fight is on screen or next in the queue. */
  combat: string | null;
  result: string[];
  ending: string | null;
}

export type SnapshotInput = GameState | Hud | StorySnapshot | string;

const EMPTY_RES: Record<ResourceId, number> = { rations: 0, torches: 0, ammo: 0, medicine: 0, spares: 0, veils: 0, rockets: 0 };

function isState(x: unknown): x is GameState {
  return typeof x === "object" && x !== null && "queue" in x && "pending" in x && "party" in x;
}

function isHud(x: unknown): x is Hud {
  return typeof x === "object" && x !== null && "zone" in x && "party" in x && "cargoCap" in x;
}

/** Accepts serialize() output (text or parsed) or a hud(). A hud is thinner: it has no cause of death and only living members. */
export function toSnapshot(input: SnapshotInput): StorySnapshot {
  const x = typeof input === "string" ? (JSON.parse(input) as GameState) : input;
  if (isState(x)) {
    const p = x.pending;
    const q = x.queue.find((i) => i.t === "combat");
    return {
      marker: "story-snapshot",
      day: x.day,
      miles: x.miles,
      gap: x.gap,
      region: regionAt(x.miles).id,
      res: { ...x.res },
      wagons: x.train.wagons,
      starvedDays: x.stats.starvedDays,
      party: x.party.map((m) => ({
        id: m.id,
        name: m.name,
        role: m.role,
        traits: m.traits.slice(),
        health: m.health,
        maxHealth: m.maxHealth,
        nerve: m.nerve,
        wounded: m.wounded,
        sick: m.sick,
        dying: m.dying,
        fog: m.fog,
        alive: m.alive,
        fate: m.fate,
        isLeader: m.isLeader,
        recruited: !!m.recruited,
      })),
      pending: p.kind,
      scene: p.kind === "scene" ? { id: p.scene.id, truth: p.scene.truth, actor: p.scene.actor, other: p.scene.other, a: p.scene.a, b: p.scene.b } : null,
      combat: p.kind === "combat" ? p.combat.enemy : q && q.t === "combat" ? q.enemy : null,
      result: p.kind === "result" ? p.lines.slice() : [],
      ending: x.ending ? x.ending.kind : null,
    };
  }
  if (isHud(x)) {
    return {
      marker: "story-snapshot",
      day: x.day,
      miles: x.miles,
      gap: x.gap,
      region: regionAt(x.miles).id,
      res: { ...x.res },
      wagons: x.wagons,
      starvedDays: 0,
      party: x.party.map((m) => ({
        id: m.id,
        name: m.name,
        role: m.role,
        traits: m.traits.slice(),
        health: m.health,
        maxHealth: 90,
        nerve: m.nerve,
        wounded: m.conditions.includes("wounded"),
        sick: m.conditions.includes("sick"),
        dying: m.conditions.includes("dying"),
        fog: m.conditions.includes("turning") ? 3 : m.conditions.includes("fogsick II") ? 2 : m.conditions.includes("fogsick I") ? 1 : 0,
        alive: true,
        isLeader: m.isLeader,
        recruited: false,
      })),
      pending: "unknown",
      scene: null,
      combat: null,
      result: [],
      ending: null,
    };
  }
  return { ...(x as StorySnapshot), res: { ...EMPTY_RES, ...(x as StorySnapshot).res } };
}

// ---------------------------------------------------------------------------
// Mutations and beats
// ---------------------------------------------------------------------------

export type MutationKind =
  | "join"
  | "death"
  | "departure"
  | "turning"
  | "wound"
  | "heal"
  | "maim"
  | "dying"
  | "stabilize"
  | "fog"
  | "fog-ease"
  | "sick"
  | "recover"
  | "starving"
  | "costume"
  | "prop-gained"
  | "prop-lost"
  | "look"
  | "region"
  | "wagons";

export interface Mutation {
  kind: MutationKind;
  /** A character key, or "party" / "train". */
  subject: string;
  summary: string;
  lifeAltering: boolean;
  /** Changes how the subject must be drawn. */
  visual: boolean;
  /** The datom operations this mutation is. */
  ops: TxOp[];
  from?: Json;
  to?: Json;
  /** Prop key for prop-gained / prop-lost. */
  prop?: string;
}

export type Stakes = "quiet" | "minor" | "notable" | "life-altering";
export type BeatKind = "death" | "turning" | "departure" | "join" | "injury" | "haze" | "combat" | "encounter" | "hardship" | "camp" | "road" | "trade" | "muster" | "ending" | "quiet";

/** A spoken line resolved against the story: who (a character key), the words, and how they are said. */
export interface BeatLine {
  /** Character key: "leader", a member or NPC id, or a stranger key. */
  key: string;
  name: string;
  kind: SpokenLine["kind"];
  text: string;
  mood: SpokenLine["mood"];
  gesture: SpokenLine["gesture"];
  /** "setup": said as the scene opened. "outcome": said as the choice played out. */
  phase: "setup" | "outcome";
}

/** Where the train was, from the route map the player was looking at. */
export interface BeatPlace {
  regionId: string;
  node: string;
  nodeName: string;
  nodeKind: string;
  /** Road being travelled, when between nodes. */
  edge: string | null;
  edgeName: string | null;
  terrain: string | null;
}

export interface Beat {
  id: string;
  index: number;
  /** Tx of this beat in the datom log; set when recorded. */
  tx: number;
  day: number;
  miles: number;
  region: string;
  choiceId: string;
  pending: string;
  sceneId: string | null;
  sceneTitle: string | null;
  truth: string | null;
  kind: BeatKind;
  stakes: Stakes;
  title: string;
  /** What happened, in the game's words. */
  text: string[];
  /** Character keys in order of importance. Archetype keys start with "archetype." */
  participants: string[];
  /** Stable key shared with the pre-baked twin of this beat. */
  templateKey: string;
  mutations: Mutation[];
  /** Spoken lines for this beat, when the screens were supplied to the recorder. */
  talk?: BeatLine[];
  /** The dialogue or perception check this choice made, if any. */
  check?: CheckResult;
  /** Region and route context from the hud. */
  place?: BeatPlace;
}

/** The screens either side of one choice. They carry what the snapshots cannot: speech, checks and the route. */
export interface BeatScreens {
  before?: Screen;
  after?: Screen;
}

export interface ChronicleContext {
  /** The screens before and after the choice: spoken lines, the check and the route context. */
  screens?: BeatScreens;
  index?: number;
  /** The story log, for the looks and visual versions each character had before this beat. */
  log?: DatomLog;
  specs?: CharacterSpec[];
  /** Overrides the outcome text taken from the after-state. */
  text?: string[];
}

export interface ChronicleResult {
  beat: Beat;
  mutations: Mutation[];
}

// ---------------------------------------------------------------------------
// Looks in the log
// ---------------------------------------------------------------------------

/** Read a character's look from the log as of a tx. Null if the log has never seen them. */
export function lookFromLog(log: DatomLog, key: string, asOf?: number): Look | null {
  const e = log.entity(charEntity(key), asOf);
  if (e[ATTR.status] === undefined) return null;
  return {
    status: e[ATTR.status] as Look["status"],
    wounded: e[ATTR.wounded] === true,
    sick: e[ATTR.sick] === true,
    dying: e[ATTR.dying] === true,
    maimed: e[ATTR.maimed] === true,
    gaunt: e[ATTR.gaunt] === true,
    fog: typeof e[ATTR.fog] === "number" ? (e[ATTR.fog] as number) : 0,
    costume: (e[ATTR.costume] as Costume | undefined) ?? "travel",
    kit: Array.isArray(e[ATTR.kit]) ? ((e[ATTR.kit] as Json[]).map(String) as string[]) : [],
  };
}

export interface VisualState {
  version: number;
  slot: string;
  label: string;
}

export function visualFromLog(log: DatomLog, key: string, asOf?: number): VisualState {
  const e = log.entity(charEntity(key), asOf);
  return {
    version: typeof e[ATTR.version] === "number" ? (e[ATTR.version] as number) : 1,
    slot: typeof e[ATTR.slot] === "string" ? (e[ATTR.slot] as string) : "hero",
    label: typeof e[ATTR.label] === "string" ? (e[ATTR.label] as string) : "base",
  };
}

/** The ops that write a whole look. Used for a character's first entry into the log. */
export function lookOps(key: string, look: Look): TxOp[] {
  const e = charEntity(key);
  const ops: TxOp[] = [
    { e, a: ATTR.status, v: look.status },
    { e, a: ATTR.wounded, v: look.wounded },
    { e, a: ATTR.sick, v: look.sick },
    { e, a: ATTR.dying, v: look.dying },
    { e, a: ATTR.maimed, v: look.maimed },
    { e, a: ATTR.gaunt, v: look.gaunt },
    { e, a: ATTR.fog, v: look.fog },
    { e, a: ATTR.costume, v: look.costume },
  ];
  for (const k of look.kit) ops.push({ e, a: ATTR.kit, v: k });
  return ops;
}

// ---------------------------------------------------------------------------
// Chronicle
// ---------------------------------------------------------------------------

let defaultSpecs: CharacterSpec[] | null = null;
function specsOf(ctx?: ChronicleContext): CharacterSpec[] {
  if (ctx?.specs) return ctx.specs;
  return (defaultSpecs ??= characterSpecs());
}

function baseKitOf(specs: CharacterSpec[], m: StoryMember): string[] {
  const s = specs.find((x) => x.key === (m.isLeader ? "leader" : m.id));
  if (s) return s.kit;
  return [];
}

/** The kit a living person can actually carry: no torch with no torches, no rifle with no shot. */
function kitWanted(base: string[], res: Record<ResourceId, number>, alive: boolean): string[] {
  if (!alive) return [];
  return base.filter((k) => !(k === "torch" && res.torches <= 0) && !(k === "rifle" && res.ammo <= 0));
}

function classifyLeaving(fate: string | undefined): "death" | "departure" | "turning" {
  const f = (fate ?? "").toLowerCase();
  if (/turned/.test(f)) return "turning";
  if (/walked into|left|took a share|gone|marked by|quarantine|sent|abandon|deserted|fled|ran/.test(f)) return "departure";
  return "death";
}

const name = (m: StoryMember): string => m.name;

function nowLook(m: StoryMember, before: StoryMember | undefined, prev: Look, after: StorySnapshot, beforeSnap: StorySnapshot, base: string[], kind: "death" | "departure" | "turning" | null, costumeDay: number): Look {
  const hpLoss = before ? before.health - m.health : 0;
  const status: Look["status"] = m.alive ? "active" : kind === "turning" ? "turned" : kind === "departure" ? "departed" : "dead";
  const dyingNow = m.alive && m.dying;
  const newlyWounded = m.alive && m.wounded && !(before?.wounded ?? false);
  const survivedNearDeath = !!before && before.dying && !m.dying && m.alive;
  const bigHit = !!before && m.alive && hpLoss >= 0.45 * m.maxHealth;
  const maimed = prev.maimed || survivedNearDeath || bigHit;
  let costume: Costume = prev.costume;
  if (!m.alive) costume = prev.costume;
  else if (hpLoss >= 10 || newlyWounded) costume = "bloodied";
  else if (prev.costume === "bloodied" && m.wounded && after.res.medicine < beforeSnap.res.medicine) costume = "bandaged";
  else if (prev.costume === "bandaged" && !m.wounded) costume = "travel";
  else if (prev.costume === "bloodied" && after.day >= costumeDay + 3 && !dyingNow) costume = "travel";
  return {
    status,
    wounded: m.alive && m.wounded,
    sick: m.alive && m.sick,
    dying: dyingNow,
    maimed,
    gaunt: prev.gaunt || after.starvedDays >= 3,
    fog: m.alive ? m.fog : prev.fog,
    costume,
    kit: kitWanted(base, after.res, m.alive).slice().sort(),
  };
}

const ROLE_IMPORTANCE: MutationKind[] = ["death", "turning", "departure", "maim", "dying", "join", "fog", "wound", "heal", "sick", "starving", "costume", "prop-lost", "prop-gained", "look", "region", "wagons", "fog-ease", "recover", "stabilize"];

function ordinal(k: MutationKind): number {
  return ROLE_IMPORTANCE.indexOf(k);
}

export function chronicle(beforeIn: SnapshotInput, afterIn: SnapshotInput, choiceId: string, ctx: ChronicleContext = {}): ChronicleResult {
  const before = toSnapshot(beforeIn);
  const after = toSnapshot(afterIn);
  const specs = specsOf(ctx);
  const log = ctx.log;
  const muts: Mutation[] = [];
  const push = (m: Mutation) => muts.push(m);

  const beforeBy = new Map(before.party.map((m) => [m.id, m]));
  const order = [...after.party.map((m) => m.id), ...before.party.filter((m) => !after.party.some((a) => a.id === m.id)).map((m) => m.id)];

  for (const id of order) {
    const b = beforeBy.get(id);
    const a = after.party.find((m) => m.id === id);
    const subject = (a ?? b)!;
    const key = subject.isLeader ? "leader" : subject.id;
    const e = charEntity(key);
    const base = baseKitOf(specs, subject);
    const logged = log ? lookFromLog(log, key) : null;
    const joined = !b && !!a;
    let prev: Look;
    if (joined) prev = baseLook([]);
    else prev = logged ?? { ...baseLook(kitWanted(base, before.res, b!.alive)), wounded: b!.wounded, sick: b!.sick, dying: b!.dying, fog: b!.fog, status: b!.alive ? "active" : "dead" };
    const now0 = a ?? (b as StoryMember);
    // A hud only lists the living: a member who vanished from it is treated as lost.
    const goneNow = !!b && (!a || !a.alive) && b.alive;
    const leaving = goneNow ? classifyLeaving(a?.fate) : null;
    const cur: StoryMember = goneNow ? { ...(a ?? b!), alive: false } : now0;
    const costumeDay = log ? (typeof log.get(e, ATTR.costumeDay) === "number" ? (log.get(e, ATTR.costumeDay) as number) : 0) : before.day;
    const next = nowLook(cur, b, prev, after, before, base, leaving, costumeDay);
    const who = name(cur);
    const pstart = muts.length;
    if (joined) {
      const muster = before.day === 0 && !a!.recruited;
      push({
        kind: "join",
        subject: key,
        summary: muster ? `${who} joins the train at Cinder Ford.` : `${who} joins the train.`,
        lifeAltering: !muster,
        visual: true,
        ops: lookOps(key, next).concat([{ e, a: ATTR.region, v: after.region }]),
        to: key,
      });
    } else if (leaving) {
      const fate = a?.fate ?? "lost";
      push({
        kind: leaving,
        subject: key,
        summary: leaving === "death" ? `${who} is dead: ${fate}.` : leaving === "turning" ? `${who} is turned by the Haze: ${fate}.` : `${who} is gone: ${fate}.`,
        lifeAltering: true,
        visual: true,
        ops: [
          { e, a: ATTR.status, v: next.status },
          { e, a: ATTR.fate, v: fate },
          { e, a: ATTR.dying, v: false },
          { e, a: ATTR.fog, v: next.fog },
          ...prev.kit.map((k) => ({ e, a: ATTR.kit, v: k, retract: true })),
        ],
        from: "active",
        to: next.status,
      });
      for (const k of prev.kit) {
        push({ kind: "prop-lost", subject: key, summary: `${who}'s ${k} is left behind.`, lifeAltering: false, visual: false, ops: [], prop: k, from: k });
      }
    } else if (b && a) {
      if (next.wounded && !prev.wounded) push({ kind: "wound", subject: key, summary: `${who} is wounded.`, lifeAltering: false, visual: true, ops: [{ e, a: ATTR.wounded, v: true }], from: false, to: true });
      if (!next.wounded && prev.wounded) push({ kind: "heal", subject: key, summary: `${who}'s wound closes.`, lifeAltering: false, visual: true, ops: [{ e, a: ATTR.wounded, v: false }], from: true, to: false });
      if (next.dying && !prev.dying) push({ kind: "dying", subject: key, summary: `${who} is dying.`, lifeAltering: true, visual: true, ops: [{ e, a: ATTR.dying, v: true }], from: false, to: true });
      if (!next.dying && prev.dying) push({ kind: "stabilize", subject: key, summary: `${who} is pulled back from the edge.`, lifeAltering: false, visual: true, ops: [{ e, a: ATTR.dying, v: false }], from: true, to: false });
      if (next.maimed && !prev.maimed) push({ kind: "maim", subject: key, summary: `${who} is left with a lasting injury.`, lifeAltering: true, visual: true, ops: [{ e, a: ATTR.maimed, v: true }], from: false, to: true });
      if (next.fog > prev.fog) push({ kind: "fog", subject: key, summary: `${who} sickens with the Haze (stage ${next.fog}).`, lifeAltering: next.fog >= 2, visual: true, ops: [{ e, a: ATTR.fog, v: next.fog }], from: prev.fog, to: next.fog });
      if (next.fog < prev.fog) push({ kind: "fog-ease", subject: key, summary: `The Haze loosens its mark on ${who} (stage ${next.fog}).`, lifeAltering: false, visual: true, ops: [{ e, a: ATTR.fog, v: next.fog }], from: prev.fog, to: next.fog });
      if (next.sick && !prev.sick) push({ kind: "sick", subject: key, summary: `${who} falls sick.`, lifeAltering: false, visual: true, ops: [{ e, a: ATTR.sick, v: true }], from: false, to: true });
      if (!next.sick && prev.sick) push({ kind: "recover", subject: key, summary: `${who} recovers.`, lifeAltering: false, visual: true, ops: [{ e, a: ATTR.sick, v: false }], from: true, to: false });
      if (next.gaunt && !prev.gaunt) push({ kind: "starving", subject: key, summary: `${who} is gaunt with hunger.`, lifeAltering: false, visual: true, ops: [{ e, a: ATTR.gaunt, v: true }], from: false, to: true });
      if (next.costume !== prev.costume) {
        push({
          kind: "costume",
          subject: key,
          summary: next.costume === "bloodied" ? `${who}'s clothes are stained with blood.` : next.costume === "bandaged" ? `${who} is bandaged.` : `${who} changes out of ${prev.costume} clothes.`,
          lifeAltering: false,
          visual: true,
          ops: [
            { e, a: ATTR.costume, v: next.costume },
            { e, a: ATTR.costumeDay, v: after.day },
          ],
          from: prev.costume,
          to: next.costume,
        });
      }
      for (const k of next.kit) {
        if (!prev.kit.includes(k)) push({ kind: "prop-gained", subject: key, summary: `${who} takes up the ${k}.`, lifeAltering: false, visual: true, ops: [{ e, a: ATTR.kit, v: k }], prop: k, to: k });
      }
      for (const k of prev.kit) {
        if (!next.kit.includes(k)) push({ kind: "prop-lost", subject: key, summary: `${who} no longer has the ${k}.`, lifeAltering: false, visual: true, ops: [{ e, a: ATTR.kit, v: k, retract: true }], prop: k, from: k });
      }
    }
    // A new look: register it, and bump the visual version if it has never been drawn.
    const prevSig = lookSignature(prev);
    const nextSig = lookSignature(next);
    const changedHere = muts.length > pstart;
    if (changedHere && (joined || prevSig !== nextSig)) {
      const knownSigs: string[] = log && Array.isArray(log.get(e, ATTR.sigs)) ? ((log.get(e, ATTR.sigs) as Json[]).map(String) as string[]) : joined ? [] : [prevSig];
      const sigs = knownSigs.slice();
      let at = sigs.indexOf(nextSig);
      if (at < 0) {
        sigs.push(nextSig);
        at = sigs.length - 1;
      }
      const version = at + 1;
      const prevVersion = log ? visualFromLog(log, key).version : Math.max(1, knownSigs.indexOf(prevSig) + 1);
      const label = lookLabel(next, base);
      const slot = slotKeyFor(label, version);
      if (joined || version !== prevVersion || !log) {
        push({
          kind: "look",
          subject: key,
          summary: `${who} now needs the ${slot} look (v${version}).`,
          lifeAltering: false,
          visual: true,
          ops: [
            { e, a: ATTR.sigs, v: sigs },
            { e, a: ATTR.version, v: version },
            { e, a: ATTR.slot, v: slot },
            { e, a: ATTR.label, v: label },
          ],
          from: prevVersion,
          to: version,
        });
      }
    }
  }

  if (after.region !== before.region) {
    push({ kind: "region", subject: "party", summary: `The train enters ${after.region}.`, lifeAltering: false, visual: false, ops: [{ e: "party", a: ATTR.region, v: after.region }], from: before.region, to: after.region });
  }
  if (after.wagons !== before.wagons) {
    const lost = after.wagons < before.wagons;
    push({ kind: "wagons", subject: "train", summary: lost ? `A wagon is lost (${after.wagons} left).` : `A wagon is gained (${after.wagons}).`, lifeAltering: false, visual: true, ops: [{ e: "train", a: "train/wagons", v: after.wagons }], from: before.wagons, to: after.wagons });
  }
  if (after.starvedDays > before.starvedDays) {
    push({ kind: "starving", subject: "party", summary: "The party goes hungry.", lifeAltering: false, visual: false, ops: [{ e: "party", a: "party/starved_days", v: after.starvedDays }] });
  }

  muts.sort((x, y) => ordinal(x.kind) - ordinal(y.kind) || (x.subject < y.subject ? -1 : x.subject > y.subject ? 1 : 0));

  const index = ctx.index ?? 0;
  const beat = buildBeat(before, after, choiceId, muts, index, ctx.text);
  if (ctx.screens) addScreenContext(beat, before, after, ctx.screens);
  return { beat, mutations: muts };
}

function placeOf(hud: Hud | undefined): BeatPlace | undefined {
  if (!hud) return undefined;
  const map = hud.map;
  const pos = map?.position;
  const node = map?.nodes.find((n) => n.id === pos?.node);
  const edge = pos?.edge ? map.edges.find((e) => e.id === pos.edge) : undefined;
  return { regionId: hud.regionId, node: pos?.node ?? "", nodeName: node?.name ?? "", nodeKind: node?.kind ?? "", edge: pos?.edge ?? null, edgeName: edge?.name ?? null, terrain: edge?.terrain ?? null };
}

/** Attach speech, the check and the route to a beat, and make every speaker a participant. */
function addScreenContext(beat: Beat, before: StorySnapshot, after: StorySnapshot, screens: BeatScreens): void {
  const scr = screens;
  const leaderId = (before.party.find((m) => m.isLeader) ?? after.party.find((m) => m.isLeader))?.id;
  const stranger = before.scene ? strangerKey(before.scene.id) : null;
  const keyOf = (l: SpokenLine): string => (l.kind === "stranger" ? (stranger ?? "archetype.stranger") : l.speaker === leaderId ? "leader" : l.speaker);
  const lines: BeatLine[] = [];
  const take = (list: SpokenLine[] | undefined, phase: BeatLine["phase"]) => {
    for (const l of list ?? []) lines.push({ key: keyOf(l), name: l.name, kind: l.kind, text: l.text, mood: l.mood, gesture: l.gesture, phase });
  };
  if (scr.before?.kind === "scene") take(scr.before.talk, "setup");
  if (scr.after?.kind === "result") take(scr.after.talk, "outcome");
  if (lines.length) beat.talk = lines;
  if (scr.after?.kind === "result" && scr.after.check) beat.check = scr.after.check;
  const place = placeOf(scr.after?.hud ?? scr.before?.hud);
  if (place) {
    beat.place = place;
    beat.region = place.regionId;
  }
  // The stranger keeps their own face (or their NPC datom) in place of the generic archetype.
  if (stranger) {
    const at = beat.participants.indexOf("archetype.stranger");
    if (at >= 0) beat.participants.splice(at, 1);
    if (!beat.participants.includes(stranger)) beat.participants.splice(at >= 0 ? at : beat.participants.length, 0, stranger);
  }
  // Whoever speaks is on screen.
  for (const l of lines) if (!beat.participants.includes(l.key)) beat.participants.push(l.key);
  if (beat.check) {
    const by = beat.check.by === leaderId ? "leader" : beat.check.by;
    if (!beat.participants.includes(by) && after.party.some((m) => m.id === beat.check!.by)) beat.participants.push(by);
  }
}

function fillTitle(t: string): string {
  return t.replace(/\{[a-z]+\}/g, "someone");
}

function buildBeat(before: StorySnapshot, after: StorySnapshot, choiceId: string, muts: Mutation[], index: number, textOverride: string[] | undefined): Beat {
  const has = (k: MutationKind) => muts.some((m) => m.kind === k);
  const scene = before.scene;
  const def = scene ? sceneById(scene.id) : undefined;
  const text = textOverride ?? (after.result.length ? after.result : []);
  const combatStart = !before.combat && !!after.combat;
  const enemy = after.combat ?? before.combat;
  const kind: BeatKind = has("death")
    ? "death"
    : has("turning")
      ? "turning"
      : has("departure")
        ? "departure"
        : has("join")
          ? before.day === 0 ? "muster" : "join"
          : has("maim") || has("dying") || has("wound")
            ? "injury"
            : has("fog")
              ? "haze"
              : before.pending === "combat" || combatStart
                ? "combat"
                : has("starving")
                  ? "hardship"
                  : after.ending
                    ? "ending"
                    : def
                      ? "encounter"
                      : before.pending === "plan"
                        ? choiceId === "go" ? "road" : "camp"
                        : before.pending === "store" ? "trade" : muts.length ? "hardship" : "quiet";
  const life = muts.some((m) => m.lifeAltering);
  const visual = muts.some((m) => m.visual);
  const stakes: Stakes = life ? "life-altering" : visual || before.pending === "combat" || combatStart ? "notable" : (def && choiceId !== "look") || muts.some((m) => m.kind !== "region") ? "minor" : "quiet";

  const parts: string[] = [];
  const add = (k: string | undefined) => {
    if (k && !parts.includes(k)) parts.push(k);
  };
  for (const m of muts) if (m.subject !== "party" && m.subject !== "train") add(m.subject);
  if (scene) {
    const idOf = (mid: string | undefined) => (mid ? (after.party.find((p) => p.id === mid) ?? before.party.find((p) => p.id === mid))?.id : undefined);
    for (const k of [scene.actor, scene.other, scene.a, scene.b]) {
      const id = idOf(k);
      if (id) add(before.party.find((p) => p.id === id)?.isLeader ? "leader" : id);
    }
  }
  if (!parts.length || def || enemy) add("leader");
  if (def?.kind === "stranger") add("archetype.stranger");
  if (enemy) add(`archetype.${archetypeForEnemy(enemy)}`);

  const truth = scene ? scene.truth : null;
  let templateKey: string;
  if (scene && def && choiceId !== "look") {
    const grp = truthGroup(scene.id, choiceId, scene.truth);
    const idx = matchOutcome(scene.id, choiceId, scene.truth, text);
    templateKey = `${scene.id}.${choiceId}.${grp}.o${idx < 0 ? "x" : idx}`;
  } else if (before.pending === "combat" && enemy) {
    templateKey = `combat.${enemy}.${choiceId}`;
  } else {
    templateKey = `${before.pending}.${choiceId}`;
  }
  if (!scene || !def) {
    const primary = muts.find((m) => m.kind !== "look" && m.kind !== "region");
    if (primary) templateKey += `+${primary.kind}`;
  }

  const title = def ? fillTitle(def.title) : titleFor(kind, muts);
  return {
    id: `beat-${index}`,
    index,
    tx: 0,
    day: before.day,
    miles: Math.round(before.miles),
    region: after.region,
    choiceId,
    pending: before.pending,
    sceneId: def ? def.id : null,
    sceneTitle: def ? fillTitle(def.title) : null,
    truth,
    kind,
    stakes,
    title,
    text: text.length ? text : muts.filter((m) => m.kind !== "look" && m.kind !== "region").map((m) => m.summary),
    participants: parts,
    templateKey,
    mutations: muts,
  };
}

function archetypeForEnemy(enemy: string): string {
  return enemy === "hollowed-pack" || enemy === "hollowed-single" ? "hollowed" : enemy;
}

function titleFor(kind: BeatKind, muts: Mutation[]): string {
  const first = muts.find((m) => m.kind !== "look" && m.kind !== "region");
  if (first) return first.summary.replace(/\.$/, "");
  switch (kind) {
    case "road":
      return "The road";
    case "camp":
      return "Camp";
    case "combat":
      return "Blood on the road";
    default:
      return "The train moves on";
  }
}

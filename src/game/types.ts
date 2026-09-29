// Core data model for The Great Haze. Everything in GameState is plain JSON so
// a run can be saved, restored, and replayed from a seed.

import type { Amount } from "./rng.ts";
import type { ForkView, MapHud, MapOffer, RouteState } from "./map-types.ts";
import type { CheckDef, CheckKind, CheckResult, Line, Look, SpokenLine, TellView } from "./talk-types.ts";
import type { AffairOp, RelKind, RelState } from "./rel-types.ts";

export * from "./talk-types.ts";
export * from "./rel-types.ts";
export type { RelationView } from "./relationships.ts";

export const RESOURCE_IDS = [
  "rations",
  "torches",
  "ammo",
  "medicine",
  "spares",
  "veils",
  "rockets",
] as const;
export type ResourceId = (typeof RESOURCE_IDS)[number];
export type Resources = Record<ResourceId, number>;

export const ROLES = ["scout", "mechanic", "medic", "hunter", "guard", "speaker"] as const;
export type Role = (typeof ROLES)[number];

export const TRAITS = [
  "hothead",
  "kind",
  "paranoid",
  "greedy",
  "stoic",
  "pious",
  "coward",
  "veteran",
  "charming",
  "sickly",
  "haunted",
] as const;
export type Trait = (typeof TRAITS)[number];

export type PaceId = "easy" | "steady" | "hard" | "halt";
export type RationId = "full" | "meager" | "bare";
export type Truth = "genuine" | "trap" | "none";
export type HazeZone = "far" | "near" | "close" | "upon";
export type Difficulty = "normal" | "dire";

export type RegionId = "tallow" | "fen" | "flats" | "pines" | "spine" | "threshold";

export interface Member {
  id: string;
  name: string;
  role: Role;
  traits: Trait[];
  bio: string;
  health: number;
  maxHealth: number;
  /** 0-100. Low nerve fuels quarrels, bad perception and breakdowns. */
  nerve: number;
  /** 0-100 trust in the wagon-master (the player). */
  trust: number;
  wounded: boolean;
  sick: boolean;
  /** Dies at the second nightfall unless treated. */
  dying: boolean;
  /** Day number the member started dying. */
  dyingSince?: number;
  /** Haze exposure, 0-3. At 3 the member is Turned. */
  fog: number;
  alive: boolean;
  /** How they left the train, once !alive. */
  fate?: string;
  isLeader: boolean;
  recruited?: boolean;
  /** Notable things that happened to them, newest last (capped). Short past-tense lines. */
  history: HistoryEntry[];
}

export interface HistoryEntry {
  day: number;
  text: string;
}

// ---------------------------------------------------------------------------
// Effects, conditions and scene content (declarative; interpreted by the engine)
// ---------------------------------------------------------------------------

export type Who =
  | "leader"
  | "actor"
  | "other"
  | "a"
  | "b"
  | "random"
  | "randomOther"
  | "two"
  | "all"
  | "others"
  | "weakest"
  | "fogsick"
  /** Whoever made the option's dialogue check (see checks.ts). */
  | "by"
  | { first: Who[] }
  | { role: Role }
  | { trait: Trait };

export type Cond =
  | { role: Role }
  | { trait: Trait }
  | { res: ResourceId; min: number }
  | { scrip: number }
  | { flag: string; min?: number; max?: number }
  | { gapBelow: number }
  | { gapAbove: number }
  | { wagonsMin: number }
  | { leaderFog: boolean }
  | { recruitLeft: string }
  /** A named companion (see content/npcs.ts) is alive on the train. */
  | { aboard: string }
  | { fog: true }
  /** A member bound in the scene (or otherwise resolved by `Who`) has this trait. */
  | { ofWho: Who; has: Trait }
  /** The pair's relationship is one of these kinds (as it really is, secrets included). */
  | { relKind: { a: Who; b: Who; kinds: RelKind[] } }
  /** The pair's affinity is within a range. */
  | { aff: { a: Who; b: Who; min?: number; max?: number } }
  | { partyMin: number }
  | { partyMax: number }
  | { not: Cond }
  | { any: Cond[] };

export type Effect =
  | { t: "res"; res: ResourceId; d: Amount }
  | { t: "scrip"; d: Amount }
  | { t: "hp"; who: Who; d: Amount; lethal?: boolean }
  | { t: "nerve"; who: Who; d: Amount }
  | { t: "trust"; who: Who; d: Amount }
  | { t: "bond"; a: Who; b: Who; d: Amount }
  | { t: "bondAll"; d: Amount }
  /** Set what two people are to each other (courting, lovers, spouses, estranged...). */
  | { t: "rel"; a: Who; b: Who; kind: RelKind }
  /** Act on the affair the scene is about: a = wronged, b = culprit, other = lover. */
  | { t: "affair"; op: AffairOp }
  /** Add a short past-tense line to someone's history. Text may use {a} {b} {actor} {other} {leader}. */
  | { t: "note"; who: Who; text: string }
  | { t: "status"; who: Who; s: "wounded" | "sick" | "fog"; v?: number }
  | { t: "cure"; who: Who; s: "wounded" | "sick" | "fog" }
  | { t: "repair"; d: Amount }
  | { t: "wagons"; d: number }
  | { t: "gap"; d: Amount }
  | { t: "advance"; miles: Amount }
  | { t: "hours"; d: Amount }
  | { t: "recruit"; id?: string; chance?: number }
  | { t: "combat"; enemy: string }
  | { t: "scene"; id: string; chance?: number; same?: boolean }
  | { t: "flag"; key: string; d: number }
  | { t: "kill"; who: Who; cause?: string }
  | { t: "end"; kind: EndingKind; headline: string; text: string[] }
  | { t: "leave"; who: Who; takes?: Partial<Record<ResourceId, number>>; cause?: string };

export type SceneKind =
  | "hazard"
  | "stranger"
  | "find"
  | "haze"
  | "oddity"
  | "respite"
  | "dispute"
  | "crisis"
  | "landmark";

export interface Outcome {
  weight?: number;
  mods?: { if: Cond; add: number }[];
  /** One short line of narration. The drama belongs in `talk`. */
  text: string;
  fx?: Effect[];
  /** Spoken lines played when this outcome lands. */
  talk?: Line[];
  /** Only eligible when the option's dialogue check went this way. */
  needs?: "success" | "fail";
}

export interface OptionDef {
  id: string;
  label: string;
  /** Extra flavor shown under the label. */
  hint?: string;
  hours?: number;
  hoursMod?: { if: Cond; mult?: number; add?: number };
  /** Known, up-front price. Paid whatever happens. */
  cost?: Partial<Resources> & { scrip?: number };
  requires?: Cond[];
  /** A seeded charisma or perception check made before the outcome is picked. */
  check?: CheckDef;
  /** Shown when `requires` fails. */
  why?: string;
  /** Who counts as {actor} for text and effects. */
  actor?: Who;
  /** Bookkeeping for run statistics. */
  tag?: "help" | "refuse";
  results: { genuine?: Outcome[]; trap?: Outcome[]; any?: Outcome[] };
}

export interface Tell {
  /** Stable id. Defaults to `<sceneId>:<index>`. */
  id?: string;
  text: string;
  /** How damning it is when seen: 1 subtle, 2 clear, 3 unmistakable. Default 2. */
  severity?: 1 | 2 | 3;
  /** What the observer says aloud when they spot it (at most ~14 words). */
  say?: string;
  /** Which truth this points at. "noise" tells appear under either truth. */
  shows: "genuine" | "trap" | "noise";
  /** Chance it is present given a matching truth (noise: chance of appearing). Default 0.65. */
  p?: number;
}

export interface SceneDef {
  id: string;
  kind: SceneKind;
  regions?: RegionId[];
  minMile?: number;
  maxMile?: number;
  weight: number;
  /** Multiplier applied when the Haze is close (gap < 25). */
  closeBias?: number;
  once?: boolean;
  when?: Cond[];
  /** Strangers only: probability the situation is genuine. Default 0.5. */
  genuineOdds?: number;
  title: string;
  /** Card narration: one or two short lines. */
  intro: string[];
  /** The scene's spoken setup: 2-6 short lines. */
  talk?: Line[];
  /** The engine queues this scene with its people already chosen (a, b, actor, other). */
  bound?: boolean;
  /**
   * Affair scenes (a = wronged, b = culprit, other = lover): "player" means playing it
   * teaches the wagon-master the secret; "public" means the wronged partner and the whole
   * train learn it too.
   */
  secret?: "player" | "public";
  /** Who "stranger" speakers are, for scenes with an unnamed outsider. */
  stranger?: { name: string; look: Look };
  tells?: Tell[];
  /** {actor} and {other} are drawn from the party excluding the wagon-master (needs two others). */
  others?: boolean;
  /** Dispute scenes: how likely the pair (a, b) is to be the one quarrelling. 0 = ineligible. */
  pairWeight?: (a: Member, b: Member, bond: number) => number;
  options: OptionDef[];
}

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------

export interface SceneInstance {
  id: string;
  truth: Truth;
  actor?: string;
  other?: string;
  a?: string;
  b?: string;
  /** Someone who has died or gone, for scenes about missing them ({lost}). */
  lost?: string;
  tells: { id?: string; text: string; revealed: boolean; phantom?: boolean; severity?: 1 | 2 | 3; say?: string }[];
  looks: number;
  /** Lines spoken during the scene: what the observer says as they notice things. */
  said?: SpokenLine[];
  /** The last perception check made in this scene. */
  check?: CheckResult;
  /** Whether a member has already tried to read the stranger. */
  read?: "genuine" | "trap" | "unsure";
  /** Who is doing the watching. */
  observer?: string;
  /** Flavor from the most recent "look closer". */
  note?: string;
}

export interface CombatInstance {
  enemy: string;
  hp: number;
  maxHp: number;
  round: number;
  /** Rounds where the enemy is off balance (fewer hits). */
  stagger: number;
  log: string[];
}

export type QueueItem =
  | { t: "scene"; id: string; a?: string; b?: string; actor?: string; other?: string; lost?: string }
  | { t: "combat"; enemy: string }
  | { t: "arrival"; id: string }
  | { t: "fork"; node: string }
  | { t: "beat"; edge: string; i: number; prep: number; lie: number }
  | { t: "plan" }
  | { t: "travel" };

export type Pending =
  | { kind: "setup"; offered: string[]; picked: string[] }
  | { kind: "store"; storeId: string; then?: string; notes?: string[] }
  | { kind: "arrival"; id: string }
  | { kind: "fork"; node: string }
  | { kind: "plan"; notes?: string[] }
  | { kind: "scene"; scene: SceneInstance }
  | { kind: "combat"; combat: CombatInstance }
  | { kind: "result"; title: string; lines: string[]; notes: string[]; talk?: SpokenLine[]; check?: CheckResult }
  | { kind: "ending" };

export interface DayState {
  hoursUsed: number;
  /** Odometer at dawn, so shortcuts and landmarks resolve correctly. */
  startMiles: number;
  /** Miles the Haze will advance today. */
  hazeMiles: number;
  surge: "surge" | "lull" | null;
  /** Whether a haunted member forecast today's Haze. */
  forecast: boolean;
}

export type EndingKind = "victory" | "consumed" | "lost";

export interface Ending {
  kind: EndingKind;
  headline: string;
  lines: string[];
  score: number;
}

export interface RunStats {
  strangersHelped: number;
  strangersRefused: number;
  trapsSprung: number;
  trapsAvoided: number;
  genuineTurnedAway: number;
  fights: number;
  hoursLost: number;
  deaths: number;
  departures: number;
  starvedDays: number;
  minGap: number;
  daysNoRations: number;
}

export interface GameState {
  version: 1;
  seed: number;
  rng: number;
  difficulty: Difficulty;
  leaderName: string;
  day: number;
  miles: number;
  gap: number;
  scrip: number;
  res: Resources;
  train: { wagons: number; condition: number };
  party: Member[];
  bonds: Record<string, number>;
  /** What pairs are to each other, and the secrets among them. See relationships.ts. */
  rel: RelState;
  pace: PaceId;
  rations: RationId;
  today: DayState;
  carryHours: number;
  flags: Record<string, number>;
  /** Recent scene ids, newest last (for variety). */
  recent: string[];
  used: string[];
  landmarks: string[];
  recruitsUsed: string[];
  stock: Record<string, Partial<Record<ResourceId, number>>>;
  queue: QueueItem[];
  pending: Pending;
  journal: string[];
  stats: RunStats;
  ending: Ending | null;
  /** Position on the route graph and the maps held. Absent in saves from before the route map. */
  route: RouteState;
}

// ---------------------------------------------------------------------------
// Presentation-facing shapes (what a UI layer renders)
// ---------------------------------------------------------------------------

export interface ScreenOption {
  id: string;
  label: string;
  hint?: string;
  hours?: number;
  disabled?: string;
  /** Who will make the dialogue check, and how good they are at it. */
  check?: { kind: CheckKind; by: string; byName: string; bonus: number };
}

export interface MemberView {
  id: string;
  name: string;
  role: Role;
  traits: Trait[];
  health: number;
  nerve: number;
  trust: number;
  conditions: string[];
  isLeader: boolean;
  /** Notable things that happened to them, newest last. */
  history?: HistoryEntry[];
  /** Set for named companions from content/npcs.ts: how they look. */
  look?: Look;
}

export interface Hud {
  day: number;
  miles: number;
  milesToGo: number;
  gap: number;
  zone: HazeZone;
  hazeToday: number;
  region: string;
  regionId: RegionId;
  sky: string;
  scrip: number;
  res: Resources;
  cargoUsed: number;
  cargoCap: number;
  wagons: number;
  condition: number;
  pace: PaceId;
  rations: RationId;
  party: MemberView[];
  /** The route as the player believes it: pure data for drawing a map. */
  map: MapHud;
}

export interface StoreLine {
  id: ResourceId;
  name: string;
  blurb: string;
  price: number;
  sellPrice: number;
  owned: number;
  weight: number;
  stock: number;
}

export interface StoreView {
  name: string;
  keeper: string;
  lines: StoreLine[];
  /** Maps for sale here. */
  maps?: MapOffer[];
}

export interface Screen {
  kind: Pending["kind"];
  title: string;
  lines: string[];
  observations: string[];
  notes: string[];
  options: ScreenOption[];
  hud: Hud;
  store?: StoreView;
  /** Fork screens: the roads on offer, as the player's map describes them. */
  fork?: ForkView;
  ending?: Ending;
  /** Spoken lines to stage. Empty when the screen has none. */
  talk: SpokenLine[];
  /** A dialogue or perception check that just happened, if any. */
  check?: CheckResult;
  /** Tells the party has seen (hidden ones are never exposed). */
  tells: TellView[];
}

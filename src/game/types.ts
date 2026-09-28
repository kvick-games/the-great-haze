// Core data model for The Great Haze. Everything in GameState is plain JSON so
// a run can be saved, restored, and replayed from a seed.

import type { Amount } from "./rng.ts";
import type { ForkView, MapHud, MapOffer, RouteState } from "./map-types.ts";

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
  | { fog: true }
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
  text: string;
  fx?: Effect[];
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
  /** Shown when `requires` fails. */
  why?: string;
  /** Who counts as {actor} for text and effects. */
  actor?: Who;
  /** Bookkeeping for run statistics. */
  tag?: "help" | "refuse";
  results: { genuine?: Outcome[]; trap?: Outcome[]; any?: Outcome[] };
}

export interface Tell {
  text: string;
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
  intro: string[];
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
  tells: { text: string; revealed: boolean; phantom?: boolean }[];
  looks: number;
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
  | { t: "scene"; id: string; a?: string; b?: string; actor?: string }
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
  | { kind: "result"; title: string; lines: string[]; notes: string[] }
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
}

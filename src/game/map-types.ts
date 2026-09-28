// Shapes for the route graph, the maps a player can hold of it, and the pure
// data view (`hud().map`) a client draws a parchment map from. Plain JSON only.

import type { RegionId } from "./types.ts";
import type { TellView } from "./talk-types.ts";

export type NodeKind = "start" | "town" | "outpost" | "landmark" | "fork" | "end";
export type TwistKind = "bridge-out" | "dead-end" | "burned";
export type Accuracy = "faithful" | "careless" | "misleading";

export interface NodeDef {
  id: string;
  name: string;
  kind: NodeKind;
  /** True position in map space, 0..1. */
  x: number;
  y: number;
  blurb: string;
  region: RegionId;
  storeId?: string;
  /** Scene queued when the train leaves (or passes through) this place. */
  scene?: string;
}

/** Something that happens partway along a road. A `twist` is a hidden truth a map may or may not know. */
export interface BeatDef {
  /** Fraction of the edge, 0..1. */
  at: number;
  scene: string;
  twist?: { kind: TwistKind; clear: string; truth: string };
}

export interface EdgeDef {
  id: string;
  from: string;
  to: string;
  name: string;
  terrain: RegionId;
  /** True length in miles. */
  miles: number;
  /** True danger, 1 (quiet) to 3 (deadly). */
  danger: 1 | 2 | 3;
  /** Multiplier on wagon speed, on top of the terrain. */
  speed?: number;
  /** Multiplier on how far the Haze moves per day while on this road. */
  hazeMult?: number;
  /** Multiplier on wagon wear. */
  wear?: number;
  /** Multiplier on foraging. */
  forage?: number;
  /** Rations left along the way, awarded on completing the road. */
  cache?: [number, number];
  /** What the eye sees at the fork: honest, but not always plain. */
  sign?: string;
  /** Intermediate points (map space) so parallel roads bow apart. */
  via?: [number, number][];
  beats?: BeatDef[];
  /** The road the rough default map draws as the way. */
  main?: boolean;
  /** How a map describes this road: the truth, and the lies a bad map tells. */
  words?: { truth: string; rosy?: string; grim?: string };
}

export interface EdgeClaim {
  miles: number;
  /** null: the map says nothing. */
  danger: number | null;
  /** "clear" is an assertion that nothing blocks the way; "unknown" is silence. */
  twist: "unknown" | "clear" | "known";
  note?: string;
}

export interface PhantomRoute {
  id: string;
  from: string;
  to: string;
  name: string;
  miles: number;
  danger: number;
  note: string;
  via: [number, number][];
}

export interface MapCopy {
  id: string;
  name: string;
  /** Store the map was bought at. */
  seller: string;
  /** Hidden from the player until beliefs are proved wrong. */
  accuracy: Accuracy;
  /** Edges of this order or later are covered. */
  fromOrder: number;
  claims: Record<string, EdgeClaim>;
  phantoms: PhantomRoute[];
  jitter: Record<string, [number, number]>;
}

export type RouteEvent =
  | { k: "node"; id: string; via?: string }
  | { k: "beat"; edge: string; i: number; prep: 0 | 1; lie: 0 | 1 }
  | { k: "cache"; edge: string };

export interface WrongBelief {
  id: string;
  kind: "edge" | "route";
  believed: string;
  truth: string;
}

export interface RouteState {
  /** The last node the train stood at (or the fork it waits at). */
  node: string;
  /** The road being travelled, or null when standing at a node. */
  edge: string | null;
  /** Miles along `edge`. */
  along: number;
  /** Every road entered, in order. */
  path: string[];
  visited: string[];
  /** "edgeId#i" of beats already played. */
  beats: string[];
  /** Roads whose true nature the train has seen for itself. */
  known: string[];
  wrong: WrongBelief[];
  /** Maps held, oldest first. */
  maps: MapCopy[];
  /** Per map id: [claims that held up, claims proved wrong]. */
  checks: Record<string, [number, number]>;
  /** Ids of phantom routes discovered to be fictions. */
  bad: string[];
  /** Travel hours left over on reaching a fork; spent once a road is chosen. */
  hold: number;
  /** Events crossed but not yet delivered to the player. */
  crossed: RouteEvent[];
}

// ---------------------------------------------------------------------------
// Presentation
// ---------------------------------------------------------------------------

export interface MapNodeView {
  id: string;
  name: string;
  kind: NodeKind;
  x: number;
  y: number;
  visited: boolean;
  current: boolean;
  /** Has a shop (and possibly maps). */
  store: boolean;
}

export interface MapEdgeView {
  id: string;
  from: string;
  to: string;
  name: string;
  via: [number, number][];
  /** Length as the player believes it. */
  miles: number;
  /** 0-3 as believed; null when nobody has said. */
  danger: number | null;
  terrain: RegionId | null;
  /** What the player believes about anything blocking the way. */
  twist: "unknown" | "clear" | "known";
  note?: string;
  /** Where the belief came from: "rough" or the id of a map held. */
  source: string;
  travelled: boolean;
  /** On the road the train has taken or is taking. */
  onPath: boolean;
  /** Proven wrong by experience. */
  wrong?: boolean;
}

export interface MapHud {
  nodes: MapNodeView[];
  edges: MapEdgeView[];
  position: { node: string; edge: string | null; fraction: number; x: number; y: number; atFork: boolean };
  wrong: WrongBelief[];
  maps: { id: string; name: string; seller: string; right: number; wrong: number }[];
}

export interface ForkRouteView {
  /** Choice id, `route:<edgeId>`. */
  id: string;
  name: string;
  miles: number;
  danger: number | null;
  twist: "unknown" | "clear" | "known";
  note?: string;
  source: string;
  sign?: string;
  wrong?: boolean;
}

export interface ForkView {
  node: string;
  routes: ForkRouteView[];
}

export interface MapClue {
  text: string;
}

export interface MapOffer {
  id: string;
  name: string;
  seller: string;
  price: number;
  pitch: string;
  clues: string[];
  /** The same clues in the shape scene tells use, for clients that render tells uniformly. */
  tells: TellView[];
  owned: boolean;
}

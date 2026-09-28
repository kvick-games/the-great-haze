// Types for spoken dialogue, dialogue checks, tells and how people look.
// Re-exported from types.ts so the rest of the game imports them from one place.

import type { Role, Trait, Who } from "./types.ts";

/** Emotional register of a spoken line. The 3D client maps each to a pose and face. */
export const MOODS = ["calm", "afraid", "angry", "pleading", "sly", "grieving", "cold"] as const;
export type Mood = (typeof MOODS)[number];

/** Body language that goes with a line. */
export const GESTURES = ["none", "point", "beckon", "shrug", "raise-hands", "clutch", "kneel", "draw-weapon", "offer", "turn-away"] as const;
export type Gesture = (typeof GESTURES)[number];

/** Who is talking. Resolved against the scene: `observer` is the member watching for tells. */
export type Speaker =
  | "leader"
  | "actor"
  | "other"
  | "a"
  | "b"
  | "observer"
  | "by"
  | "stranger"
  | `role:${Role}`
  | `npc:${string}`;

export interface Line {
  who: Speaker;
  text: string;
  mood?: Mood;
  gesture?: Gesture;
  /** Party speakers only: what they say instead if they have this trait (first match wins). */
  alt?: Partial<Record<Trait, string>>;
}

export type SpeakerKind = "member" | "stranger" | "npc";

/** A line resolved for a screen: a real person, real words, a mood and a gesture. */
export interface SpokenLine {
  speaker: string;
  name: string;
  kind: SpeakerKind;
  text: string;
  mood: Mood;
  gesture: Gesture;
}

export const CHECK_KINDS = ["persuade", "calm", "haggle", "talk-down", "spot", "see-lie"] as const;
export type CheckKind = (typeof CHECK_KINDS)[number];

export interface CheckDef {
  kind: CheckKind;
  dc: number;
  /** Who or what the check is against, for the result. Defaults to the scene's stranger or title. */
  target?: string;
  /** People in the scene who cannot make the check. */
  exclude?: Who[];
}

export interface CheckResult {
  kind: CheckKind;
  /** Member id who made the check. */
  by: string;
  byName: string;
  target: string;
  /** The d20. */
  roll: number;
  bonus: number;
  dc: number;
  success: boolean;
  /** Who was chosen and where the bonus came from. */
  reason: string;
}

export interface TellView {
  id: string;
  text: string;
  visible: boolean;
  severity: 1 | 2 | 3;
}

export const BUILDS = ["slight", "lean", "average", "sturdy", "broad", "heavy", "gaunt", "small"] as const;
export type Build = (typeof BUILDS)[number];
export const HEIGHTS = ["short", "average", "tall"] as const;
export type Height = (typeof HEIGHTS)[number];
export const HAIR_STYLES = ["bald", "cropped", "short", "shaggy", "long", "braided", "bun", "covered"] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];
export const FACIAL = ["none", "stubble", "beard", "long-beard", "moustache"] as const;
export type Facial = (typeof FACIAL)[number];

/** How a person looks. Drives 3D figures and character datoms for video. */
export interface Look {
  build: Build;
  height: Height;
  age: number;
  skin: string;
  hair: { style: HairStyle; color: string; facial: Facial };
  /** Worn items, most visible first, each a short phrase ("long oilcloth coat, mud to the knees"). */
  clothing: string[];
  /** Two or three dominant colours. */
  palette: string[];
  /** The one thing you would remember them by. */
  prop: { id: string; desc: string };
  /** Scars, injuries, tics. */
  marks: string[];
  /** One sentence for a prompt: what a stranger would notice first. */
  summary: string;
}

/** A companion who can join the train. See content/npcs.ts. */
export interface NpcDef {
  id: string;
  name: string;
  role: Role;
  traits: [Trait, Trait];
  /** One line. */
  backstory: string;
  look: Look;
  /** What goes wrong (or gets complicated) once they are aboard. */
  complication: {
    text: string;
    /** Scene queued a few days after they join. */
    scene: string;
    afterDays: number;
  };
  /** Their own words, spoken when they join. */
  join: Line[];
  maxHealth?: number;
  nerve?: number;
  /** May also be drawn by scenes that offer "someone" rather than this person. */
  generic?: boolean;
}

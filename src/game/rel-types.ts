// Types for relationships between party members: how they feel about each other,
// and the secrets (affairs) that some of them keep. Plain JSON, saved with the run.
// Re-exported from types.ts so the rest of the game imports them from one place.

export const REL_KINDS = ["stranger", "friend", "close-friend", "rival", "courting", "lovers", "spouses", "estranged"] as const;
export type RelKind = (typeof REL_KINDS)[number];

/** Kinds that make two people a couple. */
export const COUPLE_KINDS: readonly RelKind[] = ["courting", "lovers", "spouses"];

/**
 * The state of one pair. The affinity score itself lives in `GameState.bonds`
 * (-100..100), shared with the rest of the game; this records what the two are to
 * each other. Affairs are not here: they are secrets (see below).
 */
export interface Relation {
  kind: RelKind;
  /** Day the pair last changed kind. */
  since: number;
}

/**
 * A secret affair. `culprit` is the one who cheats, `lover` the person they cheat
 * with, and `wronged` the partners (of the culprit, and of the lover if they have
 * one) who are being deceived.
 */
export interface Secret {
  id: number;
  kind: "affair";
  culprit: string;
  lover: string;
  wronged: string[];
  started: number;
  /** Day of the most recent tryst. */
  last: number;
  trysts: number;
  /** Members who know (other than the two involved). */
  knows: string[];
  /** Wronged partners who know. */
  wrongedKnows: string[];
  /** Wronged partners who have already reacted to what they learned. */
  responded: string[];
  /** Wronged partners who know and are brooding rather than acting. */
  brooding: Record<string, number>;
  /** Whoever last told a wronged partner. */
  teller?: string;
  /** The wagon-master knows, whether by sight or because someone told them. */
  playerKnows: boolean;
  /** The wagon-master has already glimpsed it (one look per secret). */
  glimpsed: boolean;
  /** A noticer who is squeezing the culprit for silence. */
  blackmailer?: string;
  /** The wagon-master has covered for them: harder to notice. */
  covered?: boolean;
  /** Set once it is over, with how it ended. */
  ended?: string;
  /** Day everyone came to know, if it went public. */
  publicDay?: number;
}

export interface RelState {
  pairs: Record<string, Relation>;
  /** Hidden disposition: 0 (cannot be trusted) .. 100 (would never stray). */
  faith: Record<string, number>;
  secrets: Secret[];
  nextSecret: number;
  /** Scenes the relationships want to play but had no room for yet. */
  later: RelSceneItem[];
}

export interface RelSceneItem {
  id: string;
  a?: string;
  b?: string;
  actor?: string;
  other?: string;
  lost?: string;
}

/** One of the outcomes of an affair-notice roll (see relationships.ts). */
export interface NoticeRoll {
  by: string;
  byName: string;
  roll: number;
  bonus: number;
  dc: number;
  success: boolean;
  reason: string;
}

export type AffairOp =
  /** Everyone comes to know. */
  | "reveal"
  /** The wronged partner learns (from the wagon-master). */
  | "tell-wronged"
  /** The wagon-master covers for them: it becomes harder to notice. */
  | "cover"
  /** The affair is over. */
  | "end"
  /** The blackmailer is silenced. */
  | "silence"
  /** The secret is safe, and the wagon-master keeps it. */
  | "keep";

// What the music should be doing, as a pure function of what the player sees.
//
// The simulation knows nothing about music. This maps its presentation state
// (the current screen, the party, the world's light and motion) to the score's
// states and parameters; the score's rules turn those into sections, layers
// and themes. See assets/music/the-great-haze.dtscore.json.

import type { GameState, HazeZone, Pending, RegionId, SceneKind } from "../../../src/game/types.ts";
import { SCENES } from "../../../src/game/content/scenes/index.ts";
import { NPCS } from "../../../src/game/content/npcs.ts";

export type MusicScene = "title" | "muster" | "town" | "trail" | "camp" | "scene" | "fork" | "landmark" | "combat" | "ending";

export interface MusicStates {
  scene: MusicScene;
  region: RegionId;
  /** The kind of situation on the road (stranger, hazard, haze...), or "none". */
  scenario: string;
  /** Whose theme to play: a named companion, the witch, or "none". */
  focus: string;
  ending: "victory" | "loss" | "none";
  mourning: "yes" | "no";
  [key: string]: string;
}

export interface MusicParams {
  haze: number;
  danger: number;
  intensity: number;
  night: number;
  [key: string]: number;
}

/** Everything the mapping reads. The controller fills it from the director and world. */
export interface MusicView {
  /** Null on the title screen (no run in progress). */
  state: Pick<GameState, "day" | "gap" | "pending" | "party" | "ending"> | null;
  screenKind: Pending["kind"] | null;
  regionId: RegionId | null;
  zone: HazeZone | null;
  /** 0 by day, 1 at night. */
  night: number;
  /** 0 on the road, 1 when the wagons are circled for camp. */
  camp: number;
  /** 0 standing, 1 rolling at pace. */
  moving: number;
  /** A cinematic is playing (travel between screens). */
  busy: boolean;
  /** Someone recently died and the grief section should hold. */
  mourning: boolean;
  /** The scene state before this one, so a result screen can stay where it was. */
  previous: MusicScene | null;
}

/** Scenes that are staged as landmarks (mirrors the director's list). */
export const LANDMARK_SCENE_IDS = new Set(["ninefold-crossing", "glass-fork", "saint-ambrose", "toll-gate", "the-gate"]);

const SCENE_KIND = new Map<string, SceneKind>(SCENES.map((s) => [s.id, s.kind]));
/** Named companions each have a theme in the score. */
export const COMPANION_IDS: ReadonlySet<string> = new Set(NPCS.map((n) => n.id));

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** How close the Haze is, 0 (far behind) to 1 (upon the wagons). */
export function hazeLevel(gap: number): number {
  return clamp01((50 - gap) / 45);
}

function isWitch(id: string | undefined): boolean {
  return !!id && /witch|hag|crone/i.test(id);
}

/** The person a scene is about, if they have a theme. */
function sceneFocus(pending: Pending, sceneId: string | undefined): string {
  if (isWitch(sceneId)) return "witch";
  if (pending.kind !== "scene") return "none";
  const inst = pending.scene;
  for (const id of [inst.actor, inst.a, inst.b, inst.other]) {
    if (!id) continue;
    if (isWitch(id)) return "witch";
    if (COMPANION_IDS.has(id)) return id;
  }
  return "none";
}

/** At camp, the fire belongs to one companion a night, in turn. */
function campFocus(state: NonNullable<MusicView["state"]>): string {
  const here = state.party.filter((m) => m.alive && COMPANION_IDS.has(m.id)).map((m) => m.id);
  return here.length ? here[state.day % here.length] : "none";
}

export function musicScene(view: MusicView): MusicScene {
  const s = view.state;
  if (!s || !view.screenKind) return "title";
  const kind = view.screenKind;
  if (kind === "ending" || s.ending) return "ending";
  if (kind === "combat") return "combat";
  if (kind === "setup") return "muster";
  // Rolling between screens: the road, whatever card comes next.
  if (view.busy && view.moving > 0.3) return "trail";
  switch (kind) {
    case "store":
    case "arrival":
      return "town";
    case "fork":
      return "fork";
    case "plan":
      return view.night > 0.5 || view.camp > 0.5 ? "camp" : "trail";
    case "scene": {
      const id = s.pending.kind === "scene" ? s.pending.scene.id : "";
      return LANDMARK_SCENE_IDS.has(id) || SCENE_KIND.get(id) === "landmark" ? "landmark" : "scene";
    }
    case "result": {
      const prev = view.previous;
      if (prev === "scene" || prev === "landmark" || prev === "town") return prev;
      return view.night > 0.5 || view.camp > 0.5 ? "camp" : "trail";
    }
  }
  return "trail";
}

export function musicCues(view: MusicView): { states: MusicStates; params: MusicParams } {
  const s = view.state;
  const scene = musicScene(view);
  const haze = s ? hazeLevel(s.gap) : 0;
  const sceneId = s && s.pending.kind === "scene" ? s.pending.scene.id : undefined;
  const sceneKind = sceneId ? SCENE_KIND.get(sceneId) : undefined;
  let scenario = "none";
  if (scene === "scene" || scene === "landmark") scenario = isWitch(sceneId) ? "witch" : sceneKind ?? "stranger";
  let focus = "none";
  if (s && (scene === "scene" || scene === "landmark")) focus = sceneFocus(s.pending, sceneId);
  else if (s && scene === "camp") focus = campFocus(s);

  let ending: MusicStates["ending"] = "none";
  if (scene === "ending") ending = s?.ending?.kind === "victory" ? "victory" : "loss";

  let danger = haze * 0.6;
  if (sceneKind === "crisis" || sceneKind === "haze" || sceneKind === "hazard") danger = Math.max(danger, 0.5);
  if (scene === "combat" && s?.pending.kind === "combat") {
    const c = s.pending.combat;
    const hurt = s.party.filter((m) => m.alive).reduce((t, m) => t + (1 - m.health / Math.max(1, m.maxHealth)), 0);
    danger = clamp01(0.45 + 0.35 * (c.hp / Math.max(1, c.maxHp)) + 0.2 * hurt);
  }
  const intensity = scene === "combat" ? clamp01(0.7 + 0.3 * danger) : clamp01(0.2 + 0.5 * view.moving + 0.3 * haze);

  return {
    states: {
      scene,
      region: view.regionId ?? "tallow",
      scenario,
      focus,
      ending,
      mourning: view.mourning && scene !== "ending" && scene !== "combat" ? "yes" : "no",
    },
    params: { haze, danger: clamp01(danger), intensity, night: clamp01(view.night) },
  };
}

/** Members dead now who were alive before: the ones who died in between. */
export function newlyDead(before: ReadonlySet<string>, party: readonly { id: string; alive: boolean }[]): string[] {
  return party.filter((m) => !m.alive && before.has(m.id)).map((m) => m.id);
}

/** Whether the Haze moved to a closer zone. */
export function zoneWorsened(before: HazeZone | null, now: HazeZone | null): boolean {
  const order: HazeZone[] = ["far", "near", "close", "upon"];
  if (!before || !now) return false;
  return order.indexOf(now) > order.indexOf(before);
}

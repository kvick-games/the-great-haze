// Who is on screen when someone speaks. Party members are the caravan's own
// figures. The stranger (or a named companion met on the road) is the scene's
// staged figure when there is one, dressed to match their described look;
// otherwise a loose figure is spawned and released when the scene ends.

import * as THREE from "three";
import type { SceneInstance, SpokenLine } from "../../../src/game/types.ts";
import { sceneById } from "../../../src/game/content/scenes/index.ts";
import { npcById } from "../../../src/game/content/npcs.ts";
import { Figure } from "../world/actors.ts";
import { ENEMY_LOOKS, lookForSim } from "../world/looks.ts";
import { disposeTree } from "../world/dispose.ts";
import { terrainHeight } from "../world/regions.ts";
import type { Stage, StageFigure } from "../scenes/vignettes.ts";
import type { World } from "../world/world.ts";

/** Keys a stage may use for the person who does the talking, best first. */
const TALKER_KEYS = ["stranger", "keeper", "preacher"];

export interface Spot {
  pos: THREE.Vector3;
  face: THREE.Vector3;
}

export class Cast {
  private guests = new Map<string, Figure>();
  private dressed = new WeakSet<Stage>();
  private bound = new WeakMap<Stage, string>();

  private world: World;
  constructor(world: World) {
    this.world = world;
  }

  static primary(st: Stage | null): StageFigure | undefined {
    if (!st) return undefined;
    for (const k of TALKER_KEYS) {
      const f = st.figures.find((x) => x.key === k && x.fig.root.visible);
      if (f) return f;
    }
    return undefined;
  }

  /** Give a stage's stranger the described look of the scene's stranger (or companion). */
  dress(st: Stage, inst: SceneInstance): void {
    const def = sceneById(inst.id);
    if (!def?.stranger || this.dressed.has(st)) return;
    const sf = Cast.primary(st);
    if (!sf) return;
    this.dressed.add(st);
    this.reskin(sf, lookForSim(def.stranger.look, def.stranger.name), st);
  }

  private reskin(sf: StageFigure, look: ReturnType<typeof lookForSim>, st: Stage): void {
    const old = sf.fig;
    const nf = new Figure(look);
    nf.root.position.copy(old.root.position);
    nf.yaw = nf.targetYaw = old.yaw;
    nf.pose = old.pose;
    old.root.removeFromParent();
    disposeTree(old.root);
    st.group.add(nf.root);
    sf.fig = nf;
  }

  /** The figure that speaks this line, or null when nobody can be staged for them. */
  figureFor(line: SpokenLine, st: Stage | null, inst: SceneInstance | null, spot: () => Spot): Figure | null {
    const tr = this.world.train;
    if (line.kind === "member") return tr.figure(line.speaker) ?? null;
    if (line.kind === "npc") {
      const aboard = tr.figure(line.speaker);
      if (aboard) return aboard;
    }
    const key = line.speaker;
    const have = this.guests.get(key);
    if (have) return have;
    const sf = Cast.primary(st);
    if (st && sf) {
      const owner = this.bound.get(st);
      if (!owner || owner === key) {
        if (!owner) {
          this.bound.set(st, key);
          // A companion met in a scene with no described stranger takes the stage figure's place.
          const npc = line.kind === "npc" ? npcById(line.speaker) : undefined;
          if (npc && !(inst && sceneById(inst.id)?.stranger)) this.reskin(sf, lookForSim(npc.look, npc.id), st);
        }
        return sf.fig;
      }
    }
    return this.spawn(line, inst, spot());
  }

  private spawn(line: SpokenLine, inst: SceneInstance | null, at: Spot): Figure {
    const npc = line.kind === "npc" ? npcById(line.speaker) : undefined;
    const def = inst ? sceneById(inst.id) : undefined;
    const look = npc ? lookForSim(npc.look, npc.id) : def?.stranger ? lookForSim(def.stranger.look, def.stranger.name) : ENEMY_LOOKS.stranger;
    const fig = new Figure(look);
    fig.root.position.set(at.pos.x, terrainHeight(at.pos.x, at.pos.z), at.pos.z);
    fig.yaw = fig.targetYaw = Math.atan2(at.face.x - at.pos.x, at.face.z - at.pos.z);
    this.world.scene.add(fig.root);
    this.guests.set(line.speaker, fig);
    return fig;
  }

  update(dt: number, time: number): void {
    for (const f of this.guests.values()) f.update(dt, time);
  }

  /** The loose figures currently standing in the scene. */
  get loose(): Figure[] {
    return [...this.guests.values()];
  }

  /** Let the guests go: they walk off the way they came and are disposed. */
  release(): void {
    const gone = [...this.guests.values()];
    this.guests.clear();
    if (!gone.length) return;
    let t = 0;
    const off = this.world.onTick((dt) => {
      t += dt;
      for (const f of gone) f.setFade(Math.max(0, 1 - t / 0.8));
      if (t > 0.8) {
        off();
        for (const f of gone) {
          f.root.removeFromParent();
          disposeTree(f.root);
        }
      }
    });
    // Their update loop runs only while the cast owns them.
    const upd = this.world.onTick((dt) => {
      for (const f of gone) f.update(dt, this.world.time);
      if (t > 0.8) upd();
    });
  }
}

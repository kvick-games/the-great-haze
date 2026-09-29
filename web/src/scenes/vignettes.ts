// Staging for road events. Each scene id maps to a small composition built in
// a local frame: origin on the road ahead of the train, +z pointing back
// toward the approaching wagons, +x to the stranger's left-hand verge. The
// train halts short of it and the camera frames the pair.

import * as THREE from "three";
import { Figure, Wagon } from "../world/actors.ts";
import type { Pose } from "../world/actors.ts";
import { ENEMY_LOOKS } from "../world/looks.ts";
import type { Flame } from "../world/fx.ts";
import { CLEARINGS, terrainHeight } from "../world/regions.ts";
import { disposeTree } from "../world/dispose.ts";
import { roadPoint, roadYaw } from "../world/train.ts";
import * as P from "./pieces.ts";
import type { Piece } from "./pieces.ts";

export type StageLook = keyof typeof ENEMY_LOOKS;

export interface StageFigure {
  key: string;
  fig: Figure;
  /** Can walk over and join the train if the sim recruits someone here. */
  recruit?: boolean;
  /** Walks along local -z at this speed (processions, walkers). */
  drift?: number;
}

export class Stage {
  /** The scene this stage was built for ("" for towns and stores). */
  id = "";
  group = new THREE.Group();
  flames: Flame[] = [];
  figures: StageFigure[] = [];
  focus = new THREE.Vector3();
  /** Distance before the stage at which the lead wagon halts. */
  stopShort = 20;
  /** True when the event happens at the wagons themselves. */
  atTrain = false;
  s = 0;
  /** The clearing this stage flattened, so disposal only undoes its own. */
  private clearing: THREE.Vector4 | null = null;
  private fogMats: THREE.ShaderMaterial[] = [];
  private updaters: ((dt: number, time: number) => void)[] = [];

  /** Local point of interest; defaults to the road at the stage origin. */
  private lookLocal = new THREE.Vector3(0, 1.5, 0);
  clearRadius = 24;

  look(x: number, z: number, y = 1.5): void {
    this.lookLocal.set(x, y, z);
  }

  /** A small lantern on the ground so the scene has its own light. */
  lantern(x: number, z: number): void {
    this.add(P.groundLantern(), x, z);
  }

  add(p: Piece, x: number, z: number, ry = 0): Piece {
    p.group.position.set(x, 0, z);
    p.group.rotation.y = ry;
    this.group.add(p.group);
    this.flames.push(...p.flames);
    const fm = p.group.userData.fogMat as THREE.ShaderMaterial | undefined;
    if (fm) this.fogMats.push(fm);
    return p;
  }

  fig(look: StageLook, x: number, z: number, pose: Pose = "stand", key = "stranger", opts: { recruit?: boolean; ry?: number; drift?: number; eyes?: number } = {}): Figure {
    const f = new Figure(ENEMY_LOOKS[look]);
    f.root.position.set(x, 0, z);
    f.pose = pose;
    f.yaw = f.targetYaw = opts.ry ?? 0;
    f.eyeGlow = opts.eyes ?? 0;
    this.group.add(f.root);
    this.figures.push({ key, fig: f, recruit: opts.recruit, drift: opts.drift });
    return f;
  }

  every(fn: (dt: number, time: number) => void): void {
    this.updaters.push(fn);
  }

  /** Place the stage on the road at distance s, facing the oncoming train. */
  placeAt(s: number): void {
    this.s = s;
    const p = roadPoint(s);
    this.group.position.set(p.x, 0, p.z);
    this.group.rotation.y = roadYaw(s) + Math.PI;
    this.group.updateMatrixWorld(true);
    this.focus.copy(this.group.localToWorld(this.lookLocal.clone()));
    const c = this.group.localToWorld(new THREE.Vector3(this.lookLocal.x * 0.5, 0, this.lookLocal.z * 0.5));
    CLEARINGS[1].set(c.x, c.z, this.clearRadius, 1);
    this.clearing = CLEARINGS[1].clone();
    this.group.updateMatrixWorld(true);
    this.settle();
  }

  /** Drop every child onto the terrain. */
  settle(): void {
    const w = new THREE.Vector3();
    for (const child of this.group.children) {
      child.getWorldPosition(w);
      const y = terrainHeight(w.x, w.z);
      child.position.y = y;
    }
  }

  update(dt: number, time: number): void {
    for (const f of this.flames) f.update(time);
    for (const m of this.fogMats) m.uniforms.uTime.value = time;
    for (const sf of this.figures) {
      if (sf.drift) {
        sf.fig.root.position.z -= sf.drift * dt;
        sf.fig.speed = sf.drift;
        sf.fig.pose = "walk";
        sf.fig.targetYaw = Math.PI;
      }
      sf.fig.update(dt, time);
    }
    for (const fn of this.updaters) fn(dt, time);
  }

  worldPos(fig: Figure): THREE.Vector3 {
    return fig.root.getWorldPosition(new THREE.Vector3());
  }

  dispose(): void {
    this.group.removeFromParent();
    disposeTree(this.group);
    for (const c of CLEARINGS) if (this.clearing && c.equals(this.clearing)) c.w = 0;
  }

  /** Hand this stage's clearing to another slot (the town uses the camp slot until the first camp). */
  moveClearing(slot: number, radius: number): void {
    if (!this.clearing) return;
    CLEARINGS[slot].copy(this.clearing).setZ(radius);
    if (slot !== 1) CLEARINGS[1].w = 0;
    this.clearing = CLEARINGS[slot].clone();
  }
}

type Build = (st: Stage) => void;

const hollowRow = (st: Stage, n: number, x0: number, z0: number, dx: number, dz: number, look: StageLook = "hollowed", drift = 0) => {
  for (let i = 0; i < n; i++) st.fig(look, x0 + dx * i, z0 + dz * i, "stand", "hollow", { eyes: 0.8, drift });
};

const BUILDS: Record<string, Build> = {
  // --- strangers ----------------------------------------------------------
  "wounded-traveler": (st) => {
    st.look(-4, 0.9, 1);
    st.lantern(-2.8, 2.2);
    st.add(P.milestone(), -4.4, 0);
    st.fig("stranger", -4.1, 0.9, "sit", "stranger", { recruit: true, ry: 0.5 });
  },
  "mother-and-child": (st) => {
    st.look(0.4, 1.5);
    st.lantern(1.8, 0.4);
    st.fig("woman", 0.4, 1.5, "reach", "stranger", { recruit: true });
  },
  "lost-child": (st) => {
    st.look(0.6, 3, 1.1);
    st.fig("child", 0.6, 3, "stand", "stranger", { recruit: true });
  },
  "stranded-caravan": (st) => {
    st.look(-8, -2);
    st.add(P.stalledWagons(), -9, -12, 0.2);
    st.fig("stranger", -7.8, 5.5, "sit", "stranger", { recruit: true, ry: 0.6 });
  },
  "roadside-merchant": (st) => {
    st.look(5.5, 0.5);
    st.add(P.peddlerCart(), 6.5, -1, -0.3);
    st.fig("official", 4.6, 2, "stand");
  },
  "vigil-of-the-red": (st) => {
    st.look(-14, -7);
    st.lantern(-8.5, 2.5); st.lantern(-19, -3);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 7; c++) st.fig("starving", -12 - c * 2.2 + (r % 2) * 0.8, -6 - r * 2.4, "kneel", "vigil", { ry: 0.05 });
    st.fig("preacher", -8.5, 1, "reach", "preacher");
  },
  "road-toll": (st) => {
    st.look(0, 1);
    st.lantern(-4, 2);
    st.add(P.ropeAcross(9), 0, 0);
    st.fig("official", -2.4, 1.2, "stand", "stranger");
    const g = st.fig("raider", 2.6, 1.0, "stand", "guard");
    g.holdRifle(true);
    for (const x of [-16, 14, 18]) st.fig("raider", x, -8 - Math.abs(x) * 0.2, "hunch", "hidden");
  },
  "farm-hospitality": (st) => {
    st.look(-11, -3, 2);
    st.add(P.house({ lit: true, seed: 4 }), -15, -4, Math.PI / 2);
    st.add(P.bigBarn(false), -17, -18, Math.PI / 2);
    st.fig("woman", -10.5, -3, "stand", "stranger", { ry: 0.9 });
  },
  "signal-fire": (st) => {
    st.look(-38, -32, 2); st.clearRadius = 30;
    st.add(P.bonfire(), -40, -34);
    st.fig("stranger", -37.5, -32, "reach", "stranger", { recruit: true, ry: 0.6 });
  },
  "doctor-pinned": (st) => {
    st.look(-9, 0, 1);
    st.lantern(-6.8, 2.6);
    st.add(P.bigBarn(true), -11, -2, 0.3);
    st.fig("woman", -8.2, 1.2, "lie", "stranger", { recruit: true, ry: -1.2 });
  },
  "uniformed-men": (st) => {
    st.look(0, 1);
    st.lantern(-6.5, 2); st.lantern(6.5, 1.2);
    for (let i = 0; i < 6; i++) {
      const f = st.fig("official", -5 + i * 2, 0.5 + (i % 2) * 0.6, "stand", "soldier");
      if (i % 2 === 0) f.holdRifle(true);
    }
  },
  ferryman: (st) => {
    st.look(1, -3);
    st.add(P.barge(), 0, -6);
    st.fig("starving", 2.5, -3, "stand", "stranger");
    st.stopShort = 16;
  },
  "refugee-camp": (st) => {
    st.look(-9, -2);
    st.add(P.house({ ruined: true, w: 9, d: 12, seed: 6 }), -14, -6, Math.PI / 2);
    st.add(P.bonfire(), -9, -2);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      st.fig(i % 4 === 0 ? "child" : "starving", -9 + Math.cos(a) * 3, -2 + Math.sin(a) * 3, "sit", "refugee", { ry: -a - Math.PI / 2 });
    }
    st.fig("monk", -5.5, 1.5, "reach", "stranger", { recruit: true });
  },
  "map-seller": (st) => {
    st.look(-5, 1, 1.1);
    st.lantern(-3.6, 2.4);
    st.add(P.crates(3, 7), -5.5, 0.5);
    st.fig("stranger", -4.5, 1.2, "sit", "stranger");
  },
  "walker-beside": (st) => {
    st.look(-18, 8);
    st.fig("hollowed", -18, 8, "walk", "stranger", { recruit: true, eyes: 0 });
  },
  // --- hazards --------------------------------------------------------------
  "swollen-creek": (st) => {
    st.look(0, -1, 0.6);
    st.add(P.waterBand(9, 160), 0, -1);
    st.stopShort = 14;
  },
  "sinkhole-road": (st) => {
    st.look(0, -3, 0.6);
    st.add(P.sinkhole(), 0, -3);
    st.stopShort = 14;
  },
  "ash-squall": (st) => {
    st.add(P.fogBank(90, 70, new THREE.Color(0.22, 0.12, 0.11)), 0, 20);
    st.atTrain = true;
  },
  rockfall: (st) => {
    st.look(0, -1, 1.2);
    st.add(P.rockPile(11), 0, -1);
    st.stopShort = 14;
  },
  "rotted-trestle": (st) => {
    st.look(0, -2, 0.6);
    st.add(P.gorgeTrestle(), 0, -2);
    st.stopShort = 14;
  },
  "cold-night": (st) => {
    st.add(P.fogBank(80, 60, new THREE.Color(0.18, 0.24, 0.32)), 0, 22);
    st.atTrain = true;
  },
  "mud-road": (st) => {
    const mud = new THREE.Mesh(new THREE.PlaneGeometry(9, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x0c0806, roughness: 0.25 }));
    mud.position.set(0, 0.05, 24);
    st.group.add(mud);
    st.atTrain = true;
  },
  // --- finds ------------------------------------------------------------------
  "ruined-farmhouse": (st) => {
    st.look(-12, -3, 2);
    st.add(P.house({ lit: false, seed: 8 }), -14, -3, Math.PI / 2);
    st.add(P.bigBarn(true), -16, -17, Math.PI / 2);
  },
  "company-cache": (st) => {
    st.look(-6, 0, 0.8);
    st.lantern(-4.4, 1.4);
    st.add(P.hatch(), -6, 0);
  },
  "fresh-graves": (st) => {
    st.look(-8, -2, 0.8);
    st.lantern(-5.5, 1.5);
    st.add(P.graves(6), -8, -2, Math.PI / 2);
  },
  "red-orchard": (st) => {
    st.look(-16, -8, 2.5);
    st.add(P.orchard(), -18, -8);
  },
  "overturned-freight": (st) => {
    st.look(4.5, -1, 1);
    st.lantern(2.5, 1.5);
    st.add(P.overturnedWagon(), 4.5, -1, 0.4);
  },
  "roadside-shrine": (st) => {
    st.look(-5, 0.5, 1);
    st.lantern(-3.8, 1.6);
    st.add(P.cairn(), -5, 0.5);
  },
  "thin-deer": (st) => {
    st.look(-30, -10); st.clearRadius = 12;
    st.add(P.deerHerd(7), -34, -10);
  },
  // --- the Haze ---------------------------------------------------------------
  "red-tongue": (st) => {
    st.look(0, -4, 0.8);
    st.add(P.fogBank(80, 22), 0, -4);
    st.stopShort = 12;
  },
  "voices-in-the-fog": (st) => {
    st.look(-18, -4);
    st.add(P.fogBank(40, 30), -22, -4);
    st.add(P.fogBank(40, 30), 24, 6);
    st.fig("hollowed", -24, -6, "stand", "shade", { eyes: 0.5 });
  },
  "hollowed-procession": (st) => {
    st.look(-30, 6, 2);
    hollowRow(st, 14, -34, 30, -0.3, -3.2, "hollowed", 0.9);
  },
  "telegraph-hum": (st) => {
    st.look(9.5, -10, 4);
    st.add(P.telegraph(5), 9.5, -30);
  },
  // --- the witch --------------------------------------------------------------
  "witch-fog-lure": (st) => {
    st.look(-16, -6);
    st.add(P.fogBank(40, 26), -20, -6);
    st.fig("witch", -20, -8, "reach", "stranger", { ry: 0.4 });
  },
  "witch-takes": (st) => {
    st.look(-14, -6, 1);
    st.add(P.fogBank(60, 30), -20, -4);
    st.add(P.fogBank(40, 30), 18, 6);
    st.fig("witch", -18, -6, "reach", "stranger", { ry: 0.5 });
    st.fig("hollowed", -21, -8, "stand", "shade", { eyes: 0.4, drift: 0.3 });
  },
  "witch-bargain": (st) => {
    st.look(-18, -6);
    st.add(P.fogBank(70, 30), -22, -6);
    st.fig("witch", -24, -8, "stand", "stranger", { ry: 0.4 });
  },
  "witch-door": (st) => {
    st.look(-14, -8, 1);
    st.add(P.fogBank(60, 24), -18, -6);
    st.add(P.house({ lit: true, seed: 31 }), -20, -12, Math.PI / 2);
    st.fig("witch", -15, -8, "reach", "stranger", { ry: 0.4 });
  },
  // --- oddities ---------------------------------------------------------------
  "empty-town": (st) => {
    st.look(0, -10, 2);
    st.add(P.house({ lit: true, seed: 11 }), -13, -2, Math.PI / 2);
    st.add(P.house({ lit: true, seed: 12 }), 13, -8, -Math.PI / 2);
    st.add(P.house({ lit: true, seed: 13 }), -13, -18, Math.PI / 2);
    st.add(P.house({ lit: true, seed: 14 }), 13, -24, -Math.PI / 2);
  },
  "mirror-wagon": (st) => {
    st.look(0, -2, 1.5);
    const w = new Wagon();
    for (const f of w.torches) f.lit = false;
    w.root.position.set(0, 0, -2);
    w.root.rotation.y = Math.PI;
    st.group.add(w.root);
    st.every((dt, time) => w.update(dt, time, 0));
  },
  // --- landmarks --------------------------------------------------------------
  "ninefold-crossing": (st) => {
    st.look(0, -8, 1.5);
    st.add(P.bridge(true), 0, -8);
    st.stopShort = 18;
  },
  "glass-fork": (st) => {
    st.look(4, 1, 2.5);
    st.lantern(3.2, 2.5);
    st.add(P.signpost(["OLD RAIL LINE", "PILGRIM ROAD"]), 5, 2, 0.3);
    const rail = st.add(P.railLine(160), -20, -60, -0.4);
    void rail;
  },
  "saint-ambrose": (st) => {
    st.look(-13, -4, 4);
    st.add(P.mission(), -18, -4, Math.PI / 2);
    st.fig("monk", -9.5, 0, "stand", "stranger", { ry: 0.8 });
    st.every((_dt, time) => {
      const bell = st.group.getObjectByName("bell");
      if (bell) bell.rotation.z = Math.sin(time * 1.6) * 0.35;
    });
  },
  "toll-gate": (st) => {
    st.look(0, 1, 1.5);
    st.add(P.tollGate(), 0, 0);
    for (let i = 0; i < 8; i++) {
      const f = st.fig(i % 3 ? "thug" : "raider", -7 + i * 2, 2.5 + (i % 2), "stand", "tollman");
      if (i % 3 === 0) f.holdRifle(true);
    }
  },
  "the-gate": (st) => {
    st.look(0, -18, 10); st.clearRadius = 40;
    st.add(P.gateWall(), 0, -18);
    st.fig("official", 0, -12, "stand", "keeper");
    st.stopShort = 16;
  },
};

/** Scenes that happen at the wagons: the train itself is the stage. */
const AT_TRAIN = new Set(["axle-break", "spoiled-stores", "fever", "oxen-balk", "headcount", "campfire-song", "shared-supper", "square-of-blue", "sky-bleeds", "last-stand"]);

export function buildStage(id: string): Stage {
  const st = new Stage();
  st.id = id;
  const b = BUILDS[id];
  if (b) b(st);
  if (!b || AT_TRAIN.has(id)) st.atTrain = true;
  return st;
}

/** Landmark arrivals that are places to stop rather than events. */
export function buildArrival(id: string): Stage | null {
  const st = new Stage();
  switch (id) {
    case "meridian-wayhouse":
      st.look(-10, -2, 2.5);
      st.add(P.emporium("MERIDIAN WAYHOUSE"), -15, -2, Math.PI / 2);
      for (const z of [-8, 4]) st.add(P.lanternPost(), -6, z, Math.PI / 2);
      st.fig("official", -9, -1.5, "stand", "keeper", { ry: 1.2 });
      return st;
    case "last-lamp":
      st.look(10, -2, 2.5);
      st.add(P.emporium("LAST LAMP"), 15, -2, -Math.PI / 2);
      for (let i = 0; i < 7; i++) st.add(P.lanternPost(), i % 2 ? 6 : -6, 8 - i * 6, i % 2 ? -Math.PI / 2 : Math.PI / 2);
      st.fig("woman", 9, -1.5, "stand", "keeper", { ry: -1.2 });
      return st;
    case "ninefold-bridge":
    case "glass-fork":
    case "saint-ambrose":
    case "spine-toll":
    case "the-gate": {
      const map: Record<string, string> = { "ninefold-bridge": "ninefold-crossing", "spine-toll": "toll-gate" };
      return buildStage(map[id] ?? id);
    }
    default:
      return null;
  }
}

/** Cinder Ford, the last town: the Emporium, a few houses, a bonfire for the muster. */
export function buildTown(): Stage {
  const st = new Stage();
  st.add(P.emporium("CINDER FORD EMPORIUM"), 14, 6, -Math.PI / 2);
  st.add(P.house({ lit: true, seed: 21 }), -14, 4, Math.PI / 2);
  st.add(P.house({ lit: true, seed: 22 }), -15, 16, Math.PI / 2);
  st.add(P.house({ lit: false, seed: 23 }), 15, 22, -Math.PI / 2);
  st.add(P.house({ lit: true, seed: 24 }), -14, -10, Math.PI / 2);
  st.add(P.house({ lit: true, w: 5, seed: 25 }), 14, -12, -Math.PI / 2);
  st.add(P.bonfire(), 0, -26);
  for (const [x, z] of [
    [6, 0],
    [-6, 0],
    [6, 16],
    [-6, 26],
  ]) st.add(P.lanternPost(), x, z, x > 0 ? -Math.PI / 2 : Math.PI / 2);
  st.stopShort = 0;
  return st;
}

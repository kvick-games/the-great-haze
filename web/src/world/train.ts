// The wagon train: wagons, oxen, and the party, laid out either in a line on
// the road or in a ring around a campfire, with a blend between the two so
// making and breaking camp are animated rather than cut.

import * as THREE from "three";
import type { Hud, MemberView } from "../../../src/game/types.ts";
import { Figure, wrapAngle } from "./actors.ts";
import type { Pose } from "./actors.ts";
import { LOAD_SLOTS, Ox, Wagon } from "./wagon.ts";
import { Pops } from "./pops.ts";
import { Flame, LightPool, Embers } from "./fx.ts";
import { lookFor, lookForSim } from "./looks.ts";
import { disposeTree } from "./dispose.ts";
import { CLEARINGS, roadX, terrainHeight } from "./regions.ts";
import { clamp01, damp, smoothstep } from "./noise.ts";

export const WAGON_GAP = 9.5;
const CAMP_RADIUS = 8.5;
const TORCH_RING = 14;
export const CAMP_CLEAR = 24;

export interface MemberActor {
  id: string;
  fig: Figure;
  view: MemberView;
  /** Explicit staging from the director; overrides the formation. */
  stage: { x: number; z: number; yaw?: number; pose?: Pose; face?: THREE.Vector3 } | null;
  leaving: { x: number; z: number; t: number } | null;
  /** The wagon this person is lying in, if any. */
  hosted: Wagon | null;
}

export function roadPoint(s: number): THREE.Vector3 {
  const z = -s;
  return new THREE.Vector3(roadX(z), 0, z);
}

/** Unit vector pointing to the right of the direction of travel at road distance s. */
export function roadRight(s: number): THREE.Vector3 {
  const yaw = roadYaw(s);
  return new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
}

/** Yaw that faces the direction of travel (toward -z) at road distance s. */
export function roadYaw(s: number): number {
  const a = roadPoint(s - 0.5);
  const b = roadPoint(s + 0.5);
  return Math.atan2(b.x - a.x, b.z - a.z);
}

export class Train {
  group = new THREE.Group();
  wagons: Wagon[] = [];
  oxen: Ox[][] = [];
  members = new Map<string, MemberActor>();
  /** Visual distance along the road of the lead wagon, in world units. */
  d = 0;
  speed = 0;
  /** 0 = in a line on the road, 1 = ringed up in camp. */
  camp = 0;
  campTarget = 0;
  campCenter = new THREE.Vector3();
  campS = 0;
  fire: Flame;
  private fireLogs: THREE.Group;
  ringTorches: Flame[] = [];
  private ringPosts: THREE.Group[] = [];
  ringLit = 0;
  torchesLit = true;
  lanterns = 0;
  private pool: LightPool;
  private embers: Embers;
  private wagonCount = 3;
  get wagonN(): number {
    return this.wagonCount;
  }
  condition = 1;
  leaderId = "";
  /** True while the camp owns clearing slot 0 (the town borrows it before the first camp). */
  private ownsClearing = false;
  private rollTween: { from: number; to: number; t: number; dur: number; cruise: boolean; resolve: () => void } | null = null;
  /** Losses and spills that stay on the road behind the wagons. */
  pops = new Pops();
  private snapMembers = false;
  /** 0..1 how hard the animals are working. */
  strain = 0.3;

  constructor(pool: LightPool, embers: Embers) {
    this.pool = pool;
    this.embers = embers;
    this.group.add(this.pops.group);
    for (let i = 0; i < 4; i++) {
      const w = new Wagon();
      this.wagons.push(w);
      this.group.add(w.root);
      for (const f of w.torches) pool.add(f);
      const pair = [new Ox(), new Ox()];
      this.oxen.push(pair);
      for (const o of pair) this.group.add(o.root);
    }
    this.fire = new Flame(1.6, 2.4);
    this.fireLogs = new THREE.Group();
    const logMat = new THREE.MeshStandardMaterial({ color: 0x1a0f08, roughness: 1, flatShading: true, emissive: new THREE.Color(0.25, 0.06, 0.01) });
    for (let i = 0; i < 5; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.4, 5), logMat);
      log.rotation.z = Math.PI / 2 - 0.35;
      log.rotation.y = (i / 5) * Math.PI * 2;
      log.position.y = 0.22;
      this.fireLogs.add(log);
    }
    const stones = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.16, 4, 10).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2a2826, flatShading: true }));
    stones.position.y = 0.1;
    this.fireLogs.add(stones);
    this.fireLogs.add(this.fire.group);
    this.fire.group.position.y = 0.25;
    this.group.add(this.fireLogs);
    pool.add(this.fire);
    embers.emitter(this.fire.group, 14, 0.6);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x1c130c, flatShading: true });
    for (let i = 0; i < 8; i++) {
      const post = new THREE.Group();
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 2.2, 5), postMat);
      stick.position.y = 1.1;
      post.add(stick);
      const f = new Flame(0.6, 0.9);
      f.group.position.y = 2.25;
      post.add(f.group);
      pool.add(f);
      this.ringTorches.push(f);
      this.ringPosts.push(post);
      this.group.add(post);
    }
  }

  /** A wagon the road has taken: it sags, slews to the verge and is left behind. */
  private abandoned: { i: number; s: number; pos: THREE.Vector3; yaw: number; t: number } | null = null;

  /** The wagon at this index breaks down where it is. Call before the sim's wagon count is applied. */
  leaveWagon(i: number): void {
    if (i < 0 || i >= this.wagons.length) return;
    const rp = this.wagonRoadPose(i);
    this.abandoned = { i, s: rp.s, pos: rp.pos.clone(), yaw: rp.yaw, t: 0 };
  }

  setWagons(n: number, condition: number): void {
    this.wagonCount = Math.max(1, Math.min(4, n));
    this.condition = condition;
  }

  /** Read the caravan's state off the sim: wagons, wear, supplies, and how hard the oxen work. */
  applyHud(hud: Hud): void {
    this.setWagons(hud.wagons, hud.condition / 100);
    const n = this.wagonCount;
    const r = hud.res;
    const total = (res: number, ref: number, slots: number) => (res <= 0 ? 0 : Math.min(slots * n, Math.max(1, Math.ceil((res / ref) * slots * n))));
    const want = {
      sacks: total(r.rations, 110, LOAD_SLOTS.sacks),
      barrels: total(r.ammo, 40, LOAD_SLOTS.barrels),
      crates: total(r.medicine, 8, LOAD_SLOTS.crates),
      sticks: total(r.torches, 28, LOAD_SLOTS.sticks),
      wheels: total(r.spares, 5, LOAD_SLOTS.wheels),
    };
    this.wagons.forEach((w, i) => {
      const share = (t: number) => Math.floor((t + n - 1 - i) / n);
      w.setLoad({ sacks: share(want.sacks), barrels: share(want.barrels), crates: share(want.crates), sticks: share(want.sticks), wheels: share(want.wheels) });
    });
    const pace = hud.pace === "hard" ? 0.75 : hud.pace === "steady" ? 0.4 : hud.pace === "easy" ? 0.18 : 0.1;
    this.strain = Math.min(1, pace + (1 - hud.condition / 100) * 0.55 + (n < 3 ? 0.15 : 0));
    const hungry = (hud.rations === "bare" ? 0.7 : hud.rations === "meager" ? 0.35 : 0) + (r.rations < hud.party.length * 2 ? 0.3 : 0);
    for (const pair of this.oxen) {
      for (const o of pair) {
        o.strain = this.strain;
        o.thin = Math.min(1, hungry);
      }
    }
  }

  /** Bring the party figures in line with the sim's living members. */
  syncMembers(views: MemberView[], spawnAt?: THREE.Vector3 | ((id: string) => THREE.Vector3 | undefined)): { added: string[]; removed: string[] } {
    const added: string[] = [];
    const removed: string[] = [];
    const ids = new Set(views.map((v) => v.id));
    for (const v of views) {
      let a = this.members.get(v.id);
      if (!a) {
        const fig = new Figure(v.look && !v.isLeader ? lookForSim(v.look, v.id) : lookFor(v.id, v.role, v.isLeader, v.traits));
        a = { id: v.id, fig, view: v, stage: null, leaving: null, hosted: null };
        this.members.set(v.id, a);
        this.group.add(fig.root);
        if (v.isLeader) {
          this.leaderId = v.id;
          const torch = new Flame(0.5, 1.2);
          fig.holdTorch(torch);
          this.pool.add(torch);
        }
        const at = typeof spawnAt === "function" ? spawnAt(v.id) : spawnAt;
        if (at) fig.root.position.copy(at);
        else fig.root.position.copy(this.formation(a, this.members.size - 1).pos);
        added.push(v.id);
      }
      a.view = v;
      const dying = v.conditions.includes("dying");
      a.fig.setRing(dying ? "dying" : "none");
      const fog = v.conditions.find((c) => c.startsWith("fogsick") || c === "turning");
      a.fig.eyeGlow = !fog ? 0 : fog === "fogsick I" ? 0.15 : fog === "fogsick II" ? 0.6 : 1;
      a.fig.setCondition({
        health: v.health,
        nerve: v.nerve,
        wounded: v.conditions.includes("wounded"),
        sick: v.conditions.includes("sick"),
        fog: !fog ? 0 : fog === "fogsick I" ? 1 : fog === "fogsick II" ? 2 : 3,
        dying,
      });
    }
    for (const [id, a] of this.members) {
      if (!ids.has(id) && !a.leaving) removed.push(id);
    }
    return { added, removed };
  }

  /** Remove a figure; with `walkTo` they walk off and fade first. */
  dismiss(id: string, walkTo?: THREE.Vector3, dead = false): void {
    const a = this.members.get(id);
    if (!a) return;
    this.unhost(a);
    if (dead) {
      a.stage = { x: a.fig.position.x, z: a.fig.position.z, pose: "lie" };
      a.leaving = { x: a.fig.position.x, z: a.fig.position.z, t: -3 };
    } else if (walkTo) {
      a.stage = { x: walkTo.x, z: walkTo.z, pose: "walk" };
      a.leaving = { x: walkTo.x, z: walkTo.z, t: 0 };
    } else {
      this.group.remove(a.fig.root);
      if (a.fig.torch) this.pool.remove(a.fig.torch);
      disposeTree(a.fig.root);
      this.members.delete(id);
    }
  }

  /** Roll to road distance `to`. `cruise` holds a steady pace between a slow start and stop (tracking shots). */
  roll(to: number, duration: number, cruise = false): Promise<void> {
    if (this.rollTween) this.rollTween.resolve();
    return new Promise((resolve) => {
      if (duration <= 0 || Math.abs(to - this.d) < 0.01) {
        this.d = to;
        resolve();
        return;
      }
      this.rollTween = { from: this.d, to, t: 0, dur: duration, cruise, resolve };
    });
  }

  /** Jump the whole train along the road without disturbing a roll in progress (a cut hides it). */
  warp(delta: number): void {
    this.d += delta;
    if (this.rollTween) {
      this.rollTween.from += delta;
      this.rollTween.to += delta;
    }
    this.snapMembers = true;
    this.pops.clear();
  }

  /** Put a lying person back on the ground where their wagon is. */
  private unhost(a: MemberActor): void {
    if (!a.hosted) return;
    const p = a.fig.root.getWorldPosition(new THREE.Vector3());
    a.hosted.cot.remove(a.fig.root);
    this.group.add(a.fig.root);
    a.fig.root.position.copy(p);
    a.hosted = null;
  }

  get rolling(): boolean {
    return this.rollTween !== null;
  }

  /** Pitch camp at the train's current position. */
  pitchCamp(): void {
    this.campS = this.d - WAGON_GAP;
    const p = roadPoint(this.campS);
    this.campCenter.set(p.x + 1.5, 0, p.z);
    CLEARINGS[0].set(this.campCenter.x, this.campCenter.z, CAMP_CLEAR, 1);
    this.ownsClearing = true;
    this.campTarget = 1;
    for (const a of this.members.values()) a.stage = null;
  }

  clearStaging(): void {
    for (const a of this.members.values()) if (!a.leaving) a.stage = null;
  }

  /** Forget the camp's claim on clearing slot 0 without touching it (a new scene is taking over). */
  releaseClearing(): void {
    this.ownsClearing = false;
  }

  breakCamp(): void {
    this.campTarget = 0;
    for (const a of this.members.values()) a.stage = null;
  }

  private wagonRoadPose(i: number): { pos: THREE.Vector3; yaw: number; s: number } {
    const s = this.d - i * WAGON_GAP;
    const pos = roadPoint(s);
    return { pos, yaw: roadYaw(s), s };
  }

  private wagonCampPose(i: number, n: number): { pos: THREE.Vector3; yaw: number } {
    const a = (i / n) * Math.PI * 2 + 0.6;
    const pos = new THREE.Vector3(this.campCenter.x + Math.cos(a) * CAMP_RADIUS, 0, this.campCenter.z + Math.sin(a) * CAMP_RADIUS);
    // Wagons ring up nose to tail, tangent to the circle.
    const yaw = Math.atan2(-Math.sin(a), Math.cos(a));
    return { pos, yaw };
  }

  /** Where member index k stands in the current formation. */
  formation(a: MemberActor, k: number): { pos: THREE.Vector3; yaw: number; pose: Pose } {
    const v = a.view;
    const road = (() => {
      if (v.isLeader) {
        const s = this.d + 8.5;
        const p = roadPoint(s);
        const yaw = roadYaw(s);
        p.x += Math.cos(yaw) * -1.3;
        p.z += -Math.sin(yaw) * -1.3;
        return { pos: p, yaw, pose: "walk" as Pose };
      }
      // Everyone walks on the right-hand side, the one a side-on camera sees: the strong
      // ahead, the hurt falling back along the line, the scout out in front, the hunter last.
      const slot = k - 1;
      const wi = Math.min(this.wagonCount - 1, Math.floor(slot / 2));
      const lane = 2.1 + (slot % 2) * 0.75 + Math.floor(slot / (this.wagonCount * 2)) * 0.9;
      let s = this.d - wi * WAGON_GAP + 1.4 - (slot % 2) * 3.4 - Math.floor(slot / (this.wagonCount * 2)) * 2.5;
      let off = lane;
      if (v.role === "scout" && v.health > 40) {
        s = this.d + 11.5 + (slot % 3) * 2.2;
        off = 3.6;
      } else if (v.role === "hunter" && v.health > 40) {
        s = this.d - (this.wagonCount - 1) * WAGON_GAP - 3.2;
        off = 2.6;
      }
      const weak = Math.max(0, (70 - v.health) / 70);
      s -= weak * 5 + (v.conditions.includes("sick") ? 1.5 : 0);
      const p = roadPoint(s);
      const yaw = roadYaw(s);
      p.x += Math.cos(yaw) * -off;
      p.z += -Math.sin(yaw) * -off;
      return { pos: p, yaw, pose: "walk" as Pose };
    })();
    if (this.camp < 0.02) return road;
    const n = Math.max(1, this.members.size);
    const ang = (k / n) * Math.PI * 2 + 0.3;
    const dying = v.conditions.includes("dying");
    const r = dying ? 2.2 : 3.1;
    const pos = new THREE.Vector3(this.campCenter.x + Math.cos(ang) * r, 0, this.campCenter.z + Math.sin(ang) * r);
    const yaw = Math.atan2(this.campCenter.x - pos.x, this.campCenter.z - pos.z);
    const pose: Pose = dying ? "lie" : v.isLeader ? "stand" : "sit";
    return this.camp > 0.5 ? { pos, yaw, pose } : road;
  }

  update(dt: number, time: number): void {
    // Rolling along the road.
    if (this.rollTween) {
      const tw = this.rollTween;
      tw.t += dt;
      const u = clamp01(tw.t / tw.dur);
      let e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      if (tw.cruise) {
        // Trapezoid: ease in over the first tenth, steady, ease out over the last tenth.
        const a = 0.1;
        const vmax = 1 / (1 - a);
        e = u < a ? (vmax * u * u) / (2 * a) : u > 1 - a ? 1 - (vmax * (1 - u) * (1 - u)) / (2 * a) : vmax * (a / 2 + (u - a));
      }
      const prev = this.d;
      this.d = tw.from + (tw.to - tw.from) * e;
      this.speed = dt > 0 ? (this.d - prev) / dt : 0;
      if (u >= 1) {
        this.rollTween = null;
        this.speed = 0;
        tw.resolve();
      }
    } else {
      this.speed = damp(this.speed, 0, 6, dt);
    }
    const moving = clamp01(Math.abs(this.speed) / 3);
    this.camp = damp(this.camp, this.campTarget, 1.4, dt);
    if (Math.abs(this.camp - this.campTarget) < 0.002) this.camp = this.campTarget;
    if (this.camp === 0 && this.campTarget === 0 && this.ownsClearing) {
      CLEARINGS[0].w = 0;
      this.ownsClearing = false;
    }
    const blend = smoothstep(0, 1, this.camp);
    this.pops.update(dt);
    // Who lies in which wagon: the dying ride at the tail of the train, last wagon first.
    const hostIdx = new Map<string, number>();
    let hk = 0;
    for (const m of this.members.values()) {
      if (m.view.conditions.includes("dying")) hostIdx.set(m.id, Math.max(0, this.wagonCount - 1 - hk++));
    }
    this.wagons.forEach((w, i) => {
      let has = false;
      for (const [id, wi] of hostIdx) if (wi === i && !this.members.get(id)?.stage && this.camp < 0.5) has = true;
      w.hosting = has ? 1 : 0;
    });

    // Wagons and oxen.
    for (let i = 0; i < this.wagons.length; i++) {
      const w = this.wagons[i];
      const on = i < this.wagonCount;
      const gone = !on && this.abandoned !== null && this.abandoned.i === i && this.d - this.abandoned.s < 140 && this.d >= this.abandoned.s - 1;
      w.root.visible = on || gone;
      for (const o of this.oxen[i]) o.root.visible = on;
      for (const f of w.torches) f.lit = on && this.torchesLit && this.camp < 0.9;
      if (gone && this.abandoned) {
        // Breaks down and is left at the roadside while the train plods on.
        const a = this.abandoned;
        a.t += dt;
        const k = smoothstep(0, 1, Math.min(1, a.t / 2.2));
        const side = 3.4 * k;
        const p = new THREE.Vector3(a.pos.x + Math.cos(a.yaw) * side, 0, a.pos.z - Math.sin(a.yaw) * side);
        p.y = terrainHeight(p.x, p.z);
        w.root.position.copy(p);
        w.root.rotation.y = a.yaw + 0.45 * k;
        w.root.rotation.z = -0.13 * k;
        w.condition = 0.05;
        w.update(dt, time, 0);
        continue;
      }
      if (!on) {
        w.root.rotation.z = 0;
        continue;
      }
      w.root.rotation.z = 0;
      const rp = this.wagonRoadPose(i);
      let pos = rp.pos;
      let yaw = rp.yaw;
      if (blend > 0) {
        const cp = this.wagonCampPose(i, this.wagonCount);
        pos = rp.pos.clone().lerp(cp.pos, blend);
        yaw = rp.yaw + wrapAngle(cp.yaw - rp.yaw) * blend;
      }
      pos.y = terrainHeight(pos.x, pos.z);
      w.root.position.copy(pos);
      w.root.rotation.y = yaw;
      w.condition = this.condition;
      w.lantern = this.lanterns;
      w.roll(rp.s);
      w.update(dt, time, moving);
      // Oxen yoked ahead on the road, unhitched and standing outside the ring in camp.
      this.oxen[i].forEach((o, k) => {
        const side = k === 0 ? -0.62 : 0.62;
        const fwd = 5.6;
        const road = new THREE.Vector3(pos.x + Math.sin(yaw) * fwd + Math.cos(yaw) * side, 0, pos.z + Math.cos(yaw) * fwd - Math.sin(yaw) * side);
        let op = road;
        let oy = yaw;
        if (blend > 0) {
          const a = (i / this.wagonCount) * Math.PI * 2 + 0.6 + (k ? 0.18 : -0.18);
          const cp = new THREE.Vector3(this.campCenter.x + Math.cos(a) * (CAMP_RADIUS + 4.5), 0, this.campCenter.z + Math.sin(a) * (CAMP_RADIUS + 4.5));
          op = road.clone().lerp(cp, blend);
          oy = yaw + wrapAngle(a + Math.PI / 2 - yaw) * blend;
        }
        op.y = terrainHeight(op.x, op.z);
        o.root.position.copy(op);
        o.root.rotation.y = oy;
        o.update(dt, time, moving + (blend > 0.05 && blend < 0.95 ? 0.5 : 0));
      });
    }

    // Campfire and the ring of torches.
    const campVis = this.camp > 0.05;
    this.fireLogs.visible = campVis;
    this.fire.lit = campVis;
    this.fire.intensity = clamp01((this.camp - 0.3) / 0.5);
    this.fireLogs.position.set(this.campCenter.x, terrainHeight(this.campCenter.x, this.campCenter.z), this.campCenter.z);
    this.fire.update(time);
    this.ringPosts.forEach((post, i) => {
      const a = (i / this.ringPosts.length) * Math.PI * 2;
      const x = this.campCenter.x + Math.cos(a) * TORCH_RING;
      const z = this.campCenter.z + Math.sin(a) * TORCH_RING;
      post.position.set(x, terrainHeight(x, z), z);
      post.visible = this.camp > 0.6 && this.ringLit > 0;
      const f = this.ringTorches[i];
      f.lit = post.visible && i < Math.round(this.ringLit * this.ringPosts.length);
      f.intensity = clamp01((this.camp - 0.6) / 0.3);
      f.update(time);
    });

    // People.
    let k = 0;
    const order = [...this.members.values()].sort((a, b) => (a.view.isLeader ? -1 : b.view.isLeader ? 1 : 0));
    for (const a of order) {
      const fig = a.fig;
      const form = this.formation(a, k++);
      let target = form.pos;
      let yaw = form.yaw;
      let pose = form.pose;
      if (a.stage) {
        target = new THREE.Vector3(a.stage.x, 0, a.stage.z);
        pose = a.stage.pose ?? "stand";
        if (a.stage.face) yaw = Math.atan2(a.stage.face.x - target.x, a.stage.face.z - target.z);
        else if (a.stage.yaw !== undefined) yaw = a.stage.yaw;
      }
      if (a.view.conditions.includes("dying") && this.camp < 0.5 && !a.stage && !a.leaving) {
        // The dying ride on a cot at the tail of a wagon, under an opened canvas.
        const wag = this.wagons[Math.min(this.wagons.length - 1, hostIdx.get(a.id) ?? 0)];
        if (a.hosted !== wag) {
          if (a.hosted) a.hosted.cot.remove(fig.root);
          else this.group.remove(fig.root);
          wag.cot.add(fig.root);
          fig.root.position.set(0, 0, 0);
          fig.yaw = fig.targetYaw = 0;
          a.hosted = wag;
        }
        fig.root.visible = wag.root.visible;
        fig.pose = "lie";
        fig.speed = 0;
        fig.targetYaw = 0;
        fig.update(dt, time);
        continue;
      }
      if (a.hosted) this.unhost(a);
      fig.root.visible = true;
      const cur = fig.root.position;
      const dx = target.x - cur.x;
      const dz = target.z - cur.z;
      const dist = Math.hypot(dx, dz);
      const inFormation = !a.stage && this.camp < 0.02 && this.rolling;
      if (dist > 60 || (this.snapMembers && !a.stage)) {
        cur.set(target.x, 0, target.z);
      } else if (inFormation) {
        // Keep pace with the wagons exactly while on the move.
        cur.x += dx * (1 - Math.exp(-6 * dt));
        cur.z += dz * (1 - Math.exp(-6 * dt));
        fig.speed = Math.abs(this.speed);
        fig.pose = "walk";
        fig.targetYaw = yaw;
      } else if (dist > 0.15) {
        const step = Math.min(dist, (a.leaving ? 1.6 : 3.2) * dt);
        cur.x += (dx / dist) * step;
        cur.z += (dz / dist) * step;
        fig.speed = a.leaving ? 1.6 : 3.2;
        fig.pose = pose === "lie" && a.leaving ? "lie" : "walk";
        fig.targetYaw = Math.atan2(dx, dz);
      } else {
        fig.speed = 0;
        fig.pose = pose === "walk" ? "stand" : pose;
        fig.targetYaw = yaw;
      }
      cur.y = terrainHeight(cur.x, cur.z);
      fig.update(dt, time);
      if (a.leaving) {
        a.leaving.t += dt;
        if (a.leaving.t > 0) fig.setFade(clamp01(1 - a.leaving.t / 2.5));
        if (a.leaving.t > 2.5) {
          this.group.remove(fig.root);
          if (fig.torch) this.pool.remove(fig.torch);
          disposeTree(fig.root);
          this.members.delete(a.id);
        }
      }
      if (fig.torch) fig.torch.update(time);
    }
    this.snapMembers = false;
    void this.embers;
  }

  /** Middle of the train, for cameras. */
  center(): THREE.Vector3 {
    if (this.camp > 0.5) return this.campCenter.clone().setY(1.2);
    const p = roadPoint(this.d - WAGON_GAP * (this.wagonCount - 1) * 0.5);
    p.y = 1.4;
    return p;
  }

  front(): THREE.Vector3 {
    return roadPoint(this.d + 6);
  }

  rear(): THREE.Vector3 {
    return roadPoint(this.d - WAGON_GAP * (this.wagonCount - 1) - 3);
  }

  figure(id: string): Figure | undefined {
    return this.members.get(id)?.fig;
  }
}

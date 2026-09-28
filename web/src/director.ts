// The director turns each decision into something you watch. The sim resolves
// a choice instantly; the director compares the state before and after and
// plays the difference in 3D (the road, the camp, the stranger walking over,
// the grave left behind) before the next card appears.

import * as THREE from "three";
import { Game } from "../../src/game/game.ts";
import type { NewGameOptions } from "../../src/game/game.ts";
import type { Hud, Pending, ResourceId, Screen, SceneInstance } from "../../src/game/types.ts";
import { ROSTER } from "../../src/game/content/roster.ts";
import { sceneById } from "../../src/game/content/scenes/index.ts";
import { ENEMIES } from "../../src/game/content/enemies.ts";
import { PACES, TUNING } from "../../src/game/tuning.ts";
import { regionAt } from "../../src/game/world.ts";
import type { World } from "./world/world.ts";
import type { ShotFn } from "./world/camera.ts";
import { Figure } from "./world/actors.ts";
import { lookFor } from "./world/looks.ts";
import { CLEARINGS, U, terrainHeight } from "./world/regions.ts";
import { WAGON_GAP, roadPoint, roadRight } from "./world/train.ts";
import { clamp01, lerp, smoothstep } from "./world/noise.ts";
import { disposeTree } from "./world/dispose.ts";
import { Stage, buildArrival, buildStage, buildTown } from "./scenes/vignettes.ts";
import { cross } from "./scenes/pieces.ts";
import { CombatStage } from "./scenes/combat.ts";
import type { UI } from "./ui/ui.ts";
import type { Audio } from "./audio.ts";

const SAVE_KEY = "great-haze:3d:v1";
/** `#fast` runs cinematics at high speed (automated tests, impatient players). */
const FAST = typeof location !== "undefined" && /fast/.test(location.hash + location.search);

interface MemberSnap {
  alive: boolean;
  health: number;
  fate?: string;
}

interface Snap {
  members: Map<string, MemberSnap>;
  wagons: number;
  condition: number;
  miles: number;
  gap: number;
  res: Record<ResourceId, number>;
  scrip: number;
  combatHp: number;
  combatMax: number;
  queueCombat: boolean;
}

const LANDMARK_SCENES = new Set(["ninefold-crossing", "glass-fork", "saint-ambrose", "toll-gate", "the-gate"]);

function lift(v: THREE.Vector3, above: number): THREE.Vector3 {
  v.y = Math.max(v.y, terrainHeight(v.x, v.z) + above);
  return v;
}

export class Director {
  world: World;
  ui: UI;
  audio: Audio;
  game: Game | null = null;
  screen: Screen | null = null;
  private stage: Stage | null = null;
  private oldStages: Stage[] = [];
  private town: Stage | null = null;
  private combat: CombatStage | null = null;
  private candidates = new Map<string, Figure>();
  /** Muster candidates who stayed behind: scenery now, not clickable. */
  private bystanders: Figure[] = [];
  private markers: THREE.Object3D[] = [];
  private baseShot: ShotFn | null = null;
  private focused: string | null = null;
  busy = false;
  private campAngle = 0.8;

  constructor(world: World, ui: UI, audio: Audio) {
    this.world = world;
    this.ui = ui;
    this.audio = audio;
    world.onTick((dt) => this.tick(dt));
  }

  // ------------------------------------------------------------------ loop

  private tick(dt: number): void {
    const w = this.world;
    const t = w.time;
    this.stage?.update(dt, t);
    for (const s of this.oldStages) s.update(dt, t);
    this.town?.update(dt, t);
    this.combat?.update(dt, t);
    for (const f of this.candidates.values()) f.update(dt, t);
    for (const f of this.bystanders) f.update(dt, t);
    // Old stages are dropped once they are far behind the wagons.
    this.oldStages = this.oldStages.filter((s) => {
      if (w.train.d - s.s > 260) {
        this.drop(s);
        return false;
      }
      return true;
    });
    const tr = w.train;
    if (this.town && tr.d > 600) {
      this.drop(this.town);
      this.town = null;
      this.clearTownsfolk();
    }
    tr.lanterns = w.mood.night > 0.6 ? 1 : 0.35;
    const moving = Math.min(1, Math.abs(tr.speed) / 4);
    this.audio.update({ haze: w.mood.haze, night: w.mood.night, camp: tr.camp, moving }, dt);
  }

  // ------------------------------------------------------------------ shots

  private shot(fn: ShotFn, rate = 1.5, cut = false): void {
    this.baseShot = fn;
    this.focused = null;
    this.world.rig.set(fn, rate, cut);
  }

  private shotRoadFront(): ShotFn {
    return (t) => {
      const tr = this.world.train;
      const f = roadPoint(tr.d + 16);
      const sway = Math.sin(t * 0.12) * 1.6;
      return { pos: lift(f.add(new THREE.Vector3(-4.5 + sway, 2.3, 0)), 1.6), target: tr.center().add(new THREE.Vector3(0, 1.4, 0)) };
    };
  }

  private shotRoadSide(): ShotFn {
    return (t) => {
      const c = this.world.train.center();
      return { pos: lift(c.clone().add(new THREE.Vector3(13 + Math.sin(t * 0.1) * 2, 3, -5)), 2), target: c.clone().add(new THREE.Vector3(0, 0.6, -2)) };
    };
  }

  private shotHazeLook(): ShotFn {
    return () => {
      const tr = this.world.train;
      const p = lift(roadPoint(tr.d + 24).add(new THREE.Vector3(-5, 7, 0)), 4);
      return { pos: p, target: roadPoint(tr.d - 70).add(new THREE.Vector3(0, 9, 0)) };
    };
  }

  private shotCamp(radius = 17, height = 6.5): ShotFn {
    return (t) => {
      const c = this.world.train.campCenter;
      const a = this.campAngle + t * 0.025;
      return { pos: lift(new THREE.Vector3(c.x + Math.cos(a) * radius, height, c.z + Math.sin(a) * radius), 2), target: c.clone().setY(1.1) };
    };
  }

  private shotStage(st: Stage): ShotFn {
    // Two compositions. People on the road: over their shoulder, looking at the wagons
    // coming toward them (the road concept). Places and obstacles: from behind the
    // wagon-master, looking out at what blocks the way.
    const subject = st.figures.find((f) => f.key === "stranger" || f.key === "keeper")?.fig;
    return (t) => {
      const tr = this.world.train;
      if (st.atTrain) {
        const c = tr.camp > 0.5 ? tr.campCenter.clone().setY(1) : tr.center();
        return { pos: lift(c.clone().add(new THREE.Vector3(8 + Math.sin(t * 0.1), 3, -6)), 2), target: c.clone().add(new THREE.Vector3(0, 0.4, 0)) };
      }
      const head = tr.camp > 0.5 ? tr.campCenter.clone() : roadPoint(tr.d + 8.5);
      const S = subject && subject.root.visible ? st.worldPos(subject).setY(st.focus.y) : st.focus.clone();
      const u = head.clone().sub(S).setY(0);
      const gap = u.length();
      u.normalize();
      let n = new THREE.Vector3(u.z, 0, -u.x);
      // Keep the camera off the road: put it on the side the subject stands on.
      const lateral = S.clone().sub(roadPoint(st.s)).setY(0);
      if (lateral.dot(n) < 0) n = n.negate();
      const sway = Math.sin(t * 0.15) * 0.4;
      // Over the shoulder only for people near the road; anyone by a building or far out
      // in a field is framed from the wagons so the camera never ends up inside a wall.
      if (subject && subject.root.visible && gap < 70 && lateral.length() < 6.5) {
        const pos = S.clone().add(u.clone().multiplyScalar(-5.5)).add(n.clone().multiplyScalar(3.2 + sway));
        pos.y = 2.3;
        // On a tall screen there is little room beside the subject, so aim closer to them.
        const aim = this.world.rig.camera.aspect < 1 ? 0.12 : 0.35;
        return { pos: lift(pos, 1.6), target: S.clone().lerp(head, aim).setY(1.3) };
      }
      const pos = head.clone().add(u.clone().multiplyScalar(6)).add(n.clone().multiplyScalar(4 + sway));
      pos.y = 3.2 + Math.min(8, gap * 0.08);
      return { pos: lift(pos, 2), target: S.clone().setY(Math.max(1, st.focus.y * 0.8)) };
    };
  }

  private shotFigure(fig: Figure, dist = 4.4): ShotFn {
    return () => {
      const p = fig.root.position;
      const fwd = new THREE.Vector3(Math.sin(fig.yaw), 0, Math.cos(fig.yaw));
      const side = new THREE.Vector3(fwd.z, 0, -fwd.x);
      const pos = p.clone().add(fwd.multiplyScalar(dist)).add(side.multiplyScalar(1.6)).add(new THREE.Vector3(0, 1.9, 0));
      return { pos: lift(pos, 1.2), target: p.clone().add(new THREE.Vector3(0, 1.3 * fig.heightScale, 0)) };
    };
  }

  private shotCombat(cs: CombatStage): ShotFn {
    return (t) => {
      const a = cs.anchor;
      const right = new THREE.Vector3(cs.dir.z, 0, -cs.dir.x);
      const pos = a.clone().add(cs.dir.clone().multiplyScalar(-5)).add(right.multiplyScalar(8 + Math.sin(t * 0.3) * 0.6)).add(new THREE.Vector3(0, 4.2, 0));
      return { pos: lift(pos, 2.5), target: a.clone().add(cs.dir.clone().multiplyScalar(8.5)).setY(1.3) };
    };
  }

  private shotTown(localPos: THREE.Vector3, localTarget: THREE.Vector3): ShotFn {
    return (t) => {
      const g = this.town!.group;
      const p = g.localToWorld(localPos.clone().add(new THREE.Vector3(Math.sin(t * 0.1) * 0.8, 0, 0)));
      return { pos: lift(p, 1.5), target: g.localToWorld(localTarget.clone()) };
    };
  }

  // ------------------------------------------------------------------ helpers

  private get s() {
    return this.game!.s;
  }

  private roadPhase(): boolean {
    return this.s.queue.some((q) => q.t === "travel");
  }

  private snapshot(): Snap {
    const s = this.s;
    const members = new Map<string, MemberSnap>();
    for (const m of s.party) members.set(m.id, { alive: m.alive, health: m.health, fate: m.fate });
    const p = s.pending;
    return {
      members,
      wagons: s.train.wagons,
      condition: s.train.condition,
      miles: s.miles,
      gap: s.gap,
      res: { ...s.res },
      scrip: s.scrip,
      combatHp: p.kind === "combat" ? p.combat.hp : 0,
      combatMax: p.kind === "combat" ? p.combat.maxHp : 1,
      queueCombat: s.queue[0]?.t === "combat",
    };
  }

  private sceneInst(): SceneInstance | null {
    const p = this.s.pending;
    return p.kind === "scene" ? p.scene : null;
  }

  private save(): void {
    if (!this.game) return;
    try {
      if (this.game.over) localStorage.removeItem(SAVE_KEY);
      else localStorage.setItem(SAVE_KEY, this.game.serialize());
    } catch {
      /* storage may be unavailable */
    }
  }

  static saved(): { day: number; miles: number; raw: string } | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw) as { version: number; day: number; miles: number; ending: unknown };
      if (s.version !== 1 || s.ending) return null;
      return { day: s.day, miles: Math.round(s.miles), raw };
    } catch {
      return null;
    }
  }

  static clearSave(): void {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* ignore */
    }
  }

  private wait(sec: number): Promise<void> {
    return this.world.wait(sec);
  }

  private async cinematic(fn: () => Promise<void>): Promise<void> {
    this.busy = true;
    this.ui.setBusy(true);
    this.world.rig.setFrame(0, 0);
    this.world.keyStrength = 0.3;
    if (FAST) this.world.timeScale = 14;
    try {
      await fn();
    } finally {
      // Under test the frame rate is too low for the camera to settle on its own.
      if (FAST && this.baseShot) this.world.rig.set(this.baseShot, 1.5, true);
      this.world.timeScale = 1;
      this.ui.say("");
      this.ui.setBusy(false);
      this.busy = false;
    }
  }

  skip(): void {
    if (!this.busy) return;
    this.world.timeScale = 10;
  }

  /** Apply the sim's state to the world. `dawn` shows the caravan as it was when the day began. */
  private syncWorldState(dawn?: Snap): void {
    const s = this.s;
    const hud = this.game!.hud();
    const tr = this.world.train;
    tr.applyHud(dawn ? { ...hud, res: dawn.res, condition: dawn.condition, wagons: dawn.wagons } : hud);
    tr.torchesLit = (dawn ? dawn.res.torches : s.res.torches) > 0;
    this.world.gapMiles = s.gap;
    this.world.target.reach = smoothstep(600, 830, s.miles);
  }

  /** Bring party figures in line with the sim, animating arrivals, deaths, and departures. */
  private syncParty(before: Snap | null): void {
    const s = this.s;
    const hud = this.game!.hud();
    const tr = this.world.train;
    const st = this.stage;
    // Someone who joins walks over from where they stood in the scene; the figure there
    // is hidden only when it is actually taken.
    const res = tr.syncMembers(hud.party, () => {
      if (!before) return undefined;
      const sf = st && !st.atTrain ? st.figures.find((f) => f.recruit && f.fig.root.visible) : undefined;
      if (sf && st) {
        sf.fig.root.visible = false;
        return st.worldPos(sf.fig);
      }
      const c = tr.center();
      return c.add(new THREE.Vector3(18, 0, -4));
    });
    for (const id of res.removed) {
      const m = s.party.find((x) => x.id === id);
      const fate = m?.fate ?? "";
      const a = tr.members.get(id);
      if (!a) continue;
      const p = a.fig.position.clone();
      // Departures are worded "walked…", "turned…", "left…", "took…"; anything else is a death.
      if (/^(walked|turned)/.test(fate)) {
        tr.dismiss(id, p.clone().add(new THREE.Vector3(3, 0, 30)));
      } else if (/^(left|took)/.test(fate)) {
        tr.dismiss(id, p.clone().add(new THREE.Vector3(-26, 0, 8)));
      } else {
        tr.dismiss(id, undefined, true);
        const marker = cross();
        marker.position.set(p.x + 1.6, terrainHeight(p.x + 1.6, p.z), p.z);
        marker.rotation.y = Math.random() * 0.4;
        this.world.scene.add(marker);
        this.markers.push(marker);
        this.audio.sfx("thud");
      }
    }
    if (before) {
      for (const m of s.party) {
        const b = before.members.get(m.id);
        if (b && m.alive && m.health < b.health - 0.5) {
          tr.figure(m.id)?.hurt();
          this.audio.sfx("hit");
        }
      }
    }
    // Keep the grave markers from piling up forever.
    while (this.markers.length > 30) {
      const m = this.markers.shift()!;
      m.removeFromParent();
      disposeTree(m);
    }
  }

  /** Remove a stage and give its flames' lights back to the pool. */
  private drop(st: Stage): void {
    for (const f of st.flames) this.world.pool.remove(f);
    st.dispose();
  }

  private retireStage(): void {
    if (this.stage) {
      this.oldStages.push(this.stage);
      this.stage = null;
    }
    this.world.train.clearStaging();
  }

  private placeStage(st: Stage, s: number): void {
    this.world.scene.add(st.group);
    st.placeAt(s);
    for (const f of st.flames) this.world.pool.add(f);
    for (const old of this.oldStages) old.settle();
  }

  // ------------------------------------------------------------------ start

  /** Title backdrop: a camp at night in the fields, turning slowly. */
  titleScene(): void {
    const w = this.world;
    this.disposeAll();
    w.train.d = 30 * U;
    w.gapMiles = 52;
    w.target.night = 1;
    w.target.reach = 0;
    // Nothing from the last run carries into the backdrop.
    w.train.setWagons(3, 1);
    w.train.fire.size = 1.6;
    w.train.torchesLit = true;
    w.train.syncMembers(
      ["leader", "ines", "cutter", "wren", "odalys"].map((id, i) => ({
        id,
        name: id,
        role: (["scout", "medic", "hunter", "scout", "speaker"] as const)[i],
        traits: [],
        health: 90,
        nerve: 60,
        trust: 60,
        conditions: [],
        isLeader: i === 0,
      })),
    );
    w.train.pitchCamp();
    w.train.ringLit = 1;
    w.snap();
    this.campAngle = 2.3;
    this.shot(this.shotCamp(30, 4.5), 1, true);
  }

  private disposeAll(): void {
    const w = this.world;
    if (this.stage) this.drop(this.stage);
    this.stage = null;
    for (const s of this.oldStages) this.drop(s);
    this.oldStages = [];
    if (this.town) this.drop(this.town);
    this.town = null;
    this.combat?.dispose();
    this.combat = null;
    this.clearTownsfolk();
    for (const m of this.markers) {
      m.removeFromParent();
      disposeTree(m);
    }
    this.markers = [];
    for (const id of [...w.train.members.keys()]) w.train.dismiss(id);
    w.train.breakCamp();
    w.train.camp = 0;
    w.train.releaseClearing();
    w.hazeBoost = 0;
    CLEARINGS[0].w = 0;
    CLEARINGS[1].w = 0;
  }

  private clearTownsfolk(): void {
    for (const f of [...this.candidates.values(), ...this.bystanders]) {
      f.root.removeFromParent();
      disposeTree(f.root);
    }
    this.candidates.clear();
    this.bystanders = [];
  }

  async newGame(opts: NewGameOptions): Promise<void> {
    Director.clearSave();
    this.game = Game.create(opts);
    this.screen = this.game.screen();
    this.disposeAll();
    await this.cinematic(async () => {
      this.enterTown(true);
      this.ui.say("Cinder Ford", "The last town the Haze has not reached");
      await this.wait(2.2);
    });
    this.save();
    this.present();
  }

  resume(raw: string): void {
    this.game = Game.restore(raw);
    this.screen = this.game.screen();
    this.disposeAll();
    this.restore();
    this.present();
  }

  /** Rebuild the world around a loaded save without animation. */
  private restore(): void {
    const s = this.s;
    const w = this.world;
    w.train.d = s.miles * U;
    this.syncWorldState();
    const p = s.pending;
    if (s.day === 0) {
      this.enterTown(p.kind === "setup");
      if (p.kind === "store") this.shotStore();
      w.snap();
      return;
    }
    this.syncParty(null);
    const night = !this.roadPhase() && p.kind !== "plan";
    if (p.kind === "plan" || night || p.kind === "ending") {
      w.train.pitchCamp();
      w.train.ringLit = s.gap < TUNING.torchGap && s.res.torches > 0 ? 1 : 0;
      w.target.night = p.kind === "plan" ? 0.62 : 1;
    } else w.target.night = 0.38;
    w.snap();
    if (p.kind === "scene") this.stageScene(p.scene, true);
    else if (p.kind === "combat") this.startCombatStage(p.combat.enemy);
    else if (p.kind === "arrival" || (p.kind === "store" && p.storeId !== "cinder-ford")) {
      const id = p.kind === "arrival" ? p.id : p.storeId === "wayhouse" ? "meridian-wayhouse" : "last-lamp";
      this.stageArrival(id);
    } else this.shot(w.train.camp > 0.5 ? this.shotCamp() : this.shotRoadFront(), 2, true);
  }

  // ------------------------------------------------------------------ town

  private enterTown(muster: boolean): void {
    const w = this.world;
    const town = buildTown();
    this.town = town;
    w.scene.add(town.group);
    town.placeAt(4);
    town.moveClearing(0, 34);
    town.settle();
    for (const f of town.flames) w.pool.add(f);
    w.train.d = 0;
    w.target.night = 1;
    w.gapMiles = this.s.gap;
    w.train.setWagons(this.s.train.wagons, 1);
    w.train.syncMembers(this.game!.hud().party);
    // The wagon-master waits by the bonfire.
    const fire = town.group.localToWorld(new THREE.Vector3(0, 0, -26));
    const lead = w.train.members.get(w.train.leaderId);
    if (lead) lead.stage = { x: fire.x + 2.4, z: fire.z - 1.5, face: fire, pose: "stand" };
    if (muster && this.s.pending.kind === "setup") {
      const offered = this.s.pending.offered;
      offered.forEach((id, i) => {
        const tpl = ROSTER.find((r) => r.id === id)!;
        const f = new Figure(lookFor(id, tpl.role, false));
        const toCam = town.group.localToWorld(new THREE.Vector3(5, 0, -40)).sub(fire);
        const base = Math.atan2(toCam.z, toCam.x);
        // A wide arc on the far side of the fire: they face it, and you, lit from below.
        const a = base + Math.PI + (i / (offered.length - 1) - 0.5) * Math.PI * 0.8;
        const x = fire.x + Math.cos(a) * 4.6;
        const z = fire.z + Math.sin(a) * 4.6;
        f.root.position.set(x, terrainHeight(x, z), z);
        f.yaw = f.targetYaw = Math.atan2(fire.x - x, fire.z - z);
        w.scene.add(f.root);
        this.candidates.set(id, f);
      });
      // Look at the middle of the group so all six fit in the space beside the card.
      const centroid = new THREE.Vector3();
      for (const f of this.candidates.values()) centroid.add(f.root.position);
      centroid.divideScalar(Math.max(1, this.candidates.size)).setY(1.3);
      const g = town.group;
      this.shot((t) => ({ pos: lift(g.localToWorld(new THREE.Vector3(5 + Math.sin(t * 0.1) * 0.6, 4, -40)), 1.5), target: centroid.clone() }), 1.2, true);
    } else this.shotStore();
    w.snap();
  }

  private shotStore(): void {
    this.shot(this.shotTown(new THREE.Vector3(-3, 4.2, -9), new THREE.Vector3(11, 2.6, 7)), 1.2);
  }

  candidateAt(id: string): Figure | undefined {
    return this.candidates.get(id);
  }

  figures(): { id: string; fig: Figure; candidate: boolean }[] {
    const out: { id: string; fig: Figure; candidate: boolean }[] = [];
    for (const [id, a] of this.world.train.members) out.push({ id, fig: a.fig, candidate: false });
    for (const [id, f] of this.candidates) out.push({ id, fig: f, candidate: true });
    return out;
  }

  focusMember(id: string | null): void {
    if (!id || this.focused === id || this.busy) {
      if (this.baseShot) this.world.rig.set(this.baseShot, 1.5);
      this.focused = null;
      return;
    }
    const fig = this.world.train.figure(id) ?? this.candidates.get(id);
    if (!fig) return;
    this.focused = id;
    this.world.rig.set(this.shotFigure(fig), 1.8);
  }

  highlight(id: string | null): void {
    for (const [cid, f] of this.candidates) {
      const picked = this.s.pending.kind === "setup" && this.s.pending.picked.includes(cid);
      f.setRing(picked ? "select" : cid === id ? "focus" : "none");
    }
    for (const [mid, a] of this.world.train.members) {
      if (a.view.conditions.includes("dying")) continue;
      a.fig.setRing(mid === id ? "focus" : "none");
    }
  }

  // ------------------------------------------------------------------ acting

  async trade(item: ResourceId, qty: number): Promise<void> {
    if (!this.game || this.busy) return;
    const msg = this.game.trade(item, qty);
    this.screen = this.game.screen();
    this.ui.toast(msg);
    if (/^Bought|^Sold/.test(msg)) this.audio.sfx("coin");
    this.syncWorldState();
    this.save();
    this.present();
  }

  async act(id: string): Promise<void> {
    if (!this.game || this.busy) return;
    const prev = this.screen!;
    const before = this.snapshot();
    const prevPending: Pending = JSON.parse(JSON.stringify(this.s.pending)) as Pending;
    let next: Screen;
    try {
      next = this.game.choose(id);
    } catch (e) {
      this.ui.toast(e instanceof Error ? e.message : String(e));
      return;
    }
    this.screen = next;
    // Save now: reloading mid-cinematic must not replay a choice already made.
    this.save();
    // Choices that only change settings or the muster pick do not need a cinematic.
    if (prev.kind === "setup" && id.startsWith("pick:")) {
      this.highlight(null);
      const f = this.candidates.get(id.slice(5));
      if (f) f.pose = this.s.pending.kind === "setup" && this.s.pending.picked.includes(id.slice(5)) ? "reach" : "stand";
      this.present();
      return;
    }
    if (prev.kind === "plan" && /^(pace|rations):/.test(id)) {
      this.present();
      return;
    }
    const game = this.game;
    try {
      await this.cinematic(() => this.play(prev, prevPending, id, next, before));
    } catch (e) {
      console.error(e);
    }
    // The run may have been abandoned while the cinematic played.
    if (this.game === game) this.present();
  }

  /** Show the current card, labelled for the time of day, and frame the view around it. */
  present(): void {
    const s = this.screen!;
    const night = this.game && !this.roadPhase() && this.s.day > 0;
    if (s.kind === "scene" && night) this.ui.kickerOverride = "In the night";
    else if (s.kind === "result" && s.title.startsWith("Nightfall")) this.ui.kickerOverride = "Nightfall";
    this.ui.render(s);
    this.frameForUI();
    this.world.keyStrength = s.kind === "scene" || s.kind === "combat" || s.kind === "arrival" || s.kind === "store" || s.kind === "setup" ? 1 : 0.45;
  }

  frameForUI(): void {
    const f = this.ui.freeCenter();
    this.world.rig.setFrame(f.fx, f.fy, FAST);
  }

  private async play(prev: Screen, prevPending: Pending, id: string, next: Screen, before: Snap): Promise<void> {
    const w = this.world;
    switch (prev.kind) {
      case "setup":
        return this.leaveMuster();
      case "store":
        if (id === "inspect") return;
        if (prevPending.kind === "store" && prevPending.storeId === "cinder-ford") return this.leaveTown(next);
        return this.transition(next, before);
      case "plan":
        if (id === "go") return this.go(next, before);
        return this.campAction(id, next, before);
      case "scene": {
        if (id === "look") return this.look(prevPending);
        await this.outcome(prevPending, id, before);
        if (next.kind === "ending") return this.ending();
        return;
      }
      case "combat":
        return this.combatRound(id, next, before);
      case "arrival":
        if (id === "shop") {
          this.shot(this.shotStageFront(), 1.2);
          await this.wait(1.4);
          return;
        }
        return this.transition(next, before);
      case "result":
        return this.transition(next, before);
      default:
        void w;
    }
  }

  // ------------------------------------------------------------------ muster and town

  private async leaveMuster(): Promise<void> {
    const w = this.world;
    const party = this.game!.hud().party;
    const spots = new Map<string, THREE.Vector3>();
    for (const [id, f] of this.candidates) spots.set(id, f.root.position.clone());
    w.train.syncMembers(party, (id) => spots.get(id));
    for (const m of party) {
      const f = this.candidates.get(m.id);
      if (f) {
        f.root.removeFromParent();
        disposeTree(f.root);
        this.candidates.delete(m.id);
      }
    }
    for (const f of this.candidates.values()) {
      f.setRing("none");
      f.pose = "stand";
      this.bystanders.push(f);
    }
    this.candidates.clear();
    w.train.clearStaging();
    this.ui.say("Four go with you.", "Two stay by the fire and watch you load the wagons.");
    this.shotStore();
    await this.wait(3);
  }

  private async leaveTown(next: Screen): Promise<void> {
    const w = this.world;
    w.target.night = 0.62;
    w.train.clearStaging();
    this.syncWorldState();
    this.ui.say("Dawn over Cinder Ford", "The oxen lean into the traces.");
    this.shot(this.shotRoadFront(), 1);
    await this.wait(2.6);
    void next;
  }

  // ------------------------------------------------------------------ the morning

  private async campAction(id: string, next: Screen, before: Snap): Promise<void> {
    const w = this.world;
    const tr = w.train;
    const hud = this.game!.hud();
    const pick = (role: string) => hud.party.find((m) => m.role === role && !m.conditions.includes("dying")) ?? hud.party[0];
    const standAt = (mid: string, target: THREE.Vector3, pose: "kneel" | "stand" | "reach" = "kneel") => {
      const a = tr.members.get(mid);
      if (!a) return;
      const from = a.fig.position.clone();
      const dir = from.clone().sub(target).setY(0).normalize().multiplyScalar(1.1);
      a.stage = { x: target.x + dir.x, z: target.z + dir.z, face: target, pose };
    };
    if (id === "repair") {
      const mech = pick("mechanic");
      const wagon = tr.wagons[0].root.position.clone();
      standAt(mech.id, wagon);
      this.shot(this.shotFigure(tr.figure(mech.id)!, 5), 1.6);
      await this.wait(1.4);
      for (let i = 0; i < 4; i++) {
        w.embers.burst(wagon.clone().add(new THREE.Vector3(0, 0.8, 0)), 10, 3, 2, 0.5);
        this.audio.sfx("hit");
        await this.wait(0.35);
      }
    } else if (id.startsWith("tend:")) {
      const patient = id.split(":")[1];
      const medic = pick("medic");
      const pf = tr.figure(patient);
      if (pf && medic.id !== patient) standAt(medic.id, pf.position.clone());
      if (pf) this.shot(this.shotFigure(pf, 5), 1.6);
      await this.wait(2);
    } else if (id === "forage") {
      const hunter = pick("hunter");
      const a = tr.members.get(hunter.id);
      const out = tr.campCenter.clone().add(new THREE.Vector3(-30, 0, -14));
      if (a) a.stage = { x: out.x, z: out.z, pose: "walk" };
      this.ui.say("Foraging", `${hunter.name} goes out past the light.`);
      await this.wait(2.6);
      if (a) a.stage = null;
      await this.wait(1.2);
      if (next.kind === "combat") return this.transition(next, before);
    } else if (id === "rally") {
      for (const a of tr.members.values()) a.stage = null;
      tr.fire.size = 2.6;
      this.audio.sfx("burst");
      await this.wait(1.8);
      tr.fire.size = 1.6;
    }
    tr.clearStaging();
    this.syncParty(before);
    this.syncWorldState();
    this.shot(this.shotCamp(), 1.2);
    await this.wait(0.6);
  }

  private async go(next: Screen, before: Snap): Promise<void> {
    const w = this.world;
    const tr = w.train;
    this.retireStage();
    if (tr.camp > 0.5) {
      tr.breakCamp();
      w.target.night = 0.45;
      this.shot(this.shotRoadSide(), 1.2);
      await this.wait(1.9);
    }
    w.target.night = 0.38;
    const pace = PACES[this.s.pace];
    this.ui.say(`Day ${this.s.day} · ${regionAt(this.s.miles).name}`, `${pace.name} pace`);
    if (next.kind === "scene" && this.roadPhase()) return this.rollToScene(before);
    await this.rollDay(next, before);
    if (next.kind === "ending") {
      this.syncParty(before);
      this.syncWorldState();
      await this.ending();
    }
  }

  // ------------------------------------------------------------------ the road

  private expectedDayUnits(): number {
    const pace = PACES[this.s.pace];
    return pace.hours * TUNING.baseMph * regionAt(this.s.miles).terrain * U;
  }

  private async rollToScene(before: Snap): Promise<void> {
    const w = this.world;
    const tr = w.train;
    const inst = this.sceneInst()!;
    this.retireStage();
    const adv = Math.min(this.expectedDayUnits() * 0.12, 8);
    const st = buildStage(inst.id);
    this.stage = st;
    if (!st.atTrain) this.placeStage(st, tr.d + adv + st.stopShort + 8);
    w.sideOn = true;
    this.shot(this.shotTravelApproach(), 6, true);
    await tr.roll(tr.d + adv, 3.4, true);
    w.sideOn = false;
    if (st.atTrain) this.placeStage(st, tr.d - WAGON_GAP);
    this.syncWorldState();
    void before;
    await this.presentScene(inst);
  }

  /** Put a scene on stage without the approach (loading a save). */
  private stageScene(inst: SceneInstance, snapCam: boolean): void {
    const tr = this.world.train;
    const night = !this.roadPhase();
    // Mirror how the scene was staged when it happened: landmarks ahead of the camp,
    // other night scenes at the wagons, road scenes where rollToScene puts them.
    const landmark = LANDMARK_SCENES.has(inst.id);
    const st = buildStage(night && !landmark ? "__none__" : inst.id);
    this.stage = st;
    this.placeStage(st, landmark ? tr.d + 20 : st.atTrain ? tr.d - WAGON_GAP : tr.d + st.stopShort + 8);
    this.stagePeople(inst, night);
    this.shot(this.shotForScene(inst), 1.4, snapCam);
  }

  private shotForScene(inst: SceneInstance): ShotFn {
    const def = sceneById(inst.id);
    const tr = this.world.train;
    const focusId = def?.kind === "dispute" ? inst.a : def?.kind === "crisis" ? inst.actor : undefined;
    const fig = focusId ? tr.figure(focusId) : undefined;
    if (inst.id === "last-stand") return this.shotHazeLook();
    if (fig && (def?.kind === "dispute" || def?.kind === "crisis")) return this.shotFigure(fig, 7);
    return this.shotStage(this.stage!);
  }

  private async presentScene(inst: SceneInstance): Promise<void> {
    const def = sceneById(inst.id);
    const night = !this.roadPhase();
    this.stagePeople(inst, night);
    this.shot(this.shotForScene(inst), 1.3);
    this.ui.say("");
    if (def?.kind === "stranger" || def?.kind === "haze" || def?.kind === "crisis" || def?.kind === "landmark" || def?.kind === "oddity") this.audio.sfx(def.kind === "landmark" ? "bell" : "sting");
    if (def?.kind === "haze") this.audio.sfx("whisper");
    await this.wait(1.7);
  }

  /** Arrange the party for scenes that are about the party itself. */
  private stagePeople(inst: SceneInstance, night: boolean): void {
    const tr = this.world.train;
    const def = sceneById(inst.id);
    const kind = def?.kind;
    const base = night || tr.camp > 0.5 ? tr.campCenter.clone() : roadPoint(tr.d - 2).add(new THREE.Vector3(5, 0, 0));
    const fig = (id?: string) => (id ? tr.members.get(id) : undefined);
    if (kind === "dispute" && inst.a && inst.b) {
      const a = fig(inst.a);
      const b = fig(inst.b);
      const pa = base.clone().add(new THREE.Vector3(-1.2, 0, 2.5));
      const pb = base.clone().add(new THREE.Vector3(1.2, 0, 2.5));
      const brawl = inst.id === "fistfight";
      if (a) a.stage = { x: pa.x, z: pa.z, face: pb, pose: brawl ? "reach" : "stand" };
      if (b) b.stage = { x: pb.x, z: pb.z, face: pa, pose: brawl ? "reach" : "stand" };
      let k = 0;
      for (const [id, m] of tr.members) {
        if (id === inst.a || id === inst.b || m.view.conditions.includes("dying")) continue;
        const ang = Math.PI * 0.2 + (k++ / 5) * Math.PI * 0.6;
        const p = base.clone().add(new THREE.Vector3(Math.cos(ang) * 4.5, 0, 2.5 - Math.sin(ang) * 4.5 + 5));
        m.stage = { x: p.x, z: p.z, face: pa.clone().lerp(pb, 0.5), pose: "stand" };
      }
      return;
    }
    const actor = fig(inst.actor);
    switch (inst.id) {
      case "breakdown":
        if (actor) {
          const p = base.clone().add(new THREE.Vector3(4, 0, 22));
          actor.stage = { x: p.x, z: p.z, face: p.clone().add(new THREE.Vector3(0, 0, 10)), pose: "stand" };
        }
        break;
      case "turned":
        for (const [id, m] of tr.members) {
          if (id === inst.actor) continue;
          const p = m.fig.position;
          m.stage = { x: p.x, z: p.z, pose: "lie" };
        }
        if (actor) {
          actor.fig.eyeGlow = 1;
          const p = base.clone().add(new THREE.Vector3(2, 0, -1.5));
          actor.stage = { x: p.x, z: p.z, face: base, pose: "stand" };
        }
        break;
      case "fogsick-quarantine":
        if (actor) {
          const p = base.clone().add(new THREE.Vector3(-9, 0, 4));
          actor.stage = { x: p.x, z: p.z, face: base, pose: "sit" };
        }
        break;
      case "deserter":
        if (actor) {
          const w = tr.wagons[Math.max(0, this.s.train.wagons - 1)].root.position;
          actor.stage = { x: w.x + 1.5, z: w.z + 1.5, face: w, pose: "reach" };
        }
        break;
      case "fever":
        if (actor) {
          const w = tr.wagons[0].root.position;
          actor.stage = { x: w.x + 2.4, z: w.z, pose: "lie" };
        }
        break;
      case "oxen-balk":
        for (const pair of tr.oxen) for (const o of pair) o.lookBack = 1;
        break;
      case "campfire-song":
      case "shared-supper":
        if (actor) {
          const p = base.clone().add(new THREE.Vector3(0.5, 0, 2.2));
          actor.stage = { x: p.x, z: p.z, face: base, pose: inst.id === "campfire-song" ? "stand" : "sit" };
        }
        break;
      case "headcount": {
        const st = this.stage;
        if (st) {
          const f = st.fig("hollowed", 0, 0, "stand", "extra", { eyes: 0.4 });
          const p = base.clone().add(new THREE.Vector3(-7, 0, 5));
          st.group.worldToLocal(p);
          f.root.position.copy(p);
          f.setFade(0.55);
        }
        break;
      }
      case "sky-bleeds":
        this.world.hazeBoost = 0.4;
        break;
      case "square-of-blue":
        this.world.target.reach = 1;
        break;
      case "ash-squall":
        this.world.hazeBoost = Math.max(0, 0.7 - this.world.haze.proximity);
        break;
    }
  }

  private async look(prevPending: Pending): Promise<void> {
    const tr = this.world.train;
    const inst = prevPending.kind === "scene" ? prevPending.scene : null;
    const observer = inst?.observer ? tr.members.get(inst.observer) : undefined;
    const st = this.stage;
    if (observer && st && !st.atTrain) {
      const toward = observer.fig.position.clone().lerp(st.focus, 0.55);
      observer.stage = { x: toward.x, z: toward.z, face: st.focus, pose: "stand" };
      this.world.rig.set(this.shotFigure(observer.fig, 5), 1.4);
      this.ui.say("An hour passes.", `${observer.view.name} watches, and the Haze keeps coming.`);
      await this.wait(2.2);
      observer.stage = null;
    } else {
      this.ui.say("An hour passes.");
      await this.wait(1.4);
    }
    if (this.baseShot) this.world.rig.set(this.baseShot, 1.3);
    await this.wait(0.4);
  }

  private async outcome(prevPending: Pending, id: string, before: Snap): Promise<void> {
    const w = this.world;
    const tr = w.train;
    const inst = prevPending.kind === "scene" ? prevPending.scene : null;
    const def = inst ? sceneById(inst.id) : undefined;
    const opt = def?.options.find((o) => o.id === id);
    const st = this.stage;
    // Helping means walking over; the stranger's reaction plays when the result comes in.
    if (opt?.tag === "help" && st && !st.atTrain) {
      const lead = tr.members.get(tr.leaderId);
      const target = st.figures.find((f) => f.key === "stranger")?.fig;
      const tp = target ? st.worldPos(target) : st.focus.clone();
      if (lead) lead.stage = { x: tp.x - 1.4, z: tp.z + 1.6, face: tp, pose: "reach" };
      this.world.rig.set(this.shotStage(st), 1.4);
      await this.wait(1.8);
    }
    for (const pair of tr.oxen) for (const o of pair) o.lookBack = 0;
    w.hazeBoost = 0;
    // A trap springs: the stranger shows what they are.
    const combatNext = this.s.queue[0]?.t === "combat";
    if (combatNext && st) {
      const enemy = (this.s.queue[0] as { enemy: string }).enemy;
      const hollow = ENEMIES[enemy]?.tags.includes("hollowed");
      for (const sf of st.figures) {
        if (hollow) sf.fig.eyeGlow = 1;
        else if (sf.key === "stranger" || sf.key === "hidden" || sf.key === "guard") sf.fig.holdRifle(true);
        sf.fig.pose = "stand";
      }
      this.audio.sfx("sting");
      w.rig.kick(0.4);
    }
    this.syncParty(before);
    this.syncWorldState();
    await this.wait(1.2);
    tr.clearStaging();
  }

  // ------------------------------------------------------------------ transitions

  private async transition(next: Screen, before: Snap): Promise<void> {
    const w = this.world;
    // Anything left over from a finished fight is cleared away.
    if (this.combat && next.kind !== "combat") {
      const c = this.combat;
      this.combat = null;
      setTimeout(() => c.dispose(), 4000);
    }
    this.world.train.clearStaging();
    switch (next.kind) {
      case "scene": {
        const inst = this.sceneInst()!;
        // A landmark's scene plays on the stage its arrival already built.
        if (this.stage && this.stage.id === inst.id) return this.presentScene(inst);
        if (this.roadPhase()) return this.rollToScene(before);
        // A night scene: a landmark ahead of the camp, or trouble inside it.
        this.retireStage();
        if (LANDMARK_SCENES.has(inst.id)) {
          const st = buildStage(inst.id);
          this.stage = st;
          this.placeStage(st, w.train.d + 20);
        } else {
          const st = buildStage("__none__");
          this.stage = st;
          this.placeStage(st, w.train.d - WAGON_GAP);
        }
        return this.presentScene(inst);
      }
      case "combat":
        return this.startCombat();
      case "result":
        if (next.title.startsWith("Nightfall")) return this.rollDay(next, before);
        return;
      case "fork":
        this.retireStage();
        this.shot(this.shotCamp(), 1.3);
        this.audio.sfx("bell");
        return;
      case "plan":
        return this.dawn();
      case "arrival": {
        const p = this.s.pending;
        if (p.kind !== "arrival") return;
        this.retireStage();
        this.stageArrival(p.id);
        this.audio.sfx("bell");
        this.ui.say(next.title);
        await this.wait(2.4);
        return;
      }
      case "store":
        this.shot(this.shotStageFront(), 1.2);
        await this.wait(1);
        return;
      case "ending":
        if (before.miles < this.s.miles - 0.5) await this.rollDay(next, before);
        this.syncParty(before);
        this.syncWorldState();
        return this.ending();
      default:
        return;
    }
  }

  private stageArrival(id: string): void {
    const w = this.world;
    const st = buildArrival(id);
    if (!st) {
      this.shot(this.shotCamp(), 1.3);
      return;
    }
    this.stage = st;
    this.placeStage(st, w.train.d + 20);
    this.shot(this.shotStage(st), 1.2);
  }

  private shotStageFront(): ShotFn {
    const st = this.stage;
    if (!st) return this.shotCamp();
    return (t) => {
      const keeper = st.figures.find((f) => f.key === "keeper")?.fig;
      const p = keeper ? st.worldPos(keeper) : st.focus.clone();
      const pos = st.group.localToWorld(new THREE.Vector3(Math.sin(t * 0.1) * 0.6, 3.2, 9));
      return { pos: lift(pos, 2), target: p.clone().setY(2.2) };
    };
  }

  // ------------------------------------------------------------------ travel days

  /** The stretch of road the caravan occupies: tail of the last wagon to the lead ox. */
  private span(): { tail: number; head: number; mid: number; len: number } {
    const tr = this.world.train;
    const tail = tr.d - (tr.wagonN - 1) * WAGON_GAP - 3;
    const head = tr.d + 9;
    return { tail, head, mid: (tail + head) / 2, len: head - tail };
  }

  /** How far a camera must stand to fit `width` world units across the screen. */
  private fitDist(width: number, fov: number): number {
    const aspect = this.world.rig.camera.aspect;
    const minFov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(22)) / Math.max(0.2, aspect)));
    const f = Math.max(fov, Math.min(85, minFov));
    const h = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(f) / 2) * aspect);
    return width / 2 / Math.tan(h / 2);
  }

  /** Wide side-on dolly: the whole caravan low in frame against the sky. */
  private shotTravelWide(P: () => number): ShotFn {
    return () => {
      const { mid, len } = this.span();
      const u = smoothstep(0, 1, P());
      const fov = 40;
      const dist = Math.min(90, this.fitDist(len + 12, fov));
      const s = mid + lerp(-len * 0.14, len * 0.14, u);
      const pos = roadPoint(s).add(roadRight(s).multiplyScalar(dist));
      pos.y = 2.2 + u * 0.8;
      const aim = roadPoint(mid + lerp(1.5, -1.5, u));
      aim.y = 1.2 + dist * 0.13;
      return { pos: lift(pos, 1.6), target: aim, fov };
    };
  }

  /** A push along the line: the camera runs from the tail to the head, close enough to read faces. */
  private shotTravelPush(P: () => number): ShotFn {
    return () => {
      const { tail, head } = this.span();
      const u = smoothstep(0, 1, P());
      const s = lerp(tail - 2, head - 5, u);
      const pos = roadPoint(s).add(roadRight(s).multiplyScalar(9.5));
      pos.y = 1.9 + u * 0.5;
      const aim = roadPoint(s + 5.5);
      aim.y = 1.6;
      return { pos: lift(pos, 1.3), target: aim, fov: 48 };
    };
  }

  /** Low, close, on one wheel in the rut. */
  private shotTravelWheels(P: () => number, wagon: number): ShotFn {
    return () => {
      const tr = this.world.train;
      const u = clamp01(P());
      const sw = tr.d - wagon * WAGON_GAP;
      const s = sw + lerp(4, -2.2, u);
      const pos = roadPoint(s).add(roadRight(s).multiplyScalar(4.6));
      pos.y = 0.55;
      const aim = roadPoint(sw - 1.35 + lerp(1.6, -0.8, u)).add(roadRight(sw).multiplyScalar(0.9));
      aim.y = 0.75;
      return { pos: lift(pos, 0.4), target: aim, fov: 52 };
    };
  }

  /** From ahead of the oxen, looking back down the line at the wall of red. */
  private shotTravelBack(P: () => number): ShotFn {
    return () => {
      const tr = this.world.train;
      const u = smoothstep(0, 1, P());
      const s = tr.d + lerp(15, 19, u);
      const pos = roadPoint(s).add(roadRight(s).multiplyScalar(3.3));
      pos.y = 1.5 + u * 0.4;
      const aim = roadPoint(tr.d - 80);
      aim.y = 7.5 + u * 2;
      return { pos: lift(pos, 1.2), target: aim, fov: 50 };
    };
  }

  /** Front three-quarter as the light goes: the line of torches coming on. */
  private shotTravelDusk(P: () => number): ShotFn {
    return () => {
      const { mid, len } = this.span();
      const u = smoothstep(0, 1, P());
      const s = this.world.train.d + lerp(24, 15, u);
      const dist = Math.min(40, this.fitDist(len * 0.5, 44));
      const pos = roadPoint(s).add(roadRight(s).multiplyScalar(dist * 0.55));
      pos.y = 1.8 + u * 0.5;
      const aim = roadPoint(mid);
      aim.y = 2.4;
      return { pos: lift(pos, 1.4), target: aim, fov: 44 };
    };
  }

  /** A slow lateral track on the moving caravan, for the short approach to a road scene. */
  private shotTravelApproach(): ShotFn {
    return (t) => {
      const { mid, len } = this.span();
      const dist = Math.min(60, this.fitDist(len + 6, 42));
      const s = mid + Math.sin(t * 0.2) * 2;
      const pos = roadPoint(s).add(roadRight(s).multiplyScalar(dist));
      pos.y = 2.4;
      const aim = roadPoint(mid);
      aim.y = 1.2 + dist * 0.11;
      return { pos: lift(pos, 1.6), target: aim, fov: 42 };
    };
  }

  /** One short line about the worst of it, when there is a worst of it. */
  private travelCaption(hud: Hud): string {
    const dying = hud.party.find((m) => m.conditions.includes("dying"));
    if (dying) return `${dying.name.split(" ")[0]} rides at the back, and is not waking.`;
    const worst = [...hud.party].sort((a, b) => a.health - b.health)[0];
    if (worst && worst.health < 35) return `${worst.name.split(" ")[0]} can barely stand.`;
    if (hud.res.rations < hud.party.length * 3) return "There is almost nothing left to eat.";
    if (hud.condition < 40) return "The wagons groan at every rut.";
    return "";
  }

  /** What the day took, read off the difference between dawn and now. */
  private dayLosses(before: Snap): { crates: number; sack: boolean; wagon: boolean; ox: boolean } {
    const hud = this.game!.hud();
    const lost = (["ammo", "medicine", "spares", "veils", "rockets"] as const).reduce((n, k) => n + Math.max(0, before.res[k] - hud.res[k]), 0);
    const ration = before.res.rations - hud.res.rations - hud.party.length * 3;
    const hurt = this.s.party.some((m) => {
      const b = before.members.get(m.id);
      return !!b && m.health < b.health - 8;
    });
    return {
      crates: Math.min(3, Math.ceil(lost / 3)),
      sack: ration > 5,
      wagon: before.wagons > hud.wagons,
      ox: before.condition - hud.condition >= 5 || hurt,
    };
  }

  private async rollDay(next: Screen, before: Snap): Promise<void> {
    const w = this.world;
    const tr = w.train;
    const targetD = Math.max(tr.d, this.s.miles * U);
    const hud = this.game!.hud();
    // The caravan rolls out as it stood at dawn; what the day took shows up along the way.
    this.syncWorldState(before);
    if (tr.camp > 0.5) {
      tr.breakCamp();
      w.target.night = 0.45;
      this.shot(this.shotRoadSide(), 1.2);
      await this.wait(1.8);
    }
    this.retireStage();
    const dist = targetD - tr.d;
    const covered = Math.round(this.s.miles - before.miles);
    const advanced = Math.round(this.s.today.hazeMiles);
    const halt = dist < 1.5 * U;
    // A travel day runs 8-14 seconds, longer for longer days and for a Haze that is close.
    const closeHaze = w.haze.proximity > 0.3;
    const dur = halt ? 6 : Math.min(14, Math.max(8, 7 + covered * 0.25) + (closeHaze ? 1 : 0));
    this.ui.say(covered > 0 ? `You cover ${covered} miles` : "The wagons do not move", `The Haze advances ${advanced} miles`);
    const t0 = w.time;
    const at = (a: number, b: number) => () => clamp01((w.time - t0 - a * dur) / ((b - a) * dur));
    const anyDying = [...tr.members.values()].some((m) => m.view.conditions.includes("dying"));
    const featured = anyDying ? tr.wagonN - 1 : this.s.day % tr.wagonN;
    w.sideOn = true;
    const nightfall = w.tween(dur, (u) => {
      w.target.night = 0.38 + 0.62 * smoothstep(0.2, 1, u);
    });
    const losses = this.dayLosses(before);
    // The plodding pace of the animals; the rest of a long day is skipped behind a cut.
    const cruise = 2.4;
    const warpBy = halt ? 0 : Math.max(0, dist - cruise * dur);
    const rolled = halt ? Promise.resolve() : tr.roll(tr.d + (dist - warpBy), dur, true);
    this.shot(this.shotTravelWide(at(0, 0.27)), 6, true);
    await w.wait(dur * 0.27);
    // Push along the line. The cut hides the jump ahead along the road.
    if (warpBy > 0) tr.warp(warpBy);
    const line = this.travelCaption(hud);
    if (line) this.ui.say(line);
    this.shot(this.shotTravelPush(at(0.27, 0.58)), 8, true);
    await w.wait(dur * 0.08);
    // The day's losses happen where the camera is looking.
    tr.applyHud(hud);
    const tailAt = tr.wagons[Math.max(0, tr.wagonN - 1)].tailWorld();
    const back = new THREE.Vector3(Math.sin(tr.wagons[0].root.rotation.y), 0, Math.cos(tr.wagons[0].root.rotation.y)).multiplyScalar(-1);
    for (let i = 0; i < losses.crates; i++) tr.pops.drop(i % 2 ? "barrel" : "crate", tailAt.clone().add(new THREE.Vector3(0, i * 0.5, 0)), back);
    if (losses.sack) tr.pops.drop("sack", tailAt.clone(), back);
    if (losses.crates || losses.sack) this.audio.sfx("thud");
    await w.wait(dur * 0.14);
    if (losses.ox) {
      tr.oxen[0][0].stumble();
      tr.oxen[0][1].stumble();
      this.audio.sfx("thud");
    }
    await w.wait(dur * 0.08);
    this.shot(this.shotTravelWheels(at(0.58, 0.78), featured), 8, true);
    if (line) this.ui.say("");
    await w.wait(dur * 0.2);
    this.shot(closeHaze ? this.shotTravelBack(at(0.78, 1)) : this.shotTravelDusk(at(0.78, 1)), 8, true);
    await rolled;
    await nightfall;
    w.sideOn = false;
    if (next.kind === "ending") return;
    // Make camp. A ring of torches burns if any were spent tonight.
    const lines = next.lines.join(" ");
    const notes = next.notes.join(" ");
    tr.ringLit = /torches burned/.test(notes) ? 1 : 0;
    tr.fire.size = /no torches to light/.test(lines) ? 1.0 : 1.6;
    tr.pitchCamp();
    this.campAngle = Math.random() * Math.PI * 2;
    this.shot(this.shotCamp(), 1.1);
    this.ui.say(`Nightfall, day ${this.s.day}`, tr.ringLit ? "The ring of torches is lit." : /no torches/.test(lines) ? "No torches to light. The dark comes right up to the wagons." : "");
    await this.wait(2.1);
    this.syncParty(before);
    this.syncWorldState();
  }

  /** Tools: frame a travel shot on the standing caravan (kind: wide, push, wheels, back, dusk). */
  previewTravelShot(kind: string, u = 0.5, wagon = 0): void {
    const w = this.world;
    w.train.camp = w.train.campTarget = 0;
    w.sideOn = true;
    const P = () => u;
    const fn =
      kind === "push" ? this.shotTravelPush(P) : kind === "wheels" ? this.shotTravelWheels(P, wagon) : kind === "back" ? this.shotTravelBack(P) : kind === "dusk" ? this.shotTravelDusk(P) : this.shotTravelWide(P);
    this.shot(fn, 6, true);
  }

  private async dawn(): Promise<void> {
    const w = this.world;
    this.retireStage();
    w.target.night = 0.62;
    w.train.clearStaging();
    this.syncWorldState();
    this.ui.say(`Day ${this.s.day}`, regionAt(this.s.miles).name);
    this.shot(this.shotCamp(19, 7), 0.9);
    await this.wait(1.4);
  }

  // ------------------------------------------------------------------ combat

  private startCombatStage(enemyId: string, turnedFrom?: THREE.Vector3): CombatStage {
    const w = this.world;
    const tr = w.train;
    const anchor = tr.camp > 0.5 ? tr.campCenter.clone() : tr.center().setY(0);
    const cs = new CombatStage(w, enemyId, anchor, Math.random() < 0.5 ? -1 : 1, turnedFrom);
    this.combat = cs;
    if (tr.camp < 0.5) {
      const c = anchor.clone().add(cs.dir.clone().multiplyScalar(6));
      CLEARINGS[1].set(c.x, c.z, 26, 1);
      this.stage?.settle();
    }
    const fighters = [...tr.members.values()].filter((a) => !a.view.conditions.includes("dying"));
    const line = cs.partyLine(fighters.length);
    fighters.forEach((a, i) => (a.stage = { x: line[i].x, z: line[i].z, face: line[i].face, pose: "stand" }));
    this.shot(this.shotCombat(cs), 1.4);
    return cs;
  }

  private async startCombat(): Promise<void> {
    const p = this.s.pending;
    if (p.kind !== "combat") return;
    let turned: THREE.Vector3 | undefined;
    if (p.combat.enemy === "the-turned") {
      const gone = [...this.world.train.members.values()].find((a) => a.leaving);
      turned = gone?.fig.position.clone();
    }
    this.startCombatStage(p.combat.enemy, turned);
    this.audio.sfx("sting");
    this.ui.say(ENEMIES[p.combat.enemy].name);
    await this.wait(2.6);
  }

  private async combatRound(tactic: string, next: Screen, before: Snap): Promise<void> {
    const w = this.world;
    const tr = w.train;
    const cs = this.combat;
    if (!cs) return;
    const p = this.s.pending;
    const ongoing = p.kind === "combat";
    const hpAfter = ongoing ? p.combat.hp : 0;
    const fighters = [...tr.members.values()].filter((a) => !a.view.conditions.includes("dying") && a.stage);
    const muzzle = (a: (typeof fighters)[number]) => a.fig.position.clone().add(new THREE.Vector3(Math.sin(a.fig.yaw) * 0.8, 1.45, Math.cos(a.fig.yaw) * 0.8));
    switch (tactic) {
      case "fire": {
        const shooters = fighters.slice(0, 3);
        for (const a of shooters) {
          a.fig.pose = "aim";
          a.fig.holdRifle(true);
          if (a.stage) a.stage.pose = "aim";
        }
        await this.wait(0.5);
        for (const a of shooters) {
          const foe = cs.randomFoe();
          const from = muzzle(a);
          w.flashes.flash(from, new THREE.Color(4, 2.6, 1.2), 1.4, 0.1);
          if (foe) cs.tracer(from, foe.root.position.clone().setY(1.3));
          this.audio.sfx("shot");
          w.rig.kick(0.15);
          await this.wait(0.3);
        }
        break;
      }
      case "hold": {
        for (const a of fighters.slice(0, 4)) {
          const foe = cs.nearestFoe(a.fig.position);
          if (!foe || !a.stage) continue;
          const mid = a.fig.position.clone().lerp(foe.root.position, 0.6);
          a.stage = { ...a.stage, x: mid.x, z: mid.z, pose: "reach" };
          void cs.lunge(foe, mid);
        }
        await this.wait(0.8);
        for (let i = 0; i < 3; i++) {
          this.audio.sfx("hit");
          w.embers.burst(cs.anchor.clone().add(cs.dir.clone().multiplyScalar(6)).setY(1.2), 8, 3, 1.5, 0.5);
          await this.wait(0.25);
        }
        break;
      }
      case "torch": {
        const throwers = fighters.slice(0, 2);
        await Promise.all(
          throwers.map(async (a, i) => {
            await this.wait(i * 0.25);
            const foe = cs.randomFoe();
            const to = foe ? foe.root.position.clone().setY(0.6) : cs.anchor.clone().add(cs.dir.clone().multiplyScalar(12));
            await cs.throwFire(muzzle(a), to, 0.7, 3);
            w.flashes.flash(to.clone().setY(1), new THREE.Color(4, 1.4, 0.3), 3, 0.5);
            w.embers.burst(to, 40, 5, 4, 1.2);
            this.audio.sfx("burst");
          }),
        );
        for (const f of cs.foes) if (f.alive && f.fig) f.fig.pose = "cower";
        break;
      }
      case "rocket": {
        const lead = tr.members.get(tr.leaderId) ?? fighters[0];
        const from = lead ? muzzle(lead) : cs.anchor.clone().setY(1.5);
        const apex = cs.anchor.clone().add(cs.dir.clone().multiplyScalar(8)).setY(28);
        this.audio.sfx("rocket");
        await cs.throwFire(from, apex, 1.1, 2, false);
        w.target.flare = 1;
        w.flashes.flash(apex, new THREE.Color(3, 3.5, 5), 12, 1.6);
        w.rig.kick(0.6);
        for (const f of cs.foes) if (f.alive && f.fig) f.fig.pose = "cower";
        await this.wait(0.8);
        break;
      }
      case "pay-scrip":
      case "pay-rations": {
        const lead = tr.members.get(tr.leaderId);
        if (lead) {
          const toward = cs.anchor.clone().add(cs.dir.clone().multiplyScalar(8));
          lead.stage = { x: toward.x, z: toward.z, face: toward.clone().add(cs.dir), pose: "reach" };
        }
        this.audio.sfx("coin");
        await this.wait(1.8);
        break;
      }
      case "flee": {
        this.shot(this.shotRoadFront(), 1.4);
        await tr.roll(tr.d + 10, 1.4);
        break;
      }
    }
    // Their strength after the round.
    const frac = before.combatMax > 0 ? Math.max(0, hpAfter) / before.combatMax : 0;
    const fallen = cs.setStrength(ongoing ? frac : 0);
    for (const at of fallen) {
      w.flashes.flash(at.clone().setY(1), new THREE.Color(2, 0.3, 0.2), 1, 0.2, false);
      this.audio.sfx("thud");
    }
    // Their blows land.
    const hurt = this.s.party.filter((m) => {
      const b = before.members.get(m.id);
      return b && m.health < b.health - 0.5;
    });
    for (const m of hurt) {
      const f = tr.figure(m.id);
      const foe = f ? cs.nearestFoe(f.position) : null;
      if (f && foe) {
        void cs.lunge(foe, f.position.clone());
        await this.wait(0.35);
        f.hurt();
        this.audio.sfx("hit");
        w.rig.kick(0.25);
      }
    }
    await this.wait(0.5);
    for (const a of fighters) {
      a.fig.holdRifle(false);
      if (a.stage) a.stage.pose = "stand";
    }
    if (!ongoing) {
      if (tactic === "flee" && hpAfter > 0) {
        cs.retreat();
        await tr.roll(tr.d + 24, 2.2);
      } else if (next.kind === "result" && /run|break|scatter|retreat|go\.|withdr|let you go|turn back|fog/i.test(next.lines.join(" ")) && frac > 0) {
        cs.retreat();
      }
      tr.clearStaging();
      this.syncParty(before);
      await this.wait(1);
    } else {
      this.syncParty(before);
    }
    if (next.kind === "ending") await this.ending();
  }

  // ------------------------------------------------------------------ endings

  private async ending(): Promise<void> {
    const w = this.world;
    const tr = w.train;
    const e = this.s.ending;
    if (!e) return;
    this.ui.say(e.headline);
    if (e.kind === "victory") {
      const door = this.stage?.group.getObjectByName("door");
      w.target.reach = 1;
      w.target.night = 0.5;
      w.gapMiles = 140;
      const st = this.stage;
      this.shot(
        st
          ? () => {
              const head = tr.camp > 0.5 ? tr.campCenter.clone() : roadPoint(tr.d);
              const u = head.clone().sub(st.focus).setY(0).normalize();
              const pos = head.clone().add(u.multiplyScalar(48)).add(new THREE.Vector3(9, 5, 0));
              return { pos: lift(pos, 3), target: st.focus.clone().setY(22) };
            }
          : this.shotRoadFront(),
        0.7,
      );
      await w.tween(4, (u) => {
        if (door) door.scale.x = 0.02 + u * 0.98;
      });
      await this.wait(1.5);
    } else if (e.kind === "consumed") {
      this.shot(this.shotHazeLook(), 0.8);
      const g0 = w.gapMiles;
      await w.tween(5, (u) => {
        w.gapMiles = g0 + (-12 - g0) * u;
      });
      await this.wait(1);
    } else {
      w.target.night = 1;
      const c = tr.center();
      this.shot(() => ({ pos: c.clone().add(new THREE.Vector3(10, 14, 16)), target: c }), 0.4);
      await this.wait(4);
    }
  }
}

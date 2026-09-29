// Rigged low-poly people. Silhouette first: the concept art reads as dark
// shapes against a burning sky, so shapes carry identity (build, hat, hair,
// beard, and a prop for each role) and colour is a secondary cue. Local
// forward is +z; yaw = atan2(dx, dz). The wagons and oxen live in wagon.ts.

import * as THREE from "three";
import { Flame, blobShadow } from "./fx.ts";
import { damp } from "./noise.ts";
import { addProp, gball, gbox, gcyl, limb, mat, mesh, put } from "./gear.ts";
import type { Prop } from "./gear.ts";

export type { Prop } from "./gear.ts";
export { Ox, Wagon } from "./wagon.ts";
export type Hat = "wide" | "hood" | "cap" | "bonnet" | "bare" | "tall" | "furcap";
export type Build = "normal" | "broad" | "slight" | "child" | "gaunt" | "long";
export type Age = "child" | "young" | "adult" | "middle" | "old";
export type HairStyle = "none" | "short" | "long" | "bun" | "braid" | "wild";
export type BeardStyle = "none" | "stubble" | "short" | "full" | "long" | "goatee" | "mustache";

/** A fully resolved look: everything a Figure needs to be built. */
export interface Look {
  hat: Hat;
  coat: number;
  trousers: number;
  accent: number;
  skin: number;
  build: Build;
  longCoat?: boolean;
  hollow?: boolean;
  age?: Age;
  hair?: { style: HairStyle; color: number };
  beard?: { style: BeardStyle; color: number };
  hatColor?: number;
  props?: Prop[];
  /** Stable number that picks small per-person details, such as which limb a wound is on. */
  seed?: number;
  /** Height multiplier on top of the build (a tall drover, a short tinker). */
  stature?: number;
}

/** What the sim knows about a person's body and mind; drives gait, posture and marks. */
export interface Condition {
  health: number;
  nerve: number;
  wounded?: boolean;
  sick?: boolean;
  /** Fogsick stage, 0..3 */
  fog?: number;
  dying?: boolean;
}

export type Mood = "calm" | "afraid" | "angry" | "pleading" | "sly" | "grieving" | "cold";
export type Gesture = "none" | "point" | "beckon" | "shrug" | "raise-hands" | "clutch" | "kneel" | "draw-weapon" | "offer" | "turn-away";
export type Pose = "stand" | "walk" | "sit" | "kneel" | "lie" | "aim" | "cower" | "reach" | "hunch";

const PALE = new THREE.Color(0xc9c6bc);

export class Figure {
  root = new THREE.Group();
  body = new THREE.Group();
  private hips = new THREE.Group();
  private torso = new THREE.Group();
  private head = new THREE.Group();
  private legL: THREE.Group;
  private legR: THREE.Group;
  private armL: THREE.Group;
  private armR: THREE.Group;
  private eyes: THREE.Mesh[] = [];
  private eyeMat: THREE.MeshBasicMaterial;
  private ring: THREE.Mesh;
  private ringMat: THREE.MeshBasicMaterial;
  private tint: THREE.MeshStandardMaterial[] = [];
  private shadow: THREE.Mesh;
  private skinMat: THREE.MeshStandardMaterial;
  private skinBase: THREE.Color;
  private slots: { rifle?: THREE.Object3D; lantern?: THREE.Object3D; glow: THREE.Mesh[] } = { glow: [] };
  private wraps: { head: THREE.Object3D; arm: THREE.Object3D; leg: THREE.Object3D[]; chest: THREE.Object3D };
  readonly heightScale: number;
  readonly seed: number;
  readonly look: Look;
  pose: Pose = "stand";
  /** Set by the conversation director; wins over `pose`, which the caravan rewrites every frame. */
  poseOverride: Pose | null = null;
  mood: Mood = "calm";
  gesture: Gesture = "none";
  /** True while this person has the floor: a small nod and hand movement. */
  talking = false;
  private yawOffCur = 0;
  private gestureT = 0;
  torch: Flame | null = null;
  rifle: THREE.Object3D | null = null;
  phase = Math.random() * 10;
  speed = 0;
  yaw = 0;
  targetYaw = 0;
  /** 0..1 blend toward the lying pose, so deaths fall rather than snap. */
  private down = 0;
  private hurtFlash = 0;
  private ringKind: "none" | "select" | "dying" | "focus" = "none";
  eyeGlow = 0;
  fade = 1;
  private fadeMats: THREE.Material[] = [];
  // Body state, derived by setCondition.
  private limp = 0;
  private limpSide = 1;
  private stagger = 0;
  private hunch = 0;
  private sickness = 0;
  private pallor = 0;
  private stoop = 0;
  private brisk = 0;
  private woundSite = 0;

  constructor(look: Look) {
    this.look = look;
    this.seed = look.seed ?? 0;
    const s =
      look.build === "child" ? 0.72 : look.build === "slight" ? 0.94 : look.build === "broad" ? 1.06 : look.build === "long" ? 2.5 : look.build === "gaunt" ? 1.08 : 1;
    const ageScale = look.age === "child" ? 0.96 : look.age === "old" ? 0.97 : 1;
    this.heightScale = s * ageScale * (look.stature ?? 1);
    this.stoop = look.age === "old" ? 0.16 : look.age === "middle" ? 0.05 : 0;
    this.limpSide = this.seed % 2 === 0 ? 1 : -1;
    this.woundSite = Math.abs(this.seed >> 1) % 3;
    const wide = look.build === "broad" ? 1.2 : look.build === "gaunt" || look.build === "long" ? 0.78 : look.build === "slight" ? 0.92 : 1;
    const coat = this.own(mat(look.coat));
    const trousers = this.own(mat(look.trousers));
    const skin = this.own(mat(look.skin, 0.7));
    this.skinMat = skin;
    this.skinBase = new THREE.Color(look.skin);
    const accent = this.own(mat(look.accent, 0.8));
    const dark = this.own(mat(0x0b0908));

    this.hips.position.y = 0.95;
    this.legL = limb(0.95, 0.085 * wide, trousers);
    this.legR = limb(0.95, 0.085 * wide, trousers);
    this.legL.position.x = -0.12 * wide;
    this.legR.position.x = 0.12 * wide;
    for (const leg of [this.legL, this.legR]) {
      const boot = new THREE.Mesh(gbox(0.14, 0.12, 0.26), dark);
      boot.position.set(0, -0.92, 0.05);
      leg.add(boot);
    }
    const chest = new THREE.Mesh(gcyl(0.21 * wide, 0.26 * wide, 0.68, 7), coat);
    chest.position.y = 0.34;
    this.torso.add(chest);
    if (look.longCoat) {
      const skirtMat = coat.clone();
      skirtMat.side = THREE.DoubleSide;
      this.tint.push(skirtMat);
      this.fadeMats.push(skirtMat);
      const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.26 * wide, 0.38 * wide, 0.78, 7, 1, true), skirtMat);
      skirt.position.y = -0.38;
      this.torso.add(skirt);
    }
    const scarf = new THREE.Mesh(gcyl(0.13, 0.19 * wide, 0.12, 7), accent);
    scarf.position.y = 0.68;
    this.torso.add(scarf);
    this.head.position.y = 0.72;
    const skull = new THREE.Mesh(gball(0.135, 8, 6), skin);
    skull.position.y = 0.14;
    skull.scale.set(1, look.hollow ? 1.18 : 1.08, 1);
    this.head.add(skull);
    this.eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 0) });
    for (const x of [-0.05, 0.05]) {
      const e = new THREE.Mesh(gball(0.022, 5, 4), this.eyeMat);
      e.position.set(x, 0.16, 0.12);
      this.eyes.push(e);
      this.head.add(e);
    }
    this.addHat(look, dark, coat);
    this.addHair(look);
    this.addBeard(look);
    this.torso.add(this.head);
    this.armL = limb(0.66, 0.065 * wide, coat);
    this.armR = limb(0.66, 0.065 * wide, coat);
    this.armL.position.set(-0.27 * wide, 0.6, 0);
    this.armR.position.set(0.27 * wide, 0.6, 0);
    for (const arm of [this.armL, this.armR]) {
      const hand = new THREE.Mesh(gball(0.055, 5, 4), skin);
      hand.position.y = -0.68;
      arm.add(hand);
    }
    this.torso.add(this.armL, this.armR);
    this.hips.add(this.legL, this.legR, this.torso);
    this.body.add(this.hips);
    this.body.scale.setScalar(this.heightScale);
    this.root.add(this.body);

    // Role props.
    const rig = { torso: this.torso, armL: this.armL, armR: this.armR, head: this.head, wide, own: (m: THREE.MeshStandardMaterial) => this.own(m), slots: this.slots };
    for (const p of look.props ?? []) addProp(p, rig);

    // Bandages, hidden until the body needs them.
    const cloth = this.own(mat(0xd6cfbc, 0.95));
    const blood = mat(0x6a0c0c, 0.9, 0.3);
    const wrap = (r: number, h: number, stain = true) => {
      const g = new THREE.Group();
      g.add(mesh(gcyl(r, r, h, 7), cloth));
      if (stain) g.add(put(g, mesh(gbox(0.05, h * 0.5, 0.05), blood), 0, 0, r));
      g.visible = false;
      return g;
    };
    const headWrap = wrap(0.142, 0.075);
    put(this.head, headWrap, 0, 0.2, 0, -0.18, 0, 0.12);
    const armWrap = wrap(0.075 * wide, 0.3);
    put(this.armL, armWrap, 0, -0.36, 0);
    const legWraps = [this.legL, this.legR].map((l) => {
      const g = wrap(0.1 * wide, 0.34);
      put(l, g, 0, -0.5, 0);
      return g;
    });
    const chestWrap = wrap(0.27 * wide, 0.3);
    put(this.torso, chestWrap, 0, 0.3, 0);
    this.wraps = { head: headWrap, arm: armWrap, leg: legWraps, chest: chestWrap };

    this.shadow = blobShadow(0.6 * this.heightScale);
    this.root.add(this.shadow);
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0xffa04d, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.68, 28).rotateX(-Math.PI / 2), this.ringMat);
    this.ring.position.y = 0.06;
    this.root.add(this.ring);
    this.setCondition({ health: 90, nerve: 70 });
  }

  /** Materials are cached per colour; clone them so hit flashes and fades stay per-person. */
  private own(m: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
    const c = m.clone();
    this.tint.push(c);
    this.fadeMats.push(c);
    return c;
  }

  private addHat(look: Look, dark: THREE.Material, coat: THREE.Material): void {
    const hat = look.hat;
    const hm = look.hatColor !== undefined ? this.own(mat(look.hatColor, 0.9)) : dark;
    const add = (geo: THREE.BufferGeometry, m: THREE.Material, y: number, z = 0, rx = 0, x = 0) => {
      const me = new THREE.Mesh(geo, m);
      me.position.set(x, y, z);
      me.rotation.x = rx;
      this.head.add(me);
      return me;
    };
    switch (hat) {
      case "wide":
        add(gcyl(0.34, 0.34, 0.025, 12), hm, 0.23);
        add(gcyl(0.13, 0.15, 0.17, 8), hm, 0.32);
        break;
      case "tall":
        add(gcyl(0.26, 0.26, 0.02, 10), hm, 0.23);
        add(gcyl(0.12, 0.13, 0.34, 8), hm, 0.4);
        break;
      case "hood":
        add(new THREE.SphereGeometry(0.19, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.62), coat, 0.13, -0.02, -0.2);
        add(new THREE.ConeGeometry(0.28, 0.5, 8, 1, true), coat, -0.08, -0.02);
        break;
      case "cap":
        add(new THREE.SphereGeometry(0.15, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.5), hm, 0.18);
        add(gbox(0.2, 0.02, 0.14), hm, 0.19, 0.13);
        break;
      case "furcap": {
        // A squat fur hat with a tail down the back: reads as a lump against the sky.
        const fur = this.own(mat(look.hatColor ?? 0x5a4028, 0.98));
        const dome = add(new THREE.SphereGeometry(0.19, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.62), fur, 0.15, 0, 0);
        dome.scale.set(1.05, 0.9, 1.12);
        add(gbox(0.06, 0.16, 0.05), fur, 0.14, 0.02, 0, -0.19);
        add(gbox(0.06, 0.16, 0.05), fur, 0.14, 0.02, 0, 0.19);
        const tail = add(gcyl(0.03, 0.045, 0.3, 5), fur, 0.02, -0.2, 0.25);
        tail.scale.set(1, 1, 1);
        break;
      }
      case "bonnet":
        add(new THREE.SphereGeometry(0.18, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), look.hatColor !== undefined ? hm : coat, 0.15, -0.04, -0.5);
        add(new THREE.TorusGeometry(0.16, 0.035, 5, 12, Math.PI), look.hatColor !== undefined ? hm : coat, 0.16, 0.06, 0);
        break;
      case "bare":
        // People with an explicit hair description grow their own; the rest keep the old dark scalp.
        if (!look.hair) add(new THREE.SphereGeometry(0.145, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.45), dark, 0.16, -0.02, -0.25);
        break;
    }
  }

  private addHair(look: Look): void {
    const h = look.hair;
    if (!h || h.style === "none") return;
    const hm = this.own(mat(h.color, 0.95));
    const covered = look.hat !== "bare";
    const covering = look.hat === "hood";
    if (covering) return;
    const add = (geo: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, sx = 1, sy = 1, sz = 1) => {
      const me = new THREE.Mesh(geo, hm);
      me.position.set(x, y, z);
      me.rotation.x = rx;
      me.scale.set(sx, sy, sz);
      this.head.add(me);
    };
    const cap = () => add(new THREE.SphereGeometry(0.146, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.5), 0, 0.155, -0.012, -0.22);
    switch (h.style) {
      case "short":
        if (!covered) cap();
        break;
      case "wild":
        if (!covered) add(new THREE.IcosahedronGeometry(0.19, 0), 0, 0.2, -0.02, 0, 1, 0.9, 1);
        else add(gbox(0.3, 0.16, 0.12), 0, 0.08, -0.08);
        break;
      case "long":
        if (!covered) cap();
        add(gbox(0.27, 0.42, 0.09), 0, -0.02, -0.11);
        add(gbox(0.04, 0.3, 0.07), -0.135, 0.02, -0.02);
        add(gbox(0.04, 0.3, 0.07), 0.135, 0.02, -0.02);
        break;
      case "bun":
        if (!covered) cap();
        add(gball(0.075, 6, 5), 0, 0.23, -0.12);
        break;
      case "braid":
        if (!covered) cap();
        add(gcyl(0.035, 0.028, 0.5, 5), 0, -0.14, -0.15);
        add(gbox(0.06, 0.03, 0.06), 0, -0.36, -0.15);
        break;
    }
  }

  private addBeard(look: Look): void {
    const b = look.beard;
    if (!b || b.style === "none" || look.hollow) return;
    const bm = this.own(mat(b.color, 0.98));
    const add = (geo: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, sx = 1, sy = 1, sz = 1) => {
      const me = new THREE.Mesh(geo, bm);
      me.position.set(x, y, z);
      me.rotation.x = rx;
      me.scale.set(sx, sy, sz);
      this.head.add(me);
    };
    switch (b.style) {
      case "stubble":
        add(new THREE.SphereGeometry(0.139, 8, 4, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.42), 0, 0.14, 0, 0, 1, 1.08, 1);
        break;
      case "short":
        add(gball(0.115, 7, 5), 0, 0.045, 0.045, 0, 1, 0.9, 1);
        break;
      case "full":
        add(gball(0.13, 7, 5), 0, 0.02, 0.05, 0, 1, 1.1, 1);
        add(gbox(0.14, 0.04, 0.05), 0, 0.09, 0.125);
        break;
      case "long":
        add(gball(0.13, 7, 5), 0, 0.02, 0.05, 0, 1, 1.1, 1);
        add(new THREE.ConeGeometry(0.115, 0.42, 6), 0, -0.19, 0.06, Math.PI);
        break;
      case "goatee":
        add(new THREE.ConeGeometry(0.05, 0.16, 5), 0, -0.03, 0.11, Math.PI);
        break;
      case "mustache":
        add(gbox(0.15, 0.03, 0.05), 0, 0.09, 0.125);
        break;
    }
  }

  private holder: THREE.Group | null = null;

  holdTorch(flame: Flame | null): void {
    if (this.holder) this.armR.remove(this.holder);
    this.holder = null;
    this.torch = flame;
    if (this.slots.lantern) this.slots.lantern.visible = !flame;
    if (!flame) return;
    const holder = new THREE.Group();
    const stick = new THREE.Mesh(gcyl(0.025, 0.035, 0.9, 5), mat(0x2a1a10));
    stick.position.y = 0.2;
    holder.add(stick);
    flame.group.position.y = 0.66;
    holder.add(flame.group);
    holder.position.y = -0.62;
    this.holder = holder;
    this.armR.add(holder);
  }

  holdRifle(on: boolean): void {
    // A hunter's rifle rides on the back until it is needed.
    if (this.slots.rifle) {
      this.slots.rifle.visible = !on;
    }
    if (on && !this.rifle) {
      const r = new THREE.Mesh(gbox(0.05, 0.05, 1.1), mat(0x1a1410));
      r.position.set(0, -0.6, 0.35);
      this.rifle = r;
      this.armR.add(r);
    } else if (!on && this.rifle) {
      this.armR.remove(this.rifle);
      this.rifle = null;
    }
  }

  /** Set how this person carries themself. Kneel and draw-weapon also change the whole pose. */
  setExpression(mood: Mood, gesture: Gesture = "none", talking = false): void {
    if (gesture !== this.gesture) this.gestureT = 0;
    this.mood = mood;
    this.gesture = gesture;
    this.talking = talking;
    this.poseOverride = gesture === "kneel" ? "kneel" : null;
    const armed = gesture === "draw-weapon";
    if (armed !== this.drawn) {
      this.drawn = armed;
      this.holdRifle(armed);
    }
  }

  private drawn = false;

  setRing(kind: "none" | "select" | "dying" | "focus"): void {
    this.ringKind = kind;
    this.ringMat.color.set(kind === "dying" ? 0xff2a2a : kind === "focus" ? 0xfff0d0 : 0xffa04d);
  }

  hurt(): void {
    this.hurtFlash = 1;
  }

  /** Read the body and mind off the sim: gait, posture, bandages and pallor follow. */
  setCondition(c: Condition): void {
    const hp = Math.max(0, Math.min(100, c.health));
    const nerve = Math.max(0, Math.min(100, c.nerve));
    const site = this.woundSite;
    const wounded = !!c.wounded || !!c.dying;
    this.limp = Math.min(1, (wounded && (site === 2 || c.dying) ? 0.85 : wounded ? 0.3 : 0) + Math.max(0, (55 - hp) / 55) * 0.7);
    this.stagger = Math.max(0, (32 - hp) / 32) * 0.9 + (nerve < 12 ? 0.25 : 0);
    this.sickness = c.sick ? 1 : 0;
    this.hunch = Math.min(1, (c.sick ? 0.55 : 0) + (nerve < 25 ? 0.85 : nerve < 45 ? 0.45 : 0) + (1 - hp / 100) * 0.55 + (c.fog ?? 0) * 0.12);
    this.brisk = hp > 70 && nerve > 60 ? 1 : 0;
    this.pallor = Math.min(0.85, (c.sick ? 0.4 : 0) + (c.fog ?? 0) * 0.28 + Math.max(0, (60 - hp) / 60) * 0.5 + (c.dying ? 0.3 : 0));
    this.skinMat.color.copy(this.skinBase).lerp(PALE, this.pallor);
    this.wraps.head.visible = wounded && (site === 0 || !!c.dying);
    this.wraps.arm.visible = wounded && (site === 1 || !!c.dying);
    this.wraps.leg[0].visible = wounded && (site === 2 || !!c.dying) && this.limpSide > 0;
    this.wraps.leg[1].visible = wounded && (site === 2 || !!c.dying) && this.limpSide < 0;
    this.wraps.chest.visible = !!c.dying;
  }

  setFade(v: number): void {
    this.fade = v;
    const t = v < 0.999;
    for (const m of this.fadeMats) {
      m.transparent = t;
      m.opacity = v;
    }
    for (const g of this.slots.glow) g.visible = v > 0.5;
    this.shadow.visible = v > 0.3;
  }

  get position(): THREE.Vector3 {
    return this.root.position;
  }

  update(dt: number, time: number): void {
    const pose = this.poseOverride ?? this.pose;
    this.yaw = this.yaw + wrapAngle(this.targetYaw - this.yaw) * (1 - Math.exp(-8 * dt));
    this.root.rotation.y = this.yaw;
    const walking = pose === "walk" || (this.speed > 0.2 && pose !== "lie" && pose !== "sit");
    const hurtGait = 1 - this.limp * 0.3 - this.stagger * 0.25;
    if (walking) this.phase += (dt * Math.max(this.speed, 0.8) * 3.2 * hurtGait) / this.heightScale;
    const swing = walking ? Math.sin(this.phase) : 0;
    const amt = walking ? Math.min(1, 0.35 + this.speed * 0.25) * (1 - this.hunch * 0.25) : 0;

    // A limp shortens the stride on the bad leg and drops the body onto it.
    const badL = this.limpSide > 0 ? 0 : 1;
    const legScaleL = badL ? 1 - this.limp * 0.6 : 1 + this.limp * 0.12;
    const legScaleR = badL ? 1 + this.limp * 0.12 : 1 - this.limp * 0.6;
    let hipsY = 0.95;
    let lean = this.stoop - this.brisk * 0.03 + this.hunch * 0.42;
    let legL = swing * 0.55 * amt * legScaleL;
    let legR = -swing * 0.55 * amt * legScaleR;
    const armAmt = 1 - this.hunch * 0.5;
    let armL = -swing * 0.45 * amt * armAmt;
    let armR = swing * 0.45 * amt * armAmt;
    let armLz = 0.08 - this.hunch * 0.05;
    let armRz = -0.08 + this.hunch * 0.05;
    let headX = this.hunch * 0.5 - this.brisk * 0.03;
    let roll = 0;
    switch (pose) {
      case "sit":
        hipsY = 0.5;
        legL = legR = -1.45;
        armL = armR = -0.5;
        lean += 0.1;
        break;
      case "kneel":
        hipsY = 0.62;
        legL = -1.4;
        legR = 0.2;
        lean += 0.25;
        armL = armR = -0.3;
        break;
      case "aim":
        armR = -1.5;
        armL = -1.35;
        armLz = 0.45;
        lean += 0.08;
        break;
      case "cower":
        hipsY = 0.75;
        lean += 0.5;
        armL = armR = -2.3;
        armLz = 0.5;
        armRz = -0.5;
        headX += 0.3;
        break;
      case "reach":
        armL = armR = -1.2;
        lean += 0.15;
        break;
      case "hunch":
        lean += 0.35;
        headX += 0.35;
        armL = armR = 0.1;
        break;
      default:
        break;
    }
    if (this.torch && pose !== "lie") {
      armR = walking ? -1.55 + swing * 0.08 : -1.75;
      armRz = -0.2;
    }
    if (pose !== "walk" && pose !== "lie" && !walking) {
      // Breathing.
      lean += Math.sin(time * 1.3 + this.phase) * 0.015;
    }
    if (pose !== "lie") {
      if (walking && this.limp > 0.02) {
        // Weight comes down on the bad leg: the hips drop and the shoulders roll toward it.
        const planted = Math.max(0, Math.sin(this.phase + (badL ? Math.PI : 0)));
        hipsY -= this.limp * 0.07 * planted;
        roll += this.limpSide * -this.limp * 0.13 * (planted - 0.35);
      }
      if (this.stagger > 0.02) {
        roll += (Math.sin(time * 1.7 + this.seed) + Math.sin(time * 2.9 + this.seed * 2) * 0.6) * 0.09 * this.stagger;
        lean += Math.max(0, Math.sin(time * 0.8 + this.seed)) * 0.12 * this.stagger;
        headX += Math.sin(time * 1.1 + this.seed) * 0.12 * this.stagger;
        hipsY -= 0.04 * this.stagger;
      }
      if (this.sickness > 0) {
        // A cough now and then doubles them over.
        const c = Math.pow(Math.max(0, Math.sin(time * 0.65 + this.seed * 1.7)), 14);
        lean += c * 0.35 + Math.sin(time * 34) * c * 0.03;
        headX += c * 0.25;
      }
    }
    // Conversation: mood sets the resting posture, gesture the hands. Only for people who are
    // not mid-stride, so a walking caravan is never disturbed.
    let headZ = 0;
    let headY = 0;
    let yawOff = 0;
    if (!walking && pose !== "lie") {
      this.gestureT += dt;
      const g = this.gesture;
      const gt = this.gestureT;
      switch (this.mood) {
        case "afraid":
          lean += 0.06;
          headX += 0.12;
          armL = armR = -0.35;
          armLz = 0.32;
          armRz = -0.32;
          headY = Math.sin(time * 1.9 + this.seed) * 0.25;
          lean += Math.sin(time * 27 + this.seed) * 0.008;
          break;
        case "angry":
          lean += 0.1;
          headX += 0.14;
          armL = armR = -0.45;
          armLz = 0.35;
          armRz = -0.35;
          break;
        case "pleading":
          lean += 0.14;
          headX += 0.18;
          armL = armR = -0.95;
          armLz = 0.5;
          armRz = -0.5;
          break;
        case "sly":
          lean -= 0.05;
          headZ = 0.22;
          headX -= 0.05;
          armL = -0.15;
          armR = -0.9;
          armRz = -0.25;
          break;
        case "grieving":
          lean += 0.22;
          headX += 0.45;
          armL = armR = 0.08;
          break;
        case "cold":
          lean -= 0.04;
          headX -= 0.06;
          armL = armR = 0;
          armLz = 0.02;
          armRz = -0.02;
          break;
        default:
          break;
      }
      switch (g) {
        case "point":
          armR = -1.5 + Math.sin(gt * 5) * 0.05;
          armRz = -0.05;
          lean += 0.05;
          break;
        case "beckon":
          armR = -1.15 + Math.sin(gt * 7) * 0.32;
          armRz = -0.2;
          break;
        case "shrug":
          armL = armR = -0.35;
          armLz = 0.75;
          armRz = -0.75;
          headZ = 0.2;
          hipsY -= 0.01;
          break;
        case "raise-hands":
          armL = armR = -2.5;
          armLz = 0.25;
          armRz = -0.25;
          headX -= 0.08;
          break;
        case "clutch":
          armL = armR = -1.15;
          armLz = 0.75;
          armRz = -0.75;
          lean += 0.18;
          headX += 0.15;
          break;
        case "kneel":
          armL = armR = -0.85;
          armLz = 0.4;
          armRz = -0.4;
          headX += 0.2;
          break;
        case "draw-weapon":
          armR = -1.5;
          armL = -1.35;
          armLz = 0.45;
          lean += 0.06;
          break;
        case "offer":
          armL = armR = -1.25;
          armLz = 0.18;
          armRz = -0.18;
          lean += 0.06;
          break;
        case "turn-away":
          yawOff = 2.3;
          headY = -1.0;
          lean += 0.05;
          break;
        default:
          break;
      }
      if (this.talking) {
        headX += Math.abs(Math.sin(time * 8.5)) * 0.045;
        if (g === "none") {
          armR += Math.sin(time * 3.1) * 0.09;
          armL += Math.sin(time * 2.3 + 1) * 0.06;
        }
      }
    }
    this.yawOffCur += (yawOff - this.yawOffCur) * (1 - Math.exp(-6 * dt));
    this.root.rotation.y = this.yaw + this.yawOffCur;
    const k = 1 - Math.exp(-10 * dt);
    this.hips.position.y += (hipsY + (walking ? Math.abs(Math.cos(this.phase)) * 0.04 * (1 - this.limp * 0.5) : 0) - this.hips.position.y) * k;
    this.legL.rotation.x += (legL - this.legL.rotation.x) * k;
    this.legR.rotation.x += (legR - this.legR.rotation.x) * k;
    this.armL.rotation.x += (armL - this.armL.rotation.x) * k;
    this.armR.rotation.x += (armR - this.armR.rotation.x) * k;
    this.armL.rotation.z += (armLz - this.armL.rotation.z) * k;
    this.armR.rotation.z += (armRz - this.armR.rotation.z) * k;
    this.torso.rotation.x += (lean - this.torso.rotation.x) * k;
    this.torso.rotation.z += (roll - this.torso.rotation.z) * k;
    // Keep a held torch upright whatever the arm is doing.
    if (this.holder) this.holder.rotation.x = -this.armR.rotation.x - this.torso.rotation.x - 0.12;
    this.head.rotation.x += (headX - this.head.rotation.x) * k;
    this.head.rotation.z += (headZ - this.head.rotation.z) * k;
    this.head.rotation.y += (headY - this.head.rotation.y) * k;

    this.down = damp(this.down, pose === "lie" ? 1 : 0, 4, dt);
    this.body.rotation.x = -this.down * Math.PI * 0.5;
    this.body.position.y = this.down * 0.18 * this.heightScale;
    this.body.position.z = this.down * 0.9 * this.heightScale;

    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2.5);
    for (const m of this.tint) m.emissive.setRGB(this.hurtFlash * 0.9, 0, 0);
    this.eyeMat.color.setRGB(this.eyeGlow * 3, this.eyeGlow * 0.25, this.eyeGlow * 0.15);
    const es = 1 + this.eyeGlow * 1.6;
    for (const e of this.eyes) e.scale.setScalar(es);

    const ringTarget = this.ringKind === "none" ? 0 : this.ringKind === "dying" ? 0.45 + 0.35 * Math.sin(time * 5) : 0.8;
    this.ringMat.opacity = damp(this.ringMat.opacity, ringTarget * this.fade, 8, dt);
  }
}

export function wrapAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}


// Rigged low-poly actors: people, wagons, oxen. Silhouette first: the concept
// art reads as dark shapes against a burning sky, so shapes carry identity and
// colour is a secondary cue. Local forward is +z; yaw = atan2(dx, dz).

import * as THREE from "three";
import { Flame, blobShadow } from "./fx.ts";
import { keep } from "./dispose.ts";
import { damp } from "./noise.ts";

const matCache = new Map<string, THREE.MeshStandardMaterial>();
function mat(hex: number, rough = 0.85): THREE.MeshStandardMaterial {
  const key = `${hex}:${rough}`;
  let m = matCache.get(key);
  if (!m) {
    m = keep(new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: 0, flatShading: true }));
    matCache.set(key, m);
  }
  return m;
}

export type Hat = "wide" | "hood" | "cap" | "bonnet" | "bare" | "tall";
export type Build = "normal" | "broad" | "slight" | "child" | "gaunt" | "long";

export interface Look {
  hat: Hat;
  coat: number;
  trousers: number;
  accent: number;
  skin: number;
  build: Build;
  longCoat?: boolean;
  hollow?: boolean;
}

export type Pose = "stand" | "walk" | "sit" | "kneel" | "lie" | "aim" | "cower" | "reach" | "hunch";

function limb(len: number, r: number, m: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.85, r, len, 5), m);
  mesh.position.y = -len / 2;
  g.add(mesh);
  return g;
}

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
  readonly heightScale: number;
  pose: Pose = "stand";
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

  constructor(look: Look) {
    const s =
      look.build === "child" ? 0.72 : look.build === "slight" ? 0.94 : look.build === "broad" ? 1.06 : look.build === "long" ? 2.5 : look.build === "gaunt" ? 1.08 : 1;
    this.heightScale = s;
    const wide = look.build === "broad" ? 1.2 : look.build === "gaunt" || look.build === "long" ? 0.78 : 1;
    const coat = this.own(mat(look.coat));
    const trousers = this.own(mat(look.trousers));
    const skin = this.own(mat(look.skin, 0.7));
    const accent = this.own(mat(look.accent, 0.8));
    const dark = this.own(mat(0x0b0908));

    this.hips.position.y = 0.95;
    this.legL = limb(0.95, 0.085 * wide, trousers);
    this.legR = limb(0.95, 0.085 * wide, trousers);
    this.legL.position.x = -0.12 * wide;
    this.legR.position.x = 0.12 * wide;
    for (const leg of [this.legL, this.legR]) {
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.26), dark);
      boot.position.set(0, -0.92, 0.05);
      leg.add(boot);
    }
    const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.21 * wide, 0.26 * wide, 0.68, 7), coat);
    chest.position.y = 0.34;
    this.torso.add(chest);
    if (look.longCoat) {
      const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.26 * wide, 0.38 * wide, 0.78, 7, 1, true), coat);
      skirt.position.y = -0.38;
      (skirt.material as THREE.Material).side = THREE.DoubleSide;
      this.torso.add(skirt);
    }
    const scarf = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.19 * wide, 0.12, 7), accent);
    scarf.position.y = 0.68;
    this.torso.add(scarf);
    this.head.position.y = 0.72;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.135, 8, 6), skin);
    skull.position.y = 0.14;
    skull.scale.set(1, look.hollow ? 1.18 : 1.08, 1);
    this.head.add(skull);
    this.eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 0) });
    for (const x of [-0.05, 0.05]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.022, 5, 4), this.eyeMat);
      e.position.set(x, 0.16, 0.12);
      this.eyes.push(e);
      this.head.add(e);
    }
    this.addHat(look.hat, dark, coat);
    this.torso.add(this.head);
    this.armL = limb(0.66, 0.065 * wide, coat);
    this.armR = limb(0.66, 0.065 * wide, coat);
    this.armL.position.set(-0.27 * wide, 0.6, 0);
    this.armR.position.set(0.27 * wide, 0.6, 0);
    for (const arm of [this.armL, this.armR]) {
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 5, 4), skin);
      hand.position.y = -0.68;
      arm.add(hand);
    }
    this.torso.add(this.armL, this.armR);
    this.hips.add(this.legL, this.legR, this.torso);
    this.body.add(this.hips);
    this.body.scale.setScalar(s);
    this.root.add(this.body);

    this.shadow = blobShadow(0.6 * s);
    this.root.add(this.shadow);
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0xffa04d, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.68, 28).rotateX(-Math.PI / 2), this.ringMat);
    this.ring.position.y = 0.06;
    this.root.add(this.ring);
  }

  /** Materials are cached per colour; clone them so hit flashes stay per-person. */
  private own(m: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
    const c = m.clone();
    this.tint.push(c);
    this.fadeMats.push(c);
    return c;
  }

  private addHat(hat: Hat, dark: THREE.Material, coat: THREE.Material): void {
    const add = (geo: THREE.BufferGeometry, m: THREE.Material, y: number, z = 0, rx = 0) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(0, y, z);
      mesh.rotation.x = rx;
      this.head.add(mesh);
    };
    switch (hat) {
      case "wide":
        add(new THREE.CylinderGeometry(0.34, 0.34, 0.025, 12), dark, 0.23);
        add(new THREE.CylinderGeometry(0.13, 0.15, 0.17, 8), dark, 0.32);
        break;
      case "tall":
        add(new THREE.CylinderGeometry(0.26, 0.26, 0.02, 10), dark, 0.23);
        add(new THREE.CylinderGeometry(0.12, 0.13, 0.34, 8), dark, 0.4);
        break;
      case "hood":
        add(new THREE.SphereGeometry(0.19, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.62), coat, 0.13, -0.02, -0.2);
        add(new THREE.ConeGeometry(0.28, 0.5, 8, 1, true), coat, -0.08, -0.02);
        break;
      case "cap":
        add(new THREE.SphereGeometry(0.15, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.5), dark, 0.18);
        add(new THREE.BoxGeometry(0.2, 0.02, 0.14), dark, 0.19, 0.13);
        break;
      case "bonnet":
        add(new THREE.SphereGeometry(0.18, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), coat, 0.15, -0.04, -0.5);
        add(new THREE.TorusGeometry(0.16, 0.035, 5, 12, Math.PI), coat, 0.16, 0.06, 0);
        break;
      case "bare":
        add(new THREE.SphereGeometry(0.145, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.45), dark, 0.16, -0.02, -0.25);
        break;
    }
  }

  private holder: THREE.Group | null = null;

  holdTorch(flame: Flame | null): void {
    if (this.holder) this.armR.remove(this.holder);
    this.holder = null;
    this.torch = flame;
    if (!flame) return;
    const holder = new THREE.Group();
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.9, 5), mat(0x2a1a10));
    stick.position.y = 0.2;
    holder.add(stick);
    flame.group.position.y = 0.66;
    holder.add(flame.group);
    holder.position.y = -0.62;
    this.holder = holder;
    this.armR.add(holder);
  }

  holdRifle(on: boolean): void {
    if (on && !this.rifle) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 1.1), mat(0x1a1410));
      r.position.set(0, -0.6, 0.35);
      this.rifle = r;
      this.armR.add(r);
    } else if (!on && this.rifle) {
      this.armR.remove(this.rifle);
      this.rifle = null;
    }
  }

  setRing(kind: "none" | "select" | "dying" | "focus"): void {
    this.ringKind = kind;
    this.ringMat.color.set(kind === "dying" ? 0xff2a2a : kind === "focus" ? 0xfff0d0 : 0xffa04d);
  }

  hurt(): void {
    this.hurtFlash = 1;
  }

  setFade(v: number): void {
    this.fade = v;
    const t = v < 0.999;
    for (const m of this.fadeMats) {
      m.transparent = t;
      m.opacity = v;
    }
    this.shadow.visible = v > 0.3;
  }

  get position(): THREE.Vector3 {
    return this.root.position;
  }

  update(dt: number, time: number): void {
    this.yaw = this.yaw + wrapAngle(this.targetYaw - this.yaw) * (1 - Math.exp(-8 * dt));
    this.root.rotation.y = this.yaw;
    const walking = this.pose === "walk" || (this.speed > 0.2 && this.pose !== "lie" && this.pose !== "sit");
    if (walking) this.phase += dt * Math.max(this.speed, 0.8) * 3.2 / this.heightScale;
    const swing = walking ? Math.sin(this.phase) : 0;
    const amt = walking ? Math.min(1, 0.35 + this.speed * 0.25) : 0;

    let hipsY = 0.95;
    let lean = 0;
    let legL = swing * 0.55 * amt;
    let legR = -swing * 0.55 * amt;
    let armL = -swing * 0.45 * amt;
    let armR = swing * 0.45 * amt;
    let armLz = 0.08;
    let armRz = -0.08;
    let headX = 0;
    switch (this.pose) {
      case "sit":
        hipsY = 0.5;
        legL = legR = -1.45;
        armL = armR = -0.5;
        lean = 0.1;
        break;
      case "kneel":
        hipsY = 0.62;
        legL = -1.4;
        legR = 0.2;
        lean = 0.25;
        armL = armR = -0.3;
        break;
      case "aim":
        armR = -1.5;
        armL = -1.35;
        armLz = 0.45;
        lean = 0.08;
        break;
      case "cower":
        hipsY = 0.75;
        lean = 0.5;
        armL = armR = -2.3;
        armLz = 0.5;
        armRz = -0.5;
        headX = 0.3;
        break;
      case "reach":
        armL = armR = -1.2;
        lean = 0.15;
        break;
      case "hunch":
        lean = 0.35;
        headX = 0.35;
        armL = armR = 0.1;
        break;
      default:
        break;
    }
    if (this.torch && this.pose !== "lie") {
      armR = walking ? -1.55 + swing * 0.08 : -1.75;
      armRz = -0.2;
    }
    if (this.pose !== "walk" && this.pose !== "lie" && !walking) {
      // Breathing.
      lean += Math.sin(time * 1.3 + this.phase) * 0.015;
    }
    const k = 1 - Math.exp(-10 * dt);
    this.hips.position.y += (hipsY + (walking ? Math.abs(Math.cos(this.phase)) * 0.04 : 0) - this.hips.position.y) * k;
    this.legL.rotation.x += (legL - this.legL.rotation.x) * k;
    this.legR.rotation.x += (legR - this.legR.rotation.x) * k;
    this.armL.rotation.x += (armL - this.armL.rotation.x) * k;
    this.armR.rotation.x += (armR - this.armR.rotation.x) * k;
    this.armL.rotation.z += (armLz - this.armL.rotation.z) * k;
    this.armR.rotation.z += (armRz - this.armR.rotation.z) * k;
    this.torso.rotation.x += (lean - this.torso.rotation.x) * k;
    // Keep a held torch upright whatever the arm is doing.
    if (this.holder) this.holder.rotation.x = -this.armR.rotation.x - this.torso.rotation.x - 0.12;
    this.head.rotation.x += (headX - this.head.rotation.x) * k;

    this.down = damp(this.down, this.pose === "lie" ? 1 : 0, 4, dt);
    this.body.rotation.x = -this.down * Math.PI * 0.5;
    this.body.position.y = this.down * 0.18 * this.heightScale;
    this.body.position.z = this.down * 0.9 * this.heightScale;

    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2.5);
    for (const m of this.tint) m.emissive.setRGB(this.hurtFlash * 0.9, 0, 0);
    this.eyeMat.color.setRGB(this.eyeGlow * 3, this.eyeGlow * 0.25, this.eyeGlow * 0.15);

    const ringTarget = this.ringKind === "none" ? 0 : this.ringKind === "dying" ? 0.45 + 0.35 * Math.sin(time * 5) : 0.8;
    this.ringMat.opacity = damp(this.ringMat.opacity, ringTarget * this.fade, 8, dt);
  }
}

export function wrapAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// ---------------------------------------------------------------------------
// Wagon
// ---------------------------------------------------------------------------

export class Wagon {
  root = new THREE.Group();
  private tilt = new THREE.Group();
  wheels: { g: THREE.Group; r: number }[] = [];
  torches: Flame[] = [];
  canvasMat: THREE.MeshStandardMaterial;
  lantern = 0;
  private wobbleSeed = Math.random() * 10;
  condition = 1;

  constructor() {
    const wood = mat(0x2c1d12);
    const darkWood = mat(0x1a120c);
    const iron = mat(0x141414, 0.6);
    this.canvasMat = new THREE.MeshStandardMaterial({ color: 0x9a9286, roughness: 0.95, flatShading: true, side: THREE.DoubleSide });
    const add = (m: THREE.Mesh, x: number, y: number, z: number) => {
      m.position.set(x, y, z);
      this.tilt.add(m);
      return m;
    };
    add(new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.16, 4.2), wood), 0, 0.95, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 4.2), darkWood), -0.85, 1.25, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 4.2), darkWood), 0.85, 1.25, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 0.08), darkWood), 0, 1.25, -2.1);
    add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.5), wood), 0, 1.55, 2.25);
    // Canvas bonnet: the top half of a cylinder along z, with hoops.
    const cover = new THREE.CylinderGeometry(1.02, 1.02, 3.9, 12, 1, true, Math.PI / 2, Math.PI);
    cover.rotateX(Math.PI / 2);
    const canvas = new THREE.Mesh(cover, this.canvasMat);
    canvas.scale.set(0.9, 1.1, 1);
    add(canvas, 0, 1.45, -0.05);
    for (const z of [-1.9, -0.65, 0.65, 1.9]) {
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.93, 0.035, 4, 12, Math.PI), darkWood);
      hoop.scale.set(1, 1.12, 1);
      add(hoop, 0, 1.45, z);
    }
    // Tongue and yoke reaching toward the oxen.
    add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 3.2), darkWood), 0, 0.72, 3.5);
    for (const [z, r, x] of [
      [1.35, 0.52, 0.92],
      [-1.35, 0.66, 0.92],
    ] as const) {
      for (const side of [-1, 1]) {
        const g = new THREE.Group();
        g.position.set(side * x, r, z);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.045, 5, 16), iron);
        rim.rotation.y = Math.PI / 2;
        g.add(rim);
        for (let i = 0; i < 4; i++) {
          const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.04, r * 2, 0.04), wood);
          spoke.rotation.x = (i * Math.PI) / 4;
          g.add(spoke);
        }
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.16, 6), iron);
        hub.rotation.z = Math.PI / 2;
        g.add(hub);
        this.tilt.add(g);
        this.wheels.push({ g, r });
      }
    }
    // Torch poles at the front corners, like the concept art.
    for (const side of [-1, 1]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.6, 5), darkWood);
      pole.position.set(side * 0.95, 1.9, 2.05);
      pole.rotation.z = -side * 0.12;
      this.tilt.add(pole);
      const f = new Flame(0.55, 0.8);
      f.group.position.set(side * 1.05, 2.75, 2.05);
      this.tilt.add(f.group);
      this.torches.push(f);
    }
    this.root.add(this.tilt);
    const sh = blobShadow(2.4);
    sh.scale.set(0.9, 1, 1.5);
    this.root.add(sh);
  }

  roll(distance: number): void {
    for (const w of this.wheels) w.g.rotation.x = distance / w.r;
  }

  update(dt: number, time: number, moving: number): void {
    const bad = 1 - this.condition;
    const wob = (0.01 + bad * 0.05) * moving;
    this.tilt.rotation.z = Math.sin(time * 3.1 + this.wobbleSeed) * wob + bad * 0.04;
    this.tilt.rotation.x = Math.sin(time * 2.3 + this.wobbleSeed) * wob * 0.5;
    this.tilt.position.y = Math.abs(Math.sin(time * 6 + this.wobbleSeed)) * 0.03 * moving;
    this.canvasMat.emissive.setRGB(0.22 * this.lantern, 0.1 * this.lantern, 0.03 * this.lantern);
    for (const t of this.torches) t.update(time);
    void dt;
  }
}

// ---------------------------------------------------------------------------
// Ox
// ---------------------------------------------------------------------------

export class Ox {
  root = new THREE.Group();
  private legs: THREE.Group[] = [];
  private head = new THREE.Group();
  phase = Math.random() * 10;
  lookBack = 0;

  constructor() {
    const hide = mat(0x1c140f);
    const horn = mat(0x8a8070, 0.6);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.46, 1.25, 3, 8), hide);
    body.rotation.x = Math.PI / 2;
    body.scale.set(1, 1, 1.08);
    body.position.y = 1.12;
    this.root.add(body);
    const hump = new THREE.Mesh(new THREE.SphereGeometry(0.42, 7, 5), hide);
    hump.scale.set(0.9, 0.75, 1.1);
    hump.position.set(0, 1.46, 0.55);
    this.root.add(hump);
    this.head.position.set(0, 1.18, 1.08);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 0.55, 6), hide);
    neck.rotation.x = 1.1;
    neck.position.set(0, -0.05, 0.12);
    this.head.add(neck);
    const skull = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.38, 0.62), hide);
    skull.position.set(0, -0.22, 0.42);
    skull.rotation.x = 0.7;
    this.head.add(skull);
    const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.24, 0.2), mat(0x2a211b));
    muzzle.position.set(0, -0.45, 0.66);
    muzzle.rotation.x = 0.7;
    this.head.add(muzzle);
    for (const side of [-1, 1]) {
      const h = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.45, 4), horn);
      h.position.set(side * 0.3, 0.2, 0.05);
      h.rotation.z = -side * 1.1;
      this.head.add(h);
    }
    this.root.add(this.head);
    for (const [x, z] of [
      [-0.3, 0.7],
      [0.3, 0.7],
      [-0.3, -0.7],
      [0.3, -0.7],
    ]) {
      const leg = limb(0.78, 0.075, hide);
      leg.position.set(x, 0.72, z);
      this.legs.push(leg);
      this.root.add(leg);
    }
    const sh = blobShadow(1.2);
    sh.scale.set(0.8, 1, 1.4);
    this.root.add(sh);
  }

  update(dt: number, time: number, moving: number): void {
    this.phase += dt * moving * 4.2;
    this.legs.forEach((l, i) => {
      l.rotation.x = Math.sin(this.phase + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.4 * Math.min(1, moving);
    });
    this.head.rotation.y = damp(this.head.rotation.y, this.lookBack * 1.2, 3, dt);
    this.head.rotation.x = Math.sin(time * 0.7 + this.phase) * 0.05;
  }
}

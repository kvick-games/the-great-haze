// Wagons and oxen. A wagon shows the caravan's state on its body: canvas that
// tears and sags as condition drops, wheels that splay and lose spokes, supplies
// lashed on the roof, sides and tailgate that shrink as they are used up, and a
// cot at the tail for whoever is dying. Oxen strain under a heavy load.

import * as THREE from "three";
import { Flame, blobShadow } from "./fx.ts";
import { damp } from "./noise.ts";
import { gball, gbox, gcyl, geo, limb, mat, mesh, put } from "./gear.ts";

/** How much of each kind of cargo the wagons show (counts are for the whole train). */
export interface Load {
  sacks: number;
  barrels: number;
  crates: number;
  sticks: number;
  wheels: number;
}

const TEAR_COUNT = 9;
const SACK_SLOTS = 5;
const BARREL_SLOTS = 4;
const CRATE_SLOTS = 3;
const STICK_SLOTS = 8;

export const LOAD_SLOTS: Load = { sacks: SACK_SLOTS, barrels: BARREL_SLOTS, crates: CRATE_SLOTS, sticks: STICK_SLOTS, wheels: 2 };

interface WheelPart {
  mount: THREE.Group;
  g: THREE.Group;
  rim: THREE.Mesh;
  spokes: THREE.Mesh[];
  r: number;
  side: number;
  /** Condition below which this wheel is visibly bad. */
  threshold: number;
}

interface Tear {
  root: THREE.Group;
  threshold: number;
}

export class Wagon {
  root = new THREE.Group();
  private tilt = new THREE.Group();
  wheels: WheelPart[] = [];
  torches: Flame[] = [];
  canvasMat: THREE.MeshStandardMaterial;
  private canvas: THREE.Mesh;
  private hoops: THREE.Mesh[] = [];
  private tears: Tear[] = [];
  private sacks: THREE.Object3D[] = [];
  private barrels: THREE.Object3D[] = [];
  private crates: THREE.Object3D[] = [];
  private sticks: THREE.Object3D[] = [];
  private spareWheels: THREE.Object3D[] = [];
  private lash!: THREE.Mesh;
  /** Where a lying person is attached (local to the wagon body). */
  readonly cot = new THREE.Group();
  private cotFrame = new THREE.Group();
  lantern = 0;
  private wobbleSeed = Math.random() * 10;
  condition = 1;
  /** 0..1: the canvas is drawn back at the tail to show someone lying there. */
  hosting = 0;
  private hostAmt = 0;
  private bad = 0;

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
    add(mesh(gbox(1.7, 0.16, 4.2), wood), 0, 0.95, 0);
    add(mesh(gbox(0.08, 0.5, 4.2), darkWood), -0.85, 1.25, 0);
    add(mesh(gbox(0.08, 0.5, 4.2), darkWood), 0.85, 1.25, 0);
    add(mesh(gbox(1.7, 0.5, 0.08), darkWood), 0, 1.25, -2.1);
    add(mesh(gbox(1.5, 0.08, 0.5), wood), 0, 1.55, 2.25);
    // Canvas bonnet: the top half of a cylinder along z, with hoops.
    const cover = geo("wagon-cover", () => {
      const g = new THREE.CylinderGeometry(1.02, 1.02, 3.9, 12, 1, true, Math.PI / 2, Math.PI);
      g.rotateX(Math.PI / 2);
      return g;
    });
    this.canvas = mesh(cover, this.canvasMat);
    this.canvas.scale.set(0.9, 1.1, 1);
    add(this.canvas, 0, 1.45, -0.05);
    const hoopGeo = geo("wagon-hoop", () => new THREE.TorusGeometry(0.93, 0.035, 4, 12, Math.PI));
    for (const z of [-1.9, -0.65, 0.65, 1.9]) {
      const hoop = mesh(hoopGeo, darkWood);
      hoop.scale.set(1, 1.12, 1);
      add(hoop, 0, 1.45, z);
      this.hoops.push(hoop);
    }
    this.buildTears();
    // Tongue and yoke reaching toward the oxen.
    add(mesh(gbox(0.1, 0.1, 3.2), darkWood), 0, 0.72, 3.5);
    const spokeGeo = (r: number) => gbox(0.04, r * 2, 0.04);
    const rimGeo = (r: number) => geo(`rim${r}`, () => new THREE.TorusGeometry(r, 0.045, 5, 16).rotateY(Math.PI / 2));
    const hubGeo = geo("hub", () => new THREE.CylinderGeometry(0.1, 0.1, 0.16, 6).rotateZ(Math.PI / 2));
    let wi = 0;
    for (const [z, r, x] of [
      [1.35, 0.52, 0.92],
      [-1.35, 0.66, 0.92],
    ] as const) {
      for (const side of [-1, 1]) {
        const mount = new THREE.Group();
        mount.position.set(side * x, r, z);
        const g = new THREE.Group();
        const rim = mesh(rimGeo(r), iron);
        g.add(rim);
        const spokes: THREE.Mesh[] = [];
        for (let i = 0; i < 4; i++) {
          const spoke = mesh(spokeGeo(r), wood);
          spoke.rotation.x = (i * Math.PI) / 4;
          g.add(spoke);
          spokes.push(spoke);
        }
        g.add(mesh(hubGeo, iron));
        mount.add(g);
        this.tilt.add(mount);
        this.wheels.push({ mount, g, rim, spokes, r, side, threshold: 0.72 - wi * 0.14 });
        wi++;
      }
    }
    // Torch poles at the front corners, like the concept art.
    for (const side of [-1, 1]) {
      const pole = mesh(gcyl(0.03, 0.04, 1.6, 5), darkWood);
      pole.position.set(side * 0.95, 1.9, 2.05);
      pole.rotation.z = -side * 0.12;
      this.tilt.add(pole);
      const f = new Flame(0.55, 0.8);
      f.group.position.set(side * 1.05, 2.75, 2.05);
      this.tilt.add(f.group);
      this.torches.push(f);
    }
    this.buildCargo();
    this.buildCot();
    this.root.add(this.tilt);
    const sh = blobShadow(2.4);
    sh.scale.set(0.9, 1, 1.5);
    this.root.add(sh);
    this.setLoad({ ...LOAD_SLOTS });
  }

  /** Holes and hanging flaps on the canvas; more show as the wagon wears out. */
  private buildTears(): void {
    let seed = Math.floor(this.wobbleSeed * 1000) + 7;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const holeMat = mat(0x0c0806, 1);
    const flapMat = mat(0x6e675c, 1);
    const holeGeo = geo("tear-hole", () => new THREE.PlaneGeometry(1, 1));
    for (let i = 0; i < TEAR_COUNT; i++) {
      const phi = (0.18 + rnd() * 0.64) * Math.PI;
      const side = i % 2 === 0 ? 1 : -1;
      const z = (rnd() - 0.5) * 3.2;
      const holder = new THREE.Group();
      holder.rotation.z = side > 0 ? phi * 0.5 + 0.1 : Math.PI - (phi * 0.5 + 0.1);
      const face = new THREE.Group();
      face.position.set(1.04, 0, z);
      face.rotation.y = Math.PI / 2;
      const w = 0.35 + rnd() * 0.5;
      const h = 0.25 + rnd() * 0.45;
      const hole = mesh(holeGeo, holeMat);
      hole.scale.set(w, h, 1);
      hole.rotation.z = (rnd() - 0.5) * 1.2;
      (hole.material as THREE.Material).side = THREE.DoubleSide;
      face.add(hole);
      // A flap of cloth hanging from one edge of the hole.
      const flap = mesh(holeGeo, flapMat);
      flap.scale.set(w * 0.5, h * 0.9, 1);
      flap.position.set(w * 0.28, -h * 0.35, 0.03);
      flap.rotation.set(0.5, 0.1, (rnd() - 0.5) * 0.6);
      face.add(flap);
      holder.add(face);
      this.canvas.add(holder);
      this.tears.push({ root: holder, threshold: 0.1 + (i / TEAR_COUNT) * 0.75 });
    }
    flapMat.side = THREE.DoubleSide;
  }

  /** Supplies: sacks on the roof, barrels and torch bundles on the sides, crates and spare wheels at the tail. */
  private buildCargo(): void {
    const sackMat = mat(0x8a7448, 0.98);
    const sackGeo = geo("sack", () => new THREE.SphereGeometry(0.34, 6, 5));
    const strapMat = mat(0x2a1c12, 0.9);
    for (let i = 0; i < SACK_SLOTS; i++) {
      const s = mesh(sackGeo, sackMat);
      s.scale.set(0.95, 0.6, 1.3);
      const z = -1.5 + i * 0.75;
      put(this.tilt, s, (i % 2 ? 0.12 : -0.12), 2.5, z, 0, (i * 1.3) % 1, 0.15 * (i % 2 ? 1 : -1));
      this.sacks.push(s);
    }
    // A lashing across the roof load.
    this.lash = mesh(gbox(0.06, 0.04, 3.9), strapMat);
    put(this.tilt, this.lash, 0, 2.62, 0);
    const barrelGeo = geo("barrel", () => new THREE.CylinderGeometry(0.27, 0.27, 0.56, 8));
    const hoopGeo = geo("barrel-hoop", () => new THREE.CylinderGeometry(0.285, 0.285, 0.04, 8));
    const woodMat = mat(0x4a3018);
    const bandMat = mat(0x1a1a1c, 0.5);
    const barrelSpots: [number, number, number][] = [
      [1.16, 1.0, 0.55],
      [-1.16, 1.0, -0.55],
      [1.16, 1.0, -0.75],
      [-1.16, 1.0, 0.75],
    ];
    for (const [x, y, z] of barrelSpots) {
      const g = new THREE.Group();
      g.add(mesh(barrelGeo, woodMat));
      g.add(put(g, mesh(hoopGeo, bandMat), 0, 0.15, 0));
      g.add(put(g, mesh(hoopGeo, bandMat), 0, -0.15, 0));
      put(this.tilt, g, x, y, z);
      this.barrels.push(g);
    }
    const crateGeo = gbox(0.62, 0.48, 0.62);
    const crateMat = mat(0x5a4426, 0.9);
    const slat = gbox(0.66, 0.08, 0.66);
    const crateSpots: [number, number, number][] = [
      [-0.35, 1.31, -2.42],
      [0.38, 1.31, -2.42],
      [0.0, 1.8, -2.4],
    ];
    for (const [x, y, z] of crateSpots) {
      const g = new THREE.Group();
      g.add(mesh(crateGeo, crateMat));
      g.add(put(g, mesh(slat, mat(0x2a1c10, 0.9)), 0, 0.12, 0));
      put(this.tilt, g, x, y, z, 0, x * 0.4, 0);
      this.crates.push(g);
    }
    // Torch bundles leaning on the side rails.
    const stickGeo = gcyl(0.03, 0.03, 1.5, 5);
    const pitchGeo = gball(0.06, 5, 4);
    const stickMat = mat(0x2a1a10);
    const pitchMat = mat(0x0a0806, 0.6);
    for (let i = 0; i < STICK_SLOTS; i++) {
      const side = i % 2 ? -1 : 1;
      const g = new THREE.Group();
      g.add(mesh(stickGeo, stickMat));
      g.add(put(g, mesh(pitchGeo, pitchMat), 0, 0.78, 0));
      put(this.tilt, g, side * (1.0 + Math.floor(i / 2) * 0.06), 1.75, -1.75 + Math.floor(i / 2) * 0.09, 0.12, 0, side * -0.12);
      this.sticks.push(g);
    }
    // Spare wheels hung on the tail.
    for (let i = 0; i < 2; i++) {
      const g = new THREE.Group();
      const r = 0.5;
      g.add(mesh(geo("spare-rim", () => new THREE.TorusGeometry(0.5, 0.06, 5, 14)), mat(0x141414, 0.6)));
      for (let k = 0; k < 2; k++) {
        const sp = mesh(gbox(0.04, 1.0, 0.04), mat(0x2c1d12));
        sp.rotation.z = (k * Math.PI) / 2;
        g.add(sp);
      }
      void r;
      put(this.tilt, g, i ? 0.42 : -0.42, 1.55, -2.22 - i * 0.18, 0.1, 0, i * 0.4);
      this.spareWheels.push(g);
    }
  }

  private buildCot(): void {
    const frame = this.cotFrame;
    const wood = mat(0x3a2a1a);
    const cloth = mat(0x8a8272, 1);
    frame.add(put(frame, mesh(gbox(0.72, 0.06, 1.95), cloth), 0, 0.02, 0));
    for (const [x, z] of [
      [-0.32, -0.9],
      [0.32, -0.9],
      [-0.32, 0.9],
      [0.32, 0.9],
    ]) {
      frame.add(put(frame, mesh(gbox(0.05, 0.3, 0.05), wood), x, -0.13, z));
    }
    frame.add(put(frame, mesh(gbox(0.4, 0.09, 0.28), mat(0xb8b0a0, 1)), 0, 0.1, -0.78));
    frame.position.set(0, 1.28, -0.7);
    frame.visible = false;
    this.tilt.add(frame);
    this.cot.position.set(0, 1.42, -0.55);
    this.tilt.add(this.cot);
  }

  /** Show `load` supply pieces (each capped at the slots one wagon has). */
  setLoad(l: Load): void {
    const show = (list: THREE.Object3D[], n: number) => list.forEach((o, i) => (o.visible = i < n));
    show(this.sacks, l.sacks);
    show(this.barrels, l.barrels);
    show(this.crates, l.crates);
    show(this.sticks, l.sticks);
    show(this.spareWheels, l.wheels);
  }

  /** Total supply pieces visible, for tests and pops. */
  get loadCount(): number {
    return [this.sacks, this.barrels, this.crates, this.sticks, this.spareWheels].reduce((n, l) => n + l.filter((o) => o.visible).length, 0);
  }

  /** World position of the tail, where a crate would fall from. */
  tailWorld(target = new THREE.Vector3()): THREE.Vector3 {
    return this.root.localToWorld(target.set(0, 1.5, -2.5));
  }

  roll(distance: number): void {
    for (const w of this.wheels) w.g.rotation.x = distance / w.r;
  }

  update(dt: number, time: number, moving: number): void {
    const bad = damp(this.bad, 1 - this.condition, 1.5, dt);
    this.bad = bad;
    const wob = (0.01 + bad * 0.05) * moving;
    this.tilt.rotation.z = Math.sin(time * 3.1 + this.wobbleSeed) * wob + bad * 0.04;
    this.tilt.rotation.x = Math.sin(time * 2.3 + this.wobbleSeed) * wob * 0.5;
    this.tilt.position.y = Math.abs(Math.sin(time * 6 + this.wobbleSeed)) * 0.03 * moving - bad * 0.08;
    this.canvasMat.emissive.setRGB(0.22 * this.lantern, 0.1 * this.lantern, 0.03 * this.lantern);
    // Canvas: dirtier, saggier and torn as the wagon fails.
    this.canvasMat.color.setRGB(0.6 - bad * 0.24, 0.57 - bad * 0.25, 0.525 - bad * 0.24);
    const sag = 1 - bad * 0.2;
    this.canvas.scale.y = 1.1 * sag;
    for (const h of this.hoops) h.scale.y = 1.12 * sag;
    for (const t of this.tears) t.root.visible = bad > t.threshold;
    const roofY = 1.45 + 1.13 * sag;
    this.sacks.forEach((o) => (o.position.y = roofY));
    this.lash.position.y = roofY + 0.1;
    // The tail is drawn back for whoever lies there.
    this.hostAmt = damp(this.hostAmt, this.hosting, 2.2, dt);
    const h = this.hostAmt;
    this.canvas.scale.z = 1 - h * 0.41;
    this.canvas.position.z = -0.05 + h * 0.85;
    this.cotFrame.visible = h > 0.3;
    // Wheels: splayed, wobbling, missing spokes.
    for (const w of this.wheels) {
      const broken = 1 - this.condition > w.threshold ? 1 : 0;
      const b = Math.max(bad * 0.5, broken);
      w.mount.rotation.z = w.side * b * 0.32 * (1 + broken * 0.5);
      w.mount.rotation.y = Math.sin(time * 7 + w.r * 9 + this.wobbleSeed) * 0.05 * b * moving;
      w.g.scale.y = 1 - broken * 0.09;
      w.spokes[1].visible = !broken;
      w.spokes[3].visible = !(broken && bad > 0.55);
      w.mount.position.y = w.r - broken * 0.05;
    }
    for (const t of this.torches) t.update(time);
  }
}

// ---------------------------------------------------------------------------
// Ox
// ---------------------------------------------------------------------------

export class Ox {
  root = new THREE.Group();
  private rig = new THREE.Group();
  private legs: THREE.Group[] = [];
  private head = new THREE.Group();
  private body: THREE.Mesh;
  phase = Math.random() * 10;
  lookBack = 0;
  /** 0..1: head down, shoulders low, legs working. */
  strain = 0;
  /** 0..1: how gaunt the animal looks. */
  thin = 0;
  private strainNow = 0;
  private thinNow = 0;
  private stumbleT = -1;

  constructor() {
    const hide = mat(0x1c140f);
    const horn = mat(0x8a8070, 0.6);
    this.body = mesh(geo("ox-body", () => new THREE.CapsuleGeometry(0.46, 1.25, 3, 8)), hide);
    this.body.rotation.x = Math.PI / 2;
    this.body.scale.set(1, 1, 1.08);
    this.body.position.y = 1.12;
    this.rig.add(this.body);
    const hump = mesh(gball(0.42, 7, 5), hide);
    hump.scale.set(0.9, 0.75, 1.1);
    hump.position.set(0, 1.46, 0.55);
    this.rig.add(hump);
    this.head.position.set(0, 1.18, 1.08);
    const neck = mesh(gcyl(0.26, 0.32, 0.55, 6), hide);
    neck.rotation.x = 1.1;
    neck.position.set(0, -0.05, 0.12);
    this.head.add(neck);
    const skull = mesh(gbox(0.36, 0.38, 0.62), hide);
    skull.position.set(0, -0.22, 0.42);
    skull.rotation.x = 0.7;
    this.head.add(skull);
    const muzzle = mesh(gbox(0.3, 0.24, 0.2), mat(0x2a211b));
    muzzle.position.set(0, -0.45, 0.66);
    muzzle.rotation.x = 0.7;
    this.head.add(muzzle);
    for (const side of [-1, 1]) {
      const h = mesh(geo("ox-horn", () => new THREE.ConeGeometry(0.05, 0.45, 4)), horn);
      h.position.set(side * 0.3, 0.2, 0.05);
      h.rotation.z = -side * 1.1;
      this.head.add(h);
    }
    this.rig.add(this.head);
    for (const [x, z] of [
      [-0.3, 0.7],
      [0.3, 0.7],
      [-0.3, -0.7],
      [0.3, -0.7],
    ]) {
      const leg = limb(0.78, 0.075, hide);
      leg.position.set(x, 0.72, z);
      this.legs.push(leg);
      this.rig.add(leg);
    }
    this.root.add(this.rig);
    const sh = blobShadow(1.2);
    sh.scale.set(0.8, 1, 1.4);
    this.root.add(sh);
  }

  /** The ox goes down on its knees for a moment and gets back up. */
  stumble(): void {
    if (this.stumbleT < 0) this.stumbleT = 0;
  }

  update(dt: number, time: number, moving: number): void {
    this.strainNow = damp(this.strainNow, this.strain, 1.2, dt);
    this.thinNow = damp(this.thinNow, this.thin, 1, dt);
    const st = this.strainNow;
    let stum = 0;
    if (this.stumbleT >= 0) {
      this.stumbleT += dt / 1.4;
      stum = Math.sin(Math.min(1, this.stumbleT) * Math.PI);
      if (this.stumbleT >= 1) this.stumbleT = -1;
    }
    this.phase += dt * moving * (4.2 - st * 1.0);
    const stride = (0.4 + st * 0.12) * Math.min(1, moving);
    this.legs.forEach((l, i) => {
      const front = i < 2;
      l.rotation.x = Math.sin(this.phase + (i === 0 || i === 3 ? 0 : Math.PI)) * stride - (front ? stum * 0.9 : 0);
    });
    this.head.rotation.y = damp(this.head.rotation.y, this.lookBack * 1.2, 3, dt);
    // Straining: the head hangs low and the whole animal sinks into the yoke.
    this.head.rotation.x = Math.sin(time * 0.7 + this.phase) * 0.05 + st * 0.55 * Math.min(1, moving + 0.3) + stum * 0.5;
    this.rig.position.y = -st * 0.09 * Math.min(1, moving + 0.3) - stum * 0.3 + Math.abs(Math.sin(this.phase * 2)) * st * 0.03;
    this.rig.rotation.x = stum * 0.22 + st * 0.03;
    const gaunt = this.thinNow;
    // The capsule lies along its own y: x is girth, z is depth.
    this.body.scale.x = 1 - gaunt * 0.2;
    this.body.scale.z = 1.08 - gaunt * 0.12;
  }
}

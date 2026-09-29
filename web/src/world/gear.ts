// Shared building blocks for figures, wagons and oxen: cached materials and
// geometry (marked with keep() so disposeTree never frees them while others
// still use them) and the role props people carry.

import * as THREE from "three";
import { keep } from "./dispose.ts";

const matCache = new Map<string, THREE.MeshStandardMaterial>();
export function mat(hex: number, rough = 0.85, emissive = 0): THREE.MeshStandardMaterial {
  const key = `${hex}:${rough}:${emissive}`;
  let m = matCache.get(key);
  if (!m) {
    m = keep(new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: 0, flatShading: true }));
    if (emissive) m.emissive = new THREE.Color(hex).multiplyScalar(emissive);
    matCache.set(key, m);
  }
  return m;
}

const basicCache = new Map<number, THREE.MeshBasicMaterial>();
export function glowMat(hex: number): THREE.MeshBasicMaterial {
  let m = basicCache.get(hex);
  if (!m) {
    m = keep(new THREE.MeshBasicMaterial({ color: hex }));
    basicCache.set(hex, m);
  }
  return m;
}

const geoCache = new Map<string, THREE.BufferGeometry>();
/** A geometry built once and shared by every user; never disposed. */
export function geo(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geoCache.get(key);
  if (!g) {
    g = keep(make());
    geoCache.set(key, g);
  }
  return g;
}
export const gbox = (w: number, h: number, d: number) => geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
export const gcyl = (rt: number, rb: number, h: number, seg = 6) => geo(`c${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
export const gball = (r: number, ws = 6, hs = 5) => geo(`s${r},${ws},${hs}`, () => new THREE.SphereGeometry(r, ws, hs));

export function limb(len: number, r: number, m: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(gcyl(r * 0.85, r, len, 5), m);
  mesh.position.y = -len / 2;
  g.add(mesh);
  return g;
}

export function put<T extends THREE.Object3D>(parent: THREE.Object3D, o: T, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): T {
  o.position.set(x, y, z);
  o.rotation.set(rx, ry, rz);
  parent.add(o);
  return o;
}

export const mesh = (g: THREE.BufferGeometry, m: THREE.Material) => new THREE.Mesh(g, m);

/** A red cross on a plate that faces +x (rotate the group for other facings). */
export function crossPlate(size: number, plate = 0xd9d2c0): THREE.Group {
  const g = new THREE.Group();
  const bg = mesh(gbox(0.012, size * 1.25, size * 1.25), mat(plate, 0.8));
  g.add(bg);
  const red = mat(0xb01414, 0.7, 0.35);
  g.add(put(g, mesh(gbox(0.02, size * 0.28, size * 0.95), red), 0.006, 0, 0));
  g.add(put(g, mesh(gbox(0.02, size * 0.95, size * 0.28), red), 0.006, 0, 0));
  return g;
}

export type Prop = "satchel" | "rifle" | "toolbelt" | "apron" | "spyglass" | "collar" | "book" | "lantern" | "bandolier"
  // What companions carry: the one thing you would remember them by.
  | "bag" | "shoe" | "roll" | "bell" | "whip" | "sack" | "staff";

/** The body parts a prop attaches to. */
export interface Rig {
  torso: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  head: THREE.Group;
  wide: number;
  /** Per-figure materials, so a leaving figure fades all of it. */
  own: (m: THREE.MeshStandardMaterial) => THREE.MeshStandardMaterial;
  /** Groups a figure toggles for what it does with its hands. */
  slots: { rifle?: THREE.Object3D; lantern?: THREE.Object3D; glow: THREE.Mesh[] };
}

export function addProp(p: Prop, r: Rig): void {
  const w = r.wide;
  const M = (hex: number, rough = 0.85, em = 0) => r.own(mat(hex, rough, em));
  switch (p) {
    case "satchel": {
      // A hip bag with a red cross on its outer face, and a white armband with another
      // on the other arm, so a medic reads from either side.
      const strap = mesh(gbox(0.05, 0.86, 0.02), M(0x2a1c12));
      put(r.torso, strap, 0, 0.28, 0.245 * w, 0, 0, 0.75);
      const bag = new THREE.Group();
      bag.add(mesh(gbox(0.16, 0.3, 0.36), M(0x4a3a26)));
      const cross = crossPlate(0.2);
      put(bag, cross, -0.09, 0.0, 0, 0, Math.PI, 0);
      const cross2 = crossPlate(0.2);
      put(bag, cross2, 0.09, 0.0, 0, 0, 0, 0);
      put(r.torso, bag, -0.34 * w, -0.12, -0.02);
      const band = mesh(gcyl(0.083, 0.083, 0.15, 6), M(0xdedad0, 0.8));
      put(r.armR, band, 0, -0.2, 0);
      const bc = crossPlate(0.13);
      put(band, bc, 0.084, 0, 0);
      break;
    }
    case "rifle": {
      const g = new THREE.Group();
      g.add(put(g, mesh(gbox(0.045, 1.2, 0.045), M(0x2a1e14, 0.7)), 0, 0.15, 0));
      g.add(put(g, mesh(gbox(0.06, 0.34, 0.075), M(0x5a3c22, 0.8)), 0, -0.36, 0));
      g.add(put(g, mesh(gbox(0.03, 0.2, 0.03), M(0x121212, 0.5)), 0, 0.75, 0));
      put(r.torso, g, 0.05, 0.25, -0.3 * w, 0.22, 0, 0.42);
      const sling = mesh(gbox(0.05, 0.8, 0.02), M(0x2a1c12));
      put(r.torso, sling, 0, 0.28, 0.245 * w, 0, 0, -0.75);
      r.slots.rifle = g;
      break;
    }
    case "toolbelt": {
      const belt = mesh(gcyl(0.285 * w, 0.285 * w, 0.09, 8), M(0x4a3420));
      put(r.torso, belt, 0, 0.03, 0);
      // A hammer and a wrench stick out of the belt where a silhouette will catch them.
      const hammer = new THREE.Group();
      hammer.add(put(hammer, mesh(gbox(0.04, 0.36, 0.04), M(0x6a4a2a)), 0, 0, 0));
      hammer.add(put(hammer, mesh(gbox(0.09, 0.09, 0.2), M(0x2a2a2c, 0.5)), 0, 0.2, 0));
      put(r.torso, hammer, 0.28 * w, -0.1, 0.08, 0.25, 0, -0.5);
      const wrench = new THREE.Group();
      wrench.add(put(wrench, mesh(gbox(0.035, 0.5, 0.05), M(0x6a6a6e, 0.4)), 0, 0, 0));
      wrench.add(put(wrench, mesh(gbox(0.12, 0.09, 0.05), M(0x6a6a6e, 0.4)), 0, 0.27, 0));
      put(r.torso, wrench, -0.28 * w, -0.06, -0.1, -0.35, 0, 0.55);
      put(r.torso, mesh(gbox(0.16, 0.16, 0.1), M(0x3a2818)), 0.0, -0.06, -0.3 * w);
      break;
    }
    case "apron": {
      const a = mesh(gbox(0.42 * w, 0.88, 0.03), M(0x6a5232, 0.95));
      put(r.torso, a, 0, 0.1, 0.27 * w, -0.03, 0, 0);
      const bib = mesh(gbox(0.26 * w, 0.24, 0.03), M(0x6a5232, 0.95));
      put(r.torso, bib, 0, 0.5, 0.245 * w);
      break;
    }
    case "spyglass": {
      const g = new THREE.Group();
      g.add(put(g, mesh(gcyl(0.03, 0.045, 0.56, 6), M(0xb08a3a, 0.4)), 0, 0, 0));
      g.add(put(g, mesh(gcyl(0.055, 0.055, 0.1, 6), M(0xb08a3a, 0.4)), 0, 0.3, 0));
      g.add(put(g, mesh(gcyl(0.04, 0.04, 0.05, 6), M(0x2a1c12, 0.8)), 0, -0.3, 0));
      put(r.torso, g, -0.3 * w, -0.16, -0.06, -0.8, 0, 0.25);
      break;
    }
    case "collar": {
      const c = mesh(gcyl(0.15 * w, 0.2 * w, 0.1, 8), M(0xe8e2d2, 0.8, 0.12));
      put(r.torso, c, 0, 0.72, 0);
      put(r.torso, mesh(gbox(0.1, 0.1, 0.025), M(0xe8e2d2, 0.8, 0.12)), 0, 0.62, 0.22 * w);
      break;
    }
    case "book": {
      const b = new THREE.Group();
      b.add(mesh(gbox(0.26, 0.34, 0.09), M(0x2a0f10, 0.7)));
      b.add(put(b, mesh(gbox(0.235, 0.32, 0.075), M(0xcfc6a8, 0.9)), 0.012, 0, 0));
      b.add(put(b, mesh(gbox(0.05, 0.05, 0.02), M(0xb08a3a, 0.4, 0.2)), 0, 0, 0.05));
      put(r.armL, b, 0.02, -0.72, 0.1, 0.4, 0, 0);
      break;
    }
    case "lantern": {
      const g = new THREE.Group();
      g.add(put(g, mesh(gbox(0.15, 0.22, 0.15), M(0x1a1410, 0.6)), 0, -0.16, 0));
      const core = mesh(gbox(0.1, 0.16, 0.1), glowMat(0xffb060));
      g.add(put(g, core, 0, -0.16, 0));
      g.add(put(g, mesh(gbox(0.17, 0.03, 0.17), M(0x1a1410, 0.6)), 0, -0.03, 0));
      g.add(put(g, mesh(gbox(0.17, 0.03, 0.17), M(0x1a1410, 0.6)), 0, -0.29, 0));
      g.add(put(g, mesh(gbox(0.02, 0.2, 0.02), M(0x1a1410, 0.6)), 0, 0.06, 0));
      put(r.armR, g, 0, -0.66, 0.02);
      r.slots.lantern = g;
      r.slots.glow.push(core);
      break;
    }
    case "bag": {
      // A doctor's bag clutched to the chest.
      const g = new THREE.Group();
      g.add(mesh(gbox(0.36, 0.22, 0.14), M(0x1c1612, 0.6)));
      g.add(put(g, mesh(gbox(0.34, 0.03, 0.15), M(0x0e0b09, 0.5)), 0, 0.1, 0));
      g.add(put(g, mesh(gbox(0.05, 0.06, 0.02), M(0xb08a3a, 0.4, 0.15)), 0, 0.02, 0.078));
      put(r.torso, g, 0, 0.3, 0.3 * w, -0.1, 0, 0);
      break;
    }
    case "shoe": {
      const g = new THREE.Group();
      g.add(mesh(gbox(0.09, 0.07, 0.2), M(0x5a3c22, 0.8)));
      g.add(put(g, mesh(gbox(0.09, 0.08, 0.07), M(0x3a2818, 0.8)), 0, 0.05, -0.07));
      put(r.armL, g, 0.02, -0.76, 0.05);
      break;
    }
    case "roll": {
      // A rolled canvas of tools or maps tied across the back.
      const g = new THREE.Group();
      g.add(mesh(gcyl(0.09, 0.09, 0.62, 7), M(0x8a7a58, 0.95)));
      g.add(put(g, mesh(gcyl(0.095, 0.095, 0.05, 7), M(0x3a2818)), 0, 0.14, 0));
      g.add(put(g, mesh(gcyl(0.095, 0.095, 0.05, 7), M(0x3a2818)), 0, -0.14, 0));
      put(r.torso, g, 0, 0.42, -0.3 * w, 0, 0, Math.PI / 2 - 0.25);
      break;
    }
    case "bell": {
      const g = new THREE.Group();
      g.add(mesh(new THREE.ConeGeometry(0.08, 0.12, 7), M(0xb08a3a, 0.4, 0.1)));
      g.add(put(g, mesh(gbox(0.02, 0.09, 0.02), M(0x2a1c12)), 0, 0.1, 0));
      put(r.armR, g, 0, -0.78, 0.04);
      break;
    }
    case "whip": {
      const ring = mesh(geo("whipCoil", () => new THREE.TorusGeometry(0.11, 0.028, 4, 10)), M(0x3a2414));
      put(r.torso, ring, -0.28 * w, -0.02, 0.06, 0, Math.PI / 2, 0);
      put(r.torso, mesh(gcyl(0.02, 0.02, 0.32, 4), M(0x3a2414)), -0.3 * w, -0.24, 0.02, 0.1, 0, 0);
      break;
    }
    case "sack": {
      // A heavy canvas sack slung across the chest.
      const g = new THREE.Group();
      g.add(mesh(gbox(0.42, 0.36, 0.2), M(0x8a7a58, 0.95)));
      g.add(put(g, mesh(gbox(0.44, 0.05, 0.22), M(0x3a2818)), 0, 0.16, 0));
      put(r.torso, g, 0.12 * w, 0.02, 0.26 * w, 0, 0, 0.25);
      put(r.torso, mesh(gbox(0.05, 0.86, 0.02), M(0x2a1c12)), 0, 0.3, 0.24 * w, 0, 0, 0.7);
      break;
    }
    case "staff": {
      // A crook, crutch or pole used as a walking staff.
      put(r.armR, mesh(gcyl(0.026, 0.032, 1.5, 5), M(0x6a4a2a, 0.9)), 0, -0.6, 0.12, 0.1, 0, 0);
      break;
    }
    case "bandolier": {
      const band = new THREE.Group();
      const ring = mesh(geo("bandoTorus", () => new THREE.TorusGeometry(1, 0.11, 4, 14).rotateX(Math.PI / 2)), M(0x3a2a1a));
      ring.scale.setScalar(0.27 * w);
      band.add(ring);
      const cart = M(0xc09a44, 0.4, 0.15);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 0.9 - Math.PI * 0.45;
        const c = mesh(gcyl(0.022, 0.022, 0.09, 5), cart);
        // Cartridges ride on the front half of the strap.
        put(band, c, Math.sin(a) * 0.29 * w, 0, Math.cos(a) * 0.29 * w);
      }
      put(r.torso, band, 0, 0.36, 0, 0.4, 0, 0.5);
      break;
    }
  }
}

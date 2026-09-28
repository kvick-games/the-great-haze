// Set pieces: buildings, landmarks, and props that events are staged with.
// Everything is built from primitives so the page needs no downloaded models.

import * as THREE from "three";
import { ball, box, cone, cyl, merge, part, seeded, vcMaterial } from "../world/geo.ts";
import type { RGB } from "../world/geo.ts";
import { Flame, blobShadow } from "../world/fx.ts";

export const WOOD: RGB = [0.12, 0.085, 0.06];
export const DARKWOOD: RGB = [0.06, 0.045, 0.035];
export const STONE: RGB = [0.2, 0.19, 0.18];
export const WHITEWASH: RGB = [0.55, 0.53, 0.5];
export const ROOF: RGB = [0.06, 0.05, 0.05];

const glowMats = new Map<string, THREE.MeshBasicMaterial>();
export function glowMat(r: number, g: number, b: number): THREE.MeshBasicMaterial {
  const key = `${r},${g},${b}`;
  let m = glowMats.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), fog: true });
    glowMats.set(key, m);
  }
  return m;
}
export const WINDOW = () => glowMat(1.5, 0.78, 0.28);

export interface Piece {
  group: THREE.Group;
  flames: Flame[];
}

function piece(): Piece {
  return { group: new THREE.Group(), flames: [] };
}

function addStatic(p: Piece, parts: THREE.BufferGeometry[]): void {
  if (!parts.length) return;
  p.group.add(new THREE.Mesh(merge(parts), vcMaterial()));
}

function addFlame(p: Piece, x: number, y: number, z: number, size = 0.5, power = 0.8): Flame {
  const f = new Flame(size, power);
  f.group.position.set(x, y, z);
  p.group.add(f.group);
  p.flames.push(f);
  return f;
}

/** A painted sign, drawn on a canvas. */
export function signBoard(text: string, w: number, h: number, opts: { bg?: string; fg?: string; font?: string } = {}): THREE.Mesh {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = Math.round((512 * h) / w);
  const g = c.getContext("2d")!;
  g.fillStyle = opts.bg ?? "#2a2019";
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = opts.fg ?? "#c9b99a";
  let size = c.height * 0.55;
  g.font = `${size}px ${opts.font ?? "Georgia, serif"}`;
  while (g.measureText(text).width > c.width * 0.9 && size > 8) {
    size *= 0.92;
    g.font = `${size}px ${opts.font ?? "Georgia, serif"}`;
  }
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, c.width / 2, c.height / 2 + size * 0.05);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
}

function gable(w: number, d: number, h: number, color: RGB, y: number): THREE.BufferGeometry[] {
  const pitch = Math.atan2(h, w / 2);
  const slope = Math.hypot(h, w / 2);
  return [
    part(box(slope + 0.3, 0.12, d + 0.5), color, { x: -w / 4, y: y + h / 2, rz: pitch }),
    part(box(slope + 0.3, 0.12, d + 0.5), color, { x: w / 4, y: y + h / 2, rz: -pitch }),
  ];
}

export interface HouseOpts {
  w?: number;
  d?: number;
  h?: number;
  wall?: RGB;
  lit?: boolean;
  ruined?: boolean;
  seed?: number;
}

export function house(o: HouseOpts = {}): Piece {
  const p = piece();
  const w = o.w ?? 6;
  const d = o.d ?? 7;
  const h = o.h ?? 3.4;
  const wall = o.wall ?? WOOD;
  const r = seeded(o.seed ?? 3);
  const parts: THREE.BufferGeometry[] = [];
  if (o.ruined) {
    parts.push(part(box(w, h * 0.8, 0.25), wall, { y: h * 0.4, z: d / 2 }));
    parts.push(part(box(0.25, h, d * 0.7), wall, { x: -w / 2, y: h / 2, z: d * 0.15 }));
    parts.push(part(box(w * 0.5, h * 0.6, 0.25), wall, { x: w * 0.25, y: h * 0.3, z: -d / 2 }));
    parts.push(part(box(w * 0.7, 0.15, d * 0.6), ROOF, { x: -0.4, y: 0.6, rz: 0.35, rx: 0.2 }));
    parts.push(part(box(0.8, h + 2, 0.8), STONE, { x: w / 2 - 0.6, y: (h + 2) / 2, z: -d / 2 + 0.6 }));
  } else {
    parts.push(part(box(w, h, d), wall, { y: h / 2 }, 0.1));
    parts.push(...gable(w, d, h * 0.55, ROOF, h));
    parts.push(part(box(0.8, 2.6, 0.8), STONE, { x: w / 2 - 1, y: h + 1.3, z: -d / 4 }));
    parts.push(part(box(1.1, 2.1, 0.1), DARKWOOD, { y: 1.05, z: d / 2 + 0.03 }));
    parts.push(part(box(w + 0.4, 0.14, 1.6), DARKWOOD, { y: 2.9, z: d / 2 + 0.8 }));
    for (const x of [-w / 2 + 0.3, w / 2 - 0.3]) parts.push(part(cyl(0.08, 0.08, 2.9, 5), DARKWOOD, { x, y: 1.45, z: d / 2 + 1.5 }));
  }
  addStatic(p, parts);
  if (!o.ruined) {
    const lit = o.lit ?? true;
    const win = new THREE.Group();
    for (const x of [-w / 2 + 1.2, w / 2 - 1.2]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.0), lit && r() > 0.2 ? WINDOW() : glowMat(0.02, 0.02, 0.025));
      m.position.set(x, 1.8, d / 2 + 0.02);
      win.add(m);
    }
    const side = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.0), lit ? WINDOW() : glowMat(0.02, 0.02, 0.025));
    side.position.set(w / 2 + 0.02, 1.8, 0);
    side.rotation.y = Math.PI / 2;
    win.add(side);
    p.group.add(win);
  }
  const sh = blobShadow(Math.max(w, d) * 0.75);
  p.group.add(sh);
  return p;
}

export function emporium(name: string): Piece {
  const p = piece();
  const parts: THREE.BufferGeometry[] = [];
  parts.push(part(box(9, 5, 8), WOOD, { y: 2.5 }, 0.1));
  parts.push(part(box(9.4, 2.2, 0.3), [0.14, 0.1, 0.07], { y: 6.1, z: 4.0 }));
  parts.push(...gable(9, 8, 2.2, ROOF, 5));
  parts.push(part(box(10, 0.2, 3), DARKWOOD, { y: 0.35, z: 5.4 }));
  parts.push(part(box(10, 0.14, 3.2), DARKWOOD, { y: 3.4, z: 5.5 }));
  for (const x of [-4.6, -1.5, 1.5, 4.6]) parts.push(part(cyl(0.1, 0.1, 3.1, 5), DARKWOOD, { x, y: 1.85, z: 6.8 }));
  parts.push(part(box(1.4, 2.4, 0.1), DARKWOOD, { y: 1.5, z: 4.03 }));
  // Stock on the porch.
  const r = seeded(5);
  for (let i = 0; i < 7; i++) parts.push(part(box(0.8, 0.8, 0.8), [0.2, 0.15, 0.1], { x: -4 + r() * 2.2, y: 0.85 + (i > 4 ? 0.8 : 0), z: 5.2 + r() * 1.2, ry: r() }, 0.2));
  for (let i = 0; i < 4; i++) parts.push(part(cyl(0.35, 0.35, 0.9, 8), [0.15, 0.1, 0.07], { x: 2.6 + i * 0.75, y: 0.9, z: 5.6 }));
  for (let i = 0; i < 5; i++) parts.push(part(ball(0.42, 6, 5), [0.28, 0.24, 0.17], { x: 2.8 + r() * 1.8, y: 0.7, z: 6.4 + r() * 0.5, sy: 0.7 }));
  addStatic(p, parts);
  const sign = signBoard(name, 8.6, 1.6, { bg: "#1c1510", fg: "#d8c39a" });
  sign.position.set(0, 6.1, 4.17);
  p.group.add(sign);
  for (const x of [-3, 3]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.4), WINDOW());
    m.position.set(x, 1.9, 4.03);
    p.group.add(m);
  }
  addFlame(p, -4.6, 3.1, 6.9, 0.45, 1);
  addFlame(p, 4.6, 3.1, 6.9, 0.45, 1);
  p.group.add(blobShadow(8));
  return p;
}

export function lanternPost(): Piece {
  const p = piece();
  addStatic(p, [part(cyl(0.06, 0.08, 3, 5), DARKWOOD, { y: 1.5 }), part(box(0.8, 0.06, 0.06), DARKWOOD, { y: 2.9, x: 0.35 })]);
  addFlame(p, 0.7, 2.55, 0, 0.35, 0.6);
  return p;
}

export function groundLantern(): Piece {
  const p = piece();
  addStatic(p, [part(cyl(0.04, 0.05, 1.3, 5), DARKWOOD, { y: 0.65 }), part(box(0.3, 0.36, 0.3), [0.08, 0.07, 0.06], { y: 1.45 }), part(box(0.34, 0.05, 0.34), [0.06, 0.05, 0.04], { y: 1.66 })]);
  addFlame(p, 0, 1.32, 0, 0.36, 0.9);
  return p;
}

export function bonfire(): Piece {
  const p = piece();
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) parts.push(part(cyl(0.12, 0.16, 2.2, 5), [0.05, 0.03, 0.02], { y: 0.9, rz: 0.5, ry: (i / 7) * Math.PI * 2 }));
  addStatic(p, parts);
  addFlame(p, 0, 0.3, 0, 2.2, 3);
  return p;
}

export function signpost(lines: string[]): Piece {
  const p = piece();
  addStatic(p, [part(cyl(0.1, 0.12, 4.2, 5), DARKWOOD, { y: 2.1 })]);
  lines.forEach((text, i) => {
    const s = signBoard(text, 3.6, 0.5, { bg: "#241a12", fg: "#bfae8e" });
    s.position.set(i % 2 ? -1.9 : 1.9, 3.6 - i * 0.65, 0.12);
    s.rotation.z = (i % 2 ? 1 : -1) * 0.04;
    p.group.add(s);
    const back = s.clone();
    back.rotation.y = Math.PI;
    back.position.z = -0.12;
    p.group.add(back);
  });
  return p;
}

export function graves(n: number, fresh = true): Piece {
  const p = piece();
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * 1.6;
    parts.push(part(box(0.9, 0.35, 2), fresh ? [0.09, 0.06, 0.04] : [0.07, 0.08, 0.05], { x, y: 0.1, z: 0 }, 0.2));
    parts.push(part(box(0.1, 1.3, 0.1), DARKWOOD, { x, y: 0.65, z: -1.1 }));
    parts.push(part(box(0.7, 0.1, 0.1), DARKWOOD, { x, y: 1.0, z: -1.1 }));
  }
  addStatic(p, parts);
  return p;
}

export function cross(): THREE.Mesh {
  return new THREE.Mesh(merge([part(box(0.1, 1.4, 0.1), DARKWOOD, { y: 0.7 }), part(box(0.75, 0.1, 0.1), DARKWOOD, { y: 1.05 }), part(box(0.8, 0.25, 1.8), [0.08, 0.055, 0.04], { y: 0.08, z: 1.0 })]), vcMaterial());
}

export function cairn(): Piece {
  const p = piece();
  const parts: THREE.BufferGeometry[] = [];
  const r = seeded(9);
  for (let i = 0; i < 9; i++) parts.push(part(new THREE.DodecahedronGeometry(0.5 - i * 0.04, 0), STONE, { y: 0.3 + i * 0.32, x: (r() - 0.5) * 0.2, rz: r(), s: 1 }, 0.3));
  for (let i = 0; i < 6; i++) parts.push(part(box(0.2, 0.12, 0.2), [0.35, 0.3, 0.12], { x: Math.cos(i) * 1.1, y: 0.06, z: Math.sin(i) * 1.1 }));
  addStatic(p, parts);
  return p;
}

export function rockPile(width = 10): Piece {
  const p = piece();
  const parts: THREE.BufferGeometry[] = [];
  const r = seeded(21);
  for (let i = 0; i < 26; i++) {
    const s = 0.5 + r() * 1.6;
    parts.push(part(new THREE.DodecahedronGeometry(s, 0), [0.14, 0.13, 0.12], { x: (r() - 0.5) * width, y: s * 0.5 + r() * 1.5, z: (r() - 0.5) * 5, rx: r() * 3, ry: r() * 3 }, 0.3));
  }
  addStatic(p, parts);
  return p;
}

export function crates(n: number, seed = 1): Piece {
  const p = piece();
  const parts: THREE.BufferGeometry[] = [];
  const r = seeded(seed);
  for (let i = 0; i < n; i++) {
    const kind = r();
    const at = { x: (r() - 0.5) * 3, y: 0, z: (r() - 0.5) * 3, ry: r() * 3 };
    if (kind < 0.5) parts.push(part(box(0.8, 0.8, 0.8), [0.2, 0.15, 0.1], { ...at, y: 0.4 }, 0.2));
    else if (kind < 0.8) parts.push(part(ball(0.45, 6, 5), [0.28, 0.24, 0.17], { ...at, y: 0.3, sy: 0.7 }));
    else parts.push(part(cyl(0.35, 0.35, 0.9, 8), [0.15, 0.1, 0.07], { ...at, y: 0.45 }));
  }
  addStatic(p, parts);
  return p;
}

/** A band of dark water across the road, e.g. a swollen creek or a river. */
export function waterBand(width: number, length = 120): Piece {
  const p = piece();
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(length, width).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x06080a, roughness: 0.1, metalness: 0.3 }),
  );
  water.position.y = 0.06;
  p.group.add(water);
  const bank = new THREE.Mesh(
    merge([part(box(length, 0.2, 0.6), [0.05, 0.04, 0.03], { z: width / 2 }), part(box(length, 0.2, 0.6), [0.05, 0.04, 0.03], { z: -width / 2 })]),
    vcMaterial(),
  );
  p.group.add(bank);
  return p;
}

export function bridge(broken: boolean): Piece {
  const p = waterBand(26, 160);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 9; i++) {
    const z = -13 + i * 3.25;
    if (broken && i === 4) continue;
    parts.push(part(box(8, 0.6, 3.3), STONE, { y: 1.6, z }, 0.15));
    for (const x of [-3.6, 3.6]) parts.push(part(box(0.8, 3.2, 0.8), STONE, { x, y: 0.2, z }, 0.15));
    parts.push(part(box(0.3, 0.6, 3.3), STONE, { x: -3.9, y: 2.1, z }));
    parts.push(part(box(0.3, 0.6, 3.3), STONE, { x: 3.9, y: 2.1, z }));
  }
  if (broken) parts.push(part(box(8, 0.4, 3), STONE, { y: 0.8, z: 0, rx: 0.5, rz: 0.1 }, 0.2));
  addStatic(p, parts);
  const lantern = addFlame(p, 2.5, 2.4, 14, 0.35, 0.9);
  void lantern;
  return p;
}

export function mission(): Piece {
  const p = piece();
  const parts: THREE.BufferGeometry[] = [];
  parts.push(part(box(12, 5, 8), WHITEWASH, { y: 2.5 }, 0.08));
  parts.push(...gable(12, 8, 2.5, [0.3, 0.12, 0.08], 5));
  parts.push(part(box(3.2, 11, 3.2), WHITEWASH, { x: -5, y: 5.5, z: 3 }, 0.08));
  parts.push(part(cone(2.6, 3.2, 4), [0.3, 0.12, 0.08], { x: -5, y: 12.6, z: 3, ry: Math.PI / 4 }));
  parts.push(part(box(0.2, 1.6, 0.2), DARKWOOD, { x: -5, y: 15, z: 3 }));
  parts.push(part(box(0.9, 0.2, 0.2), DARKWOOD, { x: -5, y: 15.3, z: 3 }));
  parts.push(part(box(18, 1.6, 0.5), WHITEWASH, { y: 0.8, z: 9 }, 0.1));
  parts.push(part(box(1.8, 3, 0.2), DARKWOOD, { y: 1.5, z: 4.05 }));
  addStatic(p, parts);
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.55, 0.8, 8, 1, true), new THREE.MeshStandardMaterial({ color: 0x6a5a3a, metalness: 0.6, roughness: 0.4, side: THREE.DoubleSide }));
  bell.position.set(-5, 9.6, 3);
  bell.name = "bell";
  p.group.add(bell);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.6), WINDOW());
  win.position.set(3, 2.8, 4.02);
  p.group.add(win);
  const g = graves(4, true);
  g.group.position.set(6, 0, 7);
  p.group.add(g.group);
  p.group.add(blobShadow(12));
  return p;
}

export function tollGate(): Piece {
  const p = piece();
  const parts: THREE.BufferGeometry[] = [];
  for (const x of [-5, 5]) parts.push(part(box(1.2, 3.2, 1.2), STONE, { x, y: 1.6 }, 0.2));
  const sag = 12;
  for (let i = 0; i < sag; i++) {
    const t = i / (sag - 1);
    const x = -4.4 + t * 8.8;
    parts.push(part(new THREE.TorusGeometry(0.16, 0.04, 4, 6), [0.1, 0.1, 0.1], { x, y: 2.6 - Math.sin(t * Math.PI) * 0.7, ry: i % 2 ? Math.PI / 2 : 0 }));
  }
  parts.push(part(box(4, 3, 4), STONE, { x: 9, y: 1.5, z: 3 }, 0.2));
  parts.push(part(box(4.6, 0.3, 4.6), ROOF, { x: 9, y: 3.2, z: 3 }));
  addStatic(p, parts);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), WINDOW());
  win.position.set(7, 1.8, 3);
  win.rotation.y = -Math.PI / 2;
  p.group.add(win);
  addFlame(p, 7.5, 0.5, -1.5, 1.2, 1.4);
  return p;
}

export function gateWall(): Piece {
  const p = piece();
  const white: RGB = [0.46, 0.46, 0.45];
  const parts: THREE.BufferGeometry[] = [];
  parts.push(part(box(170, 42, 6), white, { x: -91, y: 21 }, 0.04));
  parts.push(part(box(170, 42, 6), white, { x: 91, y: 21 }, 0.04));
  parts.push(part(box(12, 30, 6), white, { y: 27 }, 0.04));
  for (let i = -8; i <= 8; i++) parts.push(part(box(3, 3, 6.5), white, { x: i * 21, y: 43.5 }, 0.04));
  addStatic(p, parts);
  // The door: a slab of light that widens as it opens.
  const door = new THREE.Mesh(new THREE.PlaneGeometry(10, 11), glowMat(0.85, 1.0, 1.3));
  door.position.set(0, 6, 3.2);
  door.scale.x = 0.02;
  door.name = "door";
  p.group.add(door);
  addFlame(p, -7.5, 4, 4, 0.4, 0.5);
  addFlame(p, 7.5, 4, 4, 0.4, 0.5);
  return p;
}

export function overturnedWagon(): Piece {
  const p = piece();
  const parts: THREE.BufferGeometry[] = [
    part(box(1.7, 0.16, 4.2), WOOD, { y: 0.9, rz: 1.4, x: 0.4 }),
    part(box(0.08, 0.5, 4.2), DARKWOOD, { x: -0.1, y: 1.6, rz: 1.4 }),
    part(new THREE.CylinderGeometry(1.0, 1.0, 3.9, 10, 1, true, Math.PI / 2, Math.PI), [0.4, 0.37, 0.33], { x: -1.1, y: 0.8, rz: 1.4 + Math.PI / 2, rx: Math.PI / 2 }),
    part(new THREE.TorusGeometry(0.6, 0.05, 4, 12), [0.08, 0.08, 0.08], { x: 1.5, y: 1.7, z: 1.3, ry: 0.1 }),
    part(new THREE.TorusGeometry(0.6, 0.05, 4, 12), [0.08, 0.08, 0.08], { x: 1.5, y: 1.7, z: -1.3 }),
  ];
  addStatic(p, parts);
  const c = crates(8, 4);
  c.group.position.set(-2.5, 0, 1.5);
  p.group.add(c.group);
  return p;
}

export function stalledWagons(): Piece {
  const p = piece();
  const r = seeded(33);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i++) {
    const z = i * 7;
    parts.push(part(box(1.7, 0.16, 4.2), WOOD, { x: 0, y: 0.95, z, ry: (r() - 0.5) * 0.3 }));
    parts.push(part(new THREE.CylinderGeometry(1.0, 1.0, 3.9, 10, 1, true, Math.PI / 2, Math.PI), [0.34, 0.28, 0.24], { y: 1.45, z, rx: Math.PI / 2, sx: 0.9, sy: 1.1 }));
    for (const s of [-1, 1]) for (const zz of [-1.3, 1.3]) parts.push(part(new THREE.TorusGeometry(0.55, 0.05, 4, 12), [0.08, 0.08, 0.08], { x: s * 0.92, y: 0.55, z: z + zz, ry: Math.PI / 2 }));
  }
  addStatic(p, parts);
  addFlame(p, 0.9, 1.4, 16.5, 0.3, 0.7);
  return p;
}

export function peddlerCart(): Piece {
  const p = piece();
  addStatic(p, [
    part(box(1.6, 0.9, 2.6), [0.25, 0.12, 0.08], { y: 1.1 }),
    part(box(1.8, 0.1, 2.8), [0.25, 0.12, 0.08], { y: 1.6 }),
    part(new THREE.TorusGeometry(0.6, 0.05, 4, 12), [0.08, 0.08, 0.08], { x: 0.85, y: 0.6, ry: Math.PI / 2 }),
    part(new THREE.TorusGeometry(0.6, 0.05, 4, 12), [0.08, 0.08, 0.08], { x: -0.85, y: 0.6, ry: Math.PI / 2 }),
    part(box(0.5, 0.9, 1.4), [0.13, 0.11, 0.1], { y: 0.9, z: 2.6 }),
    part(box(0.3, 0.35, 0.5), [0.13, 0.11, 0.1], { y: 1.45, z: 3.4 }),
  ]);
  const sign = signBoard("MERIDIAN CO. — HONEST GOODS", 2.5, 0.5, { bg: "#3a1a14", fg: "#e0c890" });
  sign.position.set(0.83, 1.9, 0);
  sign.rotation.y = Math.PI / 2;
  p.group.add(sign);
  addFlame(p, -0.9, 2.3, -1.3, 0.3, 0.6);
  return p;
}

export function ropeAcross(width = 9): Piece {
  const p = piece();
  addStatic(p, [
    part(cyl(0.1, 0.12, 2, 5), DARKWOOD, { x: -width / 2, y: 1 }),
    part(cyl(0.1, 0.12, 2, 5), DARKWOOD, { x: width / 2, y: 1 }),
    part(cyl(0.025, 0.025, width, 4), [0.3, 0.26, 0.18], { y: 1.4, rz: Math.PI / 2 }),
  ]);
  return p;
}

export function hatch(): Piece {
  const p = piece();
  addStatic(p, [
    part(box(1.8, 0.15, 1.8), [0.12, 0.12, 0.13], { y: 0.07 }),
    part(box(0.12, 2, 0.12), DARKWOOD, { x: 1.6, y: 1 }),
    part(new THREE.TorusGeometry(0.15, 0.03, 4, 8), [0.2, 0.2, 0.2], { y: 0.2, rx: Math.PI / 2 }),
  ]);
  const s = signBoard("MERIDIAN CO. — DO NOT REMOVE", 1.8, 0.45, { bg: "#1a1a1a", fg: "#c9c0aa" });
  s.position.set(1.6, 1.7, 0.08);
  p.group.add(s);
  return p;
}

export function orchard(): Piece {
  const p = piece();
  const parts: THREE.BufferGeometry[] = [];
  const fruit: THREE.Vector3[] = [];
  const r = seeded(41);
  for (let i = 0; i < 9; i++) {
    const x = (i % 3) * 6 - 6 + (r() - 0.5) * 2;
    const z = Math.floor(i / 3) * 6 - 6 + (r() - 0.5) * 2;
    parts.push(part(cyl(0.18, 0.3, 2.6, 5), [0.08, 0.06, 0.05], { x, y: 1.3, z, rz: (r() - 0.5) * 0.3 }));
    parts.push(part(ball(1.8, 6, 5), [0.05, 0.06, 0.035], { x, y: 3.2, z, sy: 0.7 }, 0.3));
    for (let k = 0; k < 7; k++) fruit.push(new THREE.Vector3(x + (r() - 0.5) * 3, 2.4 + r() * 1.6, z + (r() - 0.5) * 3));
  }
  addStatic(p, parts);
  const fg = new THREE.InstancedMesh(new THREE.SphereGeometry(0.14, 6, 5), glowMat(2.6, 0.25, 0.1), fruit.length);
  const m = new THREE.Matrix4();
  fruit.forEach((f, i) => fg.setMatrixAt(i, m.makeTranslation(f.x, f.y, f.z)));
  p.group.add(fg);
  return p;
}

export function bigBarn(collapsed: boolean): Piece {
  const p = piece();
  const parts: THREE.BufferGeometry[] = [];
  if (collapsed) {
    parts.push(part(box(8, 0.3, 7), [0.1, 0.07, 0.05], { y: 1.4, rx: 0.3, rz: 0.12 }));
    parts.push(part(box(0.3, 3, 7), WOOD, { x: -4, y: 1.5 }));
    parts.push(part(box(9, 0.45, 0.45), DARKWOOD, { y: 0.55, z: 2.5, ry: 0.15, rz: 0.05 }));
  } else {
    parts.push(part(box(8, 4.5, 9), [0.2, 0.08, 0.06], { y: 2.25 }, 0.1));
    parts.push(...gable(8, 9, 2.6, ROOF, 4.5));
  }
  addStatic(p, parts);
  return p;
}

/** A local fog bank, e.g. a tongue of the Haze lying across the road. */
export function fogBank(width: number, depth: number, color = new THREE.Color(0.32, 0.02, 0.018)): Piece {
  const p = piece();
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: color }, uFade: { value: 1 } },
    vertexShader: `varying vec2 vUv; varying vec3 vW; void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime; uniform vec3 uColor; uniform float uFade; varying vec2 vUv; varying vec3 vW;
      float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), u.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), u.x), u.y); }
      void main() {
        vec2 q = vW.xz * 0.18 + vec2(uTime * 0.15, uTime * 0.07);
        float v = n(q) * 0.6 + n(q * 2.3 + 4.0) * 0.4;
        float edge = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x) * smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
        float wisp = smoothstep(0.35, 0.85, v);
        gl_FragColor = vec4(uColor * (0.5 + v * 0.8), wisp * edge * uFade * 0.32);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  for (let i = 0; i < 7; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(width, depth).rotateX(-Math.PI / 2), mat);
    m.position.y = 0.2 + i * 0.32;
    m.position.x = Math.sin(i * 1.7) * 1.5;
    m.renderOrder = 3;
    p.group.add(m);
  }
  p.group.userData.fogMat = mat;
  return p;
}

export function sinkhole(): Piece {
  const p = piece();
  const hole = new THREE.Mesh(new THREE.CircleGeometry(5, 18).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  hole.position.y = 0.05;
  p.group.add(hole);
  const glow = new THREE.Mesh(new THREE.CircleGeometry(3, 16).rotateX(-Math.PI / 2), glowMat(0.4, 0.02, 0.01));
  glow.position.y = 0.06;
  p.group.add(glow);
  const parts: THREE.BufferGeometry[] = [];
  const r = seeded(51);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    parts.push(part(box(1.2, 0.3, 0.8), [0.1, 0.08, 0.065], { x: Math.cos(a) * 5.2, y: 0.05, z: Math.sin(a) * 5.2, ry: -a, rx: (r() - 0.5) * 0.4 }));
  }
  addStatic(p, parts);
  return p;
}

export function gorgeTrestle(): Piece {
  const p = piece();
  const chasm = new THREE.Mesh(new THREE.PlaneGeometry(200, 14).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  chasm.position.y = 0.04;
  p.group.add(chasm);
  const parts: THREE.BufferGeometry[] = [];
  const r = seeded(61);
  for (let i = 0; i < 18; i++) {
    if (r() < 0.35) continue;
    parts.push(part(box(5, 0.15, 0.6), [0.16, 0.14, 0.12], { y: 0.25, z: -7 + i * 0.8, ry: (r() - 0.5) * 0.06 }));
  }
  for (const x of [-2.4, 2.4]) parts.push(part(box(0.25, 0.25, 15), [0.1, 0.08, 0.07], { x, y: 0.15 }));
  addStatic(p, parts);
  return p;
}

export function railLine(length: number): Piece {
  const p = piece();
  const parts: THREE.BufferGeometry[] = [];
  for (const x of [-0.75, 0.75]) parts.push(part(box(0.1, 0.12, length), [0.18, 0.12, 0.1], { x, y: 0.2 }));
  for (let z = -length / 2; z < length / 2; z += 1.2) parts.push(part(box(2.4, 0.12, 0.3), [0.07, 0.05, 0.04], { y: 0.08, z }));
  addStatic(p, parts);
  return p;
}

export function telegraph(n: number): Piece {
  const p = piece();
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < n; i++) {
    parts.push(part(cyl(0.09, 0.13, 7.5, 5), [0.06, 0.05, 0.045], { y: 3.75, z: i * 16 }));
    parts.push(part(box(1.8, 0.1, 0.1), [0.06, 0.05, 0.045], { y: 7, z: i * 16 }));
  }
  for (const x of [-0.7, 0.7]) parts.push(part(box(0.03, 0.03, (n - 1) * 16), [0.12, 0.12, 0.12], { x, y: 6.8, z: ((n - 1) * 16) / 2 }));
  addStatic(p, parts);
  return p;
}

export function milestone(): Piece {
  const p = piece();
  addStatic(p, [part(box(0.6, 1.1, 0.35), STONE, { y: 0.55 }, 0.2), part(ball(0.32, 6, 4), STONE, { y: 1.1, sx: 0.95, sz: 0.55 })]);
  return p;
}

export function barge(): Piece {
  const p = waterBand(34, 160);
  addStatic(p, [
    part(box(6, 0.5, 9), [0.12, 0.09, 0.07], { y: 0.3, z: 4 }, 0.2),
    part(box(0.2, 0.9, 9), [0.1, 0.08, 0.06], { x: 3, y: 0.8, z: 4 }),
    part(box(0.2, 0.9, 9), [0.1, 0.08, 0.06], { x: -3, y: 0.8, z: 4 }),
    part(cyl(0.02, 0.02, 40, 3), [0.3, 0.26, 0.2], { x: 4, y: 1.6, rx: Math.PI / 2 }),
  ]);
  addFlame(p, -2.6, 1.5, 8, 0.3, 0.7);
  return p;
}

export function deerHerd(n: number): Piece {
  const p = piece();
  const parts: THREE.BufferGeometry[] = [];
  const hide: RGB = [0.12, 0.09, 0.07];
  const r = seeded(71);
  for (let i = 0; i < n; i++) {
    const x = (r() - 0.5) * 16;
    const z = (r() - 0.5) * 6;
    const ry = r() * 6;
    const g = merge([
      part(new THREE.CapsuleGeometry(0.28, 0.9, 2, 6), hide, { y: 1.1, rx: Math.PI / 2 }),
      part(cyl(0.1, 0.13, 0.7, 5), hide, { y: 1.55, z: 0.55, rx: -0.5 }),
      part(box(0.2, 0.22, 0.42), hide, { y: 1.85, z: 0.75 }),
      part(cyl(0.035, 0.05, 0.9, 4), hide, { x: -0.18, y: 0.45, z: 0.4 }),
      part(cyl(0.035, 0.05, 0.9, 4), hide, { x: 0.18, y: 0.45, z: 0.4 }),
      part(cyl(0.035, 0.05, 0.9, 4), hide, { x: -0.18, y: 0.45, z: -0.4 }),
      part(cyl(0.035, 0.05, 0.9, 4), hide, { x: 0.18, y: 0.45, z: -0.4 }),
    ]);
    g.rotateY(ry);
    g.translate(x, 0, z);
    parts.push(g);
  }
  addStatic(p, parts);
  return p;
}

// Scenery geometry, one merged low-poly mesh per kind.

import * as THREE from "three";
import type { PropKind } from "./regions.ts";
import { ball, box, cone, cyl, merge, part, seeded } from "./geo.ts";
import type { RGB } from "./geo.ts";

const BARK: RGB = [0.07, 0.055, 0.045];
const DEAD: RGB = [0.1, 0.085, 0.075];

function deadTree(seed: number): THREE.BufferGeometry {
  const r = seeded(seed);
  const parts = [part(cyl(0.12, 0.3, 5.5, 5), DEAD, { y: 2.75, rz: (r() - 0.5) * 0.15 })];
  const n = 4 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const h = 1.6 + r() * 3.4;
    const len = 1.2 + r() * 2.2;
    const ang = r() * Math.PI * 2;
    const tilt = 0.5 + r() * 0.7;
    const g = part(cyl(0.03, 0.09, len, 4), DEAD, {});
    g.translate(0, len / 2, 0);
    g.rotateZ(tilt);
    g.rotateY(ang);
    g.translate(0, h, 0);
    parts.push(g);
    if (r() > 0.4) {
      const t2 = part(cyl(0.02, 0.04, len * 0.6, 3), DEAD, {});
      t2.translate(0, len * 0.3, 0);
      t2.rotateZ(tilt - 0.6);
      t2.rotateY(ang + 0.5);
      t2.translate(Math.sin(ang) * 0.3, h + len * 0.5, Math.cos(ang) * 0.3);
      parts.push(t2);
    }
  }
  return merge(parts);
}

function pine(): THREE.BufferGeometry {
  const col: RGB = [0.018, 0.035, 0.028];
  return merge([
    part(cyl(0.12, 0.2, 2, 5), BARK, { y: 1 }),
    part(cone(2.1, 3.2, 7), col, { y: 3.2 }),
    part(cone(1.7, 2.8, 7), col, { y: 4.8, ry: 0.4 }),
    part(cone(1.25, 2.4, 7), col, { y: 6.3, ry: 0.9 }),
    part(cone(0.8, 2.1, 6), col, { y: 7.7 }),
  ]);
}

function birch(): THREE.BufferGeometry {
  return merge([
    part(cyl(0.07, 0.13, 6, 5), [0.5, 0.48, 0.44], { y: 3 }),
    part(ball(1.1, 5, 4), [0.05, 0.08, 0.045], { y: 5.6, sx: 1, sy: 1.4 }),
    part(ball(0.8, 5, 4), [0.045, 0.075, 0.04], { y: 4.6, x: 0.5, z: 0.2 }),
  ]);
}

function wheat(): THREE.BufferGeometry {
  const r = seeded(11);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 9; i++) {
    const h = 0.7 + r() * 0.45;
    parts.push(part(cone(0.045, h, 3), [0.34, 0.26, 0.12], { x: (r() - 0.5) * 1.3, z: (r() - 0.5) * 1.3, y: h / 2, rx: (r() - 0.5) * 0.5, rz: (r() - 0.5) * 0.5 }, 0.25));
    parts.push(part(new THREE.CapsuleGeometry(0.045, 0.16, 1, 4), [0.42, 0.32, 0.14], { x: (r() - 0.5) * 1.3, z: (r() - 0.5) * 1.3, y: h - 0.05 }, 0.2));
  }
  return merge(parts);
}

function grass(): THREE.BufferGeometry {
  const r = seeded(23);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const h = 0.5 + r() * 0.6;
    parts.push(part(cone(0.07, h, 3), [0.06, 0.1, 0.045], { x: (r() - 0.5), z: (r() - 0.5), y: h / 2, rx: (r() - 0.5) * 0.6, rz: (r() - 0.5) * 0.6 }, 0.3));
  }
  return merge(parts);
}

function reeds(): THREE.BufferGeometry {
  const r = seeded(31);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 8; i++) {
    const h = 1.2 + r() * 1.3;
    parts.push(part(cone(0.04, h, 3), [0.12, 0.12, 0.07], { x: (r() - 0.5) * 1.4, z: (r() - 0.5) * 1.4, y: h / 2 - 0.3, rx: (r() - 0.5) * 0.3 }, 0.2));
  }
  return merge(parts);
}

function post(): THREE.BufferGeometry {
  return merge([part(box(0.16, 1.3, 0.16), BARK, { y: 0.55, rz: 0.06 }), part(box(0.08, 0.1, 2.6), [0.08, 0.065, 0.05], { y: 0.9, z: 1.3 })]);
}

function pole(): THREE.BufferGeometry {
  return merge([
    part(cyl(0.09, 0.13, 7.5, 5), [0.06, 0.05, 0.045], { y: 3.75 }),
    part(box(1.8, 0.1, 0.1), [0.06, 0.05, 0.045], { y: 7.0 }),
    part(box(0.1, 0.12, 0.1), [0.2, 0.2, 0.18], { y: 7.1, x: 0.7 }),
    part(box(0.1, 0.12, 0.1), [0.2, 0.2, 0.18], { y: 7.1, x: -0.7 }),
  ]);
}

function scarecrow(): THREE.BufferGeometry {
  const cloth: RGB = [0.13, 0.1, 0.08];
  return merge([
    part(cyl(0.06, 0.07, 3, 4), BARK, { y: 1.5 }),
    part(box(2, 0.08, 0.08), BARK, { y: 2.3 }),
    part(box(0.6, 0.9, 0.3), cloth, { y: 2.0 }),
    part(box(1.9, 0.25, 0.26), cloth, { y: 2.3 }),
    part(ball(0.24, 6, 5), [0.2, 0.17, 0.12], { y: 2.75 }),
    part(cone(0.42, 0.45, 7), [0.08, 0.06, 0.05], { y: 3.05 }),
    part(cyl(0.45, 0.45, 0.04, 8), [0.08, 0.06, 0.05], { y: 2.88 }),
  ]);
}

function rock(scale: number, seed: number): THREE.BufferGeometry {
  const g = new THREE.DodecahedronGeometry(1, 0);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const r = seeded(seed);
  for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i) * (0.8 + r() * 0.4), pos.getY(i) * (0.55 + r() * 0.3), pos.getZ(i) * (0.8 + r() * 0.4));
  return merge([part(g, [0.11, 0.105, 0.1], { y: 0.3 * scale, s: scale }, 0.3)]);
}

function crystal(): THREE.BufferGeometry {
  const c: RGB = [0.55, 0.57, 0.62];
  return merge([
    part(new THREE.OctahedronGeometry(0.5, 0), c, { y: 0.4, sy: 1.8 }),
    part(new THREE.OctahedronGeometry(0.3, 0), c, { y: 0.25, x: 0.5, sy: 1.5, rz: 0.4 }),
  ]);
}

function ruin(): THREE.BufferGeometry {
  const wall: RGB = [0.09, 0.075, 0.065];
  return merge([
    part(box(6, 3.2, 0.3), wall, { y: 1.6 }),
    part(box(0.3, 2.2, 4), wall, { x: -3, y: 1.1, z: 2 }),
    part(box(2.2, 1.1, 0.3), wall, { x: 1.9, y: 3.6 }),
    part(box(0.9, 5.2, 0.9), [0.08, 0.065, 0.055], { x: 2.5, y: 2.6, z: 0.4 }),
    part(box(3.2, 0.2, 2.5), [0.06, 0.05, 0.04], { x: -1.2, y: 0.4, z: 2.5, rz: 0.25, rx: 0.1 }),
  ]);
}

export function propGeometry(kind: PropKind): THREE.BufferGeometry {
  switch (kind) {
    case "wheat":
      return wheat();
    case "post":
      return post();
    case "scarecrow":
      return scarecrow();
    case "deadtree":
      return deadTree(7);
    case "deadtree2":
      return deadTree(19);
    case "pine":
      return pine();
    case "birch":
      return birch();
    case "rock":
      return rock(0.9, 3);
    case "boulder":
      return rock(2.8, 9);
    case "reed":
      return reeds();
    case "crystal":
      return crystal();
    case "grass":
      return grass();
    case "ruin":
      return ruin();
    case "pole":
      return pole();
  }
}

// Streams instanced scenery in a window around the train. Placement is a pure
// function of cell index, so the same stretch of road always looks the same.

import * as THREE from "three";
import type { PropKind } from "./regions.ts";
import { CLEARINGS, U, propDensity, roadX, terrainHeight } from "./regions.ts";
import { hash2 } from "./noise.ts";
import { propGeometry } from "./props.ts";
import { vcMaterial } from "./geo.ts";

const CELL = 8;
const AHEAD = 300;
const BEHIND = 380;

interface KindSpec {
  kind: PropKind;
  slots: number;
  near: number;
  far: number;
  scale: [number, number];
  /** Regularly spaced along the road rather than scattered. */
  regular?: boolean;
  facing?: "east" | "road";
}

const SPECS: KindSpec[] = [
  { kind: "wheat", slots: 16, near: 5.5, far: 70, scale: [0.8, 1.3] },
  { kind: "grass", slots: 12, near: 5, far: 60, scale: [0.8, 1.5] },
  { kind: "post", slots: 1, near: 7, far: 7, scale: [1, 1], regular: true, facing: "road" },
  { kind: "pole", slots: 1, near: 10.5, far: 10.5, scale: [1, 1], regular: true, facing: "road" },
  { kind: "scarecrow", slots: 1, near: 10, far: 45, scale: [0.95, 1.15], facing: "east" },
  { kind: "deadtree", slots: 2, near: 8, far: 110, scale: [0.8, 1.5] },
  { kind: "deadtree2", slots: 2, near: 9, far: 120, scale: [0.7, 1.4] },
  { kind: "pine", slots: 12, near: 8.5, far: 170, scale: [0.8, 1.7] },
  { kind: "birch", slots: 3, near: 8, far: 90, scale: [0.8, 1.3] },
  { kind: "rock", slots: 3, near: 6, far: 100, scale: [0.5, 1.6] },
  { kind: "boulder", slots: 2, near: 11, far: 130, scale: [0.6, 1.6] },
  { kind: "reed", slots: 9, near: 6, far: 45, scale: [0.8, 1.3] },
  { kind: "crystal", slots: 3, near: 6, far: 80, scale: [0.6, 1.6] },
  { kind: "ruin", slots: 1, near: 22, far: 90, scale: [0.9, 1.2] },
];

export interface Clearing {
  x: number;
  z: number;
  r: number;
}

export class Scenery {
  group = new THREE.Group();
  private meshes = new Map<PropKind, THREE.InstancedMesh>();
  private lastCell = Number.NaN;
  private clearings: Clearing[] = [];
  private dirty = true;
  private density: number;

  constructor(quality: number) {
    this.density = quality > 0.5 ? 1 : 0.55;
    const cells = Math.ceil((AHEAD + BEHIND) / CELL) + 2;
    for (const spec of SPECS) {
      const mesh = new THREE.InstancedMesh(propGeometry(spec.kind), vcMaterial(), spec.slots * cells * 2);
      mesh.count = 0;
      mesh.frustumCulled = false;
      this.meshes.set(spec.kind, mesh);
      this.group.add(mesh);
    }
  }

  setClearings(list: Clearing[]): void {
    this.clearings = list;
    this.dirty = true;
  }

  update(trainZ: number): void {
    const cell = Math.floor(trainZ / CELL);
    if (cell === this.lastCell && !this.dirty) return;
    this.lastCell = cell;
    this.dirty = false;
    this.rebuild(trainZ);
  }

  private cleared(x: number, z: number): boolean {
    for (const c of this.clearings) if ((x - c.x) ** 2 + (z - c.z) ** 2 < c.r * c.r) return true;
    for (const c of CLEARINGS) if (c.w > 0 && (x - c.x) ** 2 + (z - c.y) ** 2 < (c.z + 8) ** 2) return true;
    return false;
  }

  /** Call after changing CLEARINGS so props are re-placed. */
  invalidate(): void {
    this.dirty = true;
  }

  private rebuild(trainZ: number): void {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const sc = new THREE.Vector3();
    const c0 = Math.floor((trainZ - AHEAD) / CELL);
    const c1 = Math.ceil((trainZ + BEHIND) / CELL);
    SPECS.forEach((spec, si) => {
      const mesh = this.meshes.get(spec.kind)!;
      let n = 0;
      for (let c = c0; c <= c1; c++) {
        const zc = c * CELL;
        const miles = -zc / U;
        const dens = propDensity(spec.kind, miles) * (spec.regular ? 1 : this.density);
        if (dens <= 0.001) continue;
        for (let s = 0; s < spec.slots; s++) {
          for (const side of [-1, 1]) {
            const k = si * 131 + s * 7 + (side > 0 ? 3 : 0);
            if (spec.regular) {
              if (spec.kind === "pole" && (side > 0 || c % 5 !== 0)) continue;
              if (spec.kind === "post" && hash2(c, k + 1) > dens * 0.85) continue;
            } else if (hash2(c, k) > dens) continue;
            const z = zc + (spec.regular ? 0 : hash2(c, k + 11) * CELL);
            const t = hash2(c, k + 23);
            const off = spec.near + (spec.far - spec.near) * t * t;
            const x = roadX(z) + side * off;
            if (this.cleared(x, z)) continue;
            const y = terrainHeight(x, z);
            const s0 = spec.scale[0] + (spec.scale[1] - spec.scale[0]) * hash2(c, k + 37);
            let ry = hash2(c, k + 51) * Math.PI * 2;
            if (spec.facing === "east") ry = Math.PI + (hash2(c, k + 51) - 0.5) * 0.2;
            if (spec.facing === "road") ry = side > 0 ? -Math.PI / 2 : Math.PI / 2;
            e.set((hash2(c, k + 61) - 0.5) * 0.08, ry, (hash2(c, k + 67) - 0.5) * 0.08);
            q.setFromEuler(e);
            p.set(x, y - 0.05, z);
            sc.set(s0, s0, s0);
            m.compose(p, q, sc);
            if (n < mesh.instanceMatrix.count) mesh.setMatrixAt(n++, m);
          }
        }
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
    });
  }
}

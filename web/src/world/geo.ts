// Small helpers for building low-poly, vertex-coloured geometry from primitives.

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { keep } from "./dispose.ts";

export type RGB = [number, number, number];

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();

export interface Place {
  x?: number;
  y?: number;
  z?: number;
  rx?: number;
  ry?: number;
  rz?: number;
  sx?: number;
  sy?: number;
  sz?: number;
  s?: number;
}

/** Colour, transform, and strip a primitive so it can be merged with others. */
export function part(geo: THREE.BufferGeometry, color: RGB, at: Place = {}, jitter = 0): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute("uv");
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const j = jitter ? 1 + (Math.sin(i * 12.9898) * 43758.5453 % 1) * jitter : 1;
    col[i * 3] = color[0] * j;
    col[i * 3 + 1] = color[1] * j;
    col[i * 3 + 2] = color[2] * j;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  tmpE.set(at.rx ?? 0, at.ry ?? 0, at.rz ?? 0);
  tmpQ.setFromEuler(tmpE);
  const s = at.s ?? 1;
  tmpM.compose(new THREE.Vector3(at.x ?? 0, at.y ?? 0, at.z ?? 0), tmpQ, new THREE.Vector3((at.sx ?? 1) * s, (at.sy ?? 1) * s, (at.sz ?? 1) * s));
  g.applyMatrix4(tmpM);
  return g;
}

export function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(parts, false);
  if (!g) throw new Error("mergeGeometries failed");
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

export const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
export const cyl = (rt: number, rb: number, h: number, seg = 6) => new THREE.CylinderGeometry(rt, rb, h, seg);
export const cone = (r: number, h: number, seg = 6) => new THREE.ConeGeometry(r, h, seg);
export const ball = (r: number, w = 6, h = 5) => new THREE.SphereGeometry(r, w, h);

/** A small seeded random stream for building varied geometry deterministically. */
export function seeded(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const MAT_CACHE = new Map<string, THREE.Material>();

export function vcMaterial(key = "vc", opts: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  const hit = MAT_CACHE.get(key);
  if (hit) return hit as THREE.MeshStandardMaterial;
  const m = keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, flatShading: true, ...opts }));
  MAT_CACHE.set(key, m);
  return m;
}

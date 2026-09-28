// How each stretch of the road looks. Region boundaries come from the sim's
// world data; everything visual (relief, colors, scenery density) lives here.

import { REGIONS } from "../../../src/game/world.ts";
import type { RegionId } from "../../../src/game/types.ts";
import * as THREE from "three";
import { clamp01, fbm, vnoise, smoothstep } from "./noise.ts";

/** World units per mile of road. */
export const U = 12;
export const ROAD_HALF = 3.4;
const BLEND = 3; // miles over which one region fades into the next

export type PropKind =
  | "wheat"
  | "post"
  | "scarecrow"
  | "deadtree"
  | "deadtree2"
  | "pine"
  | "rock"
  | "boulder"
  | "reed"
  | "crystal"
  | "grass"
  | "birch"
  | "ruin"
  | "pole";

export interface RegionLook {
  id: RegionId;
  /** Rolling hills amplitude. */
  amp: number;
  /** Small-scale roughness amplitude. */
  rough: number;
  /** Ground level away from the road (the fen sits below its water). */
  base: number;
  /** Mountain height far from the road. */
  mount: number;
  ground: [number, number, number];
  ground2: [number, number, number];
  road: [number, number, number];
  /** Height of the distant horizon silhouette. */
  horizon: number;
  water: number;
  props: Partial<Record<PropKind, number>>;
}

export const LOOKS: RegionLook[] = [
  {
    id: "tallow",
    amp: 3.2,
    rough: 0.4,
    base: 0,
    mount: 6,
    ground: [0.2, 0.15, 0.08],
    ground2: [0.13, 0.1, 0.06],
    road: [0.1, 0.08, 0.065],
    horizon: 30,
    water: 0,
    props: { wheat: 0.95, post: 1, scarecrow: 0.05, deadtree: 0.12, deadtree2: 0.08, ruin: 0.03, pole: 1, grass: 0.4 },
  },
  {
    id: "fen",
    amp: 0.8,
    rough: 0.5,
    base: -1.5,
    mount: 3,
    ground: [0.08, 0.09, 0.06],
    ground2: [0.05, 0.06, 0.045],
    road: [0.075, 0.06, 0.045],
    horizon: 18,
    water: 1,
    props: { deadtree: 0.45, deadtree2: 0.35, reed: 1, post: 0.5, pole: 1, ruin: 0.02 },
  },
  {
    id: "flats",
    amp: 0.25,
    rough: 0.05,
    base: 0,
    mount: 0,
    ground: [0.24, 0.24, 0.26],
    ground2: [0.17, 0.17, 0.19],
    road: [0.2, 0.18, 0.17],
    horizon: 10,
    water: 0,
    props: { crystal: 0.35, rock: 0.12, pole: 1 },
  },
  {
    id: "pines",
    amp: 6,
    rough: 0.5,
    base: 0,
    mount: 18,
    ground: [0.05, 0.075, 0.055],
    ground2: [0.035, 0.05, 0.04],
    road: [0.07, 0.055, 0.045],
    horizon: 60,
    water: 0,
    props: { pine: 1, deadtree: 0.2, rock: 0.25, grass: 0.3 },
  },
  {
    id: "spine",
    amp: 7,
    rough: 1.2,
    base: 0,
    mount: 70,
    ground: [0.16, 0.155, 0.16],
    ground2: [0.09, 0.09, 0.1],
    road: [0.12, 0.11, 0.1],
    horizon: 150,
    water: 0,
    props: { boulder: 0.7, rock: 1, pine: 0.25 },
  },
  {
    id: "threshold",
    amp: 2.5,
    rough: 0.3,
    base: 0,
    mount: 10,
    ground: [0.1, 0.16, 0.08],
    ground2: [0.07, 0.11, 0.06],
    road: [0.1, 0.085, 0.065],
    horizon: 40,
    water: 0,
    props: { grass: 1, birch: 0.35, rock: 0.2, wheat: 0.3 },
  },
];

export const REGION_LO = REGIONS.map((r, i) => (i === 0 ? -1e6 : r.start));
export const REGION_HI = REGIONS.map((r, i) => (i === REGIONS.length - 1 ? 1e6 : r.end));

export function regionWeights(miles: number, out: number[] = new Array(LOOKS.length).fill(0)): number[] {
  let sum = 0;
  for (let i = 0; i < LOOKS.length; i++) {
    const w = clamp01((miles - REGION_LO[i] + BLEND) / (2 * BLEND)) * clamp01((REGION_HI[i] + BLEND - miles) / (2 * BLEND));
    out[i] = w;
    sum += w;
  }
  for (let i = 0; i < LOOKS.length; i++) out[i] = sum > 0 ? out[i] / sum : i === 0 ? 1 : 0;
  return out;
}

export function roadX(z: number): number {
  return 6 * Math.sin(z * 0.011) + 3.5 * Math.sin(z * 0.027 + 1.3);
}

export function roadHeading(z: number): number {
  const dx = 6 * 0.011 * Math.cos(z * 0.011) + 3.5 * 0.027 * Math.cos(z * 0.027 + 1.3);
  // Travelling toward -z, a change dx/dz rotates the heading about y.
  return Math.atan2(dx, 1);
}

const W: number[] = new Array(LOOKS.length).fill(0);

/**
 * Flattened ground for camps and landmarks: x, z, radius, strength (0 = off).
 * Shared by reference with the terrain shader's uniform.
 */
export const CLEARINGS = [new THREE.Vector4(0, 0, 1, 0), new THREE.Vector4(0, 0, 1, 0)];

function clearingFactor(x: number, z: number): number {
  let f = 1;
  for (const c of CLEARINGS) {
    if (c.w <= 0) continue;
    const d = Math.hypot(x - c.x, z - c.y);
    f *= 1 - c.w * (1 - smoothstep(c.z, c.z + 12, d));
  }
  return f;
}

export function terrainHeight(x: number, z: number): number {
  regionWeights(-z / U, W);
  let amp = 0;
  let rough = 0;
  let base = 0;
  let mount = 0;
  for (let i = 0; i < LOOKS.length; i++) {
    amp += W[i] * LOOKS[i].amp;
    rough += W[i] * LOOKS[i].rough;
    base += W[i] * LOOKS[i].base;
    mount += W[i] * LOOKS[i].mount;
  }
  const d = Math.abs(x - roadX(z));
  let h = base + (fbm(x * 0.018, z * 0.018) - 0.45) * amp * 2;
  h += (vnoise(x * 0.09, z * 0.09) - 0.5) * rough * 2;
  const m = fbm(x * 0.006 + 17, z * 0.006 + 3);
  h += smoothstep(25, 170, d) * mount * Math.max(0, m - 0.3) * 2.2;
  return h * smoothstep(ROAD_HALF + 1, 13, d) * clearingFactor(x, z);
}

export function propDensity(kind: PropKind, miles: number): number {
  regionWeights(miles, W);
  let v = 0;
  for (let i = 0; i < LOOKS.length; i++) v += W[i] * (LOOKS[i].props[kind] ?? 0);
  return v;
}

export function blendLook(miles: number): { horizon: number; water: number; ground: [number, number, number] } {
  regionWeights(miles, W);
  let horizon = 0;
  let water = 0;
  const ground: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < LOOKS.length; i++) {
    horizon += W[i] * LOOKS[i].horizon;
    water += W[i] * LOOKS[i].water;
    for (let k = 0; k < 3; k++) ground[k] += W[i] * LOOKS[i].ground[k];
  }
  return { horizon, water, ground };
}

/** GLSL for the same height function, parameterised by uniform arrays. */
export const GLSL_TERRAIN = /* glsl */ `
#define REGIONS ${LOOKS.length}
#define UNITS ${U.toFixed(1)}
#define ROAD_HALF ${ROAD_HALF.toFixed(2)}
uniform float uRegLo[REGIONS];
uniform float uRegHi[REGIONS];
uniform float uAmp[REGIONS];
uniform float uRough[REGIONS];
uniform float uBase[REGIONS];
uniform float uMount[REGIONS];
uniform vec3 uGround[REGIONS];
uniform vec3 uGround2[REGIONS];
uniform vec3 uRoad[REGIONS];
uniform vec4 uClear[2];
float roadX(float z) { return 6.0 * sin(z * 0.011) + 3.5 * sin(z * 0.027 + 1.3); }
void regionW(float miles, out float w[REGIONS]) {
  float sum = 0.0;
  for (int i = 0; i < REGIONS; i++) {
    float v = clamp((miles - uRegLo[i] + ${BLEND.toFixed(1)}) / ${(2 * BLEND).toFixed(1)}, 0.0, 1.0) *
              clamp((uRegHi[i] + ${BLEND.toFixed(1)} - miles) / ${(2 * BLEND).toFixed(1)}, 0.0, 1.0);
    w[i] = v;
    sum += v;
  }
  for (int i = 0; i < REGIONS; i++) w[i] = sum > 0.0 ? w[i] / sum : 0.0;
}
float terrainH(vec2 p) {
  float w[REGIONS];
  regionW(-p.y / UNITS, w);
  float amp = 0.0, rough = 0.0, base = 0.0, mount = 0.0;
  for (int i = 0; i < REGIONS; i++) {
    amp += w[i] * uAmp[i]; rough += w[i] * uRough[i]; base += w[i] * uBase[i]; mount += w[i] * uMount[i];
  }
  float d = abs(p.x - roadX(p.y));
  float h = base + (fbm(p * 0.018) - 0.45) * amp * 2.0;
  h += (vnoise(p * 0.09) - 0.5) * rough * 2.0;
  float m = fbm(p * 0.006 + vec2(17.0, 3.0));
  h += smoothstep(25.0, 170.0, d) * mount * max(0.0, m - 0.3) * 2.2;
  float f = 1.0;
  for (int i = 0; i < 2; i++) {
    if (uClear[i].w > 0.0) f *= 1.0 - uClear[i].w * (1.0 - smoothstep(uClear[i].z, uClear[i].z + 12.0, distance(p, uClear[i].xy)));
  }
  return h * smoothstep(ROAD_HALF + 1.0, 13.0, d) * f;
}
void regionColors(float miles, out vec3 g1, out vec3 g2, out vec3 road) {
  float w[REGIONS];
  regionW(miles, w);
  g1 = vec3(0.0); g2 = vec3(0.0); road = vec3(0.0);
  for (int i = 0; i < REGIONS; i++) { g1 += w[i] * uGround[i]; g2 += w[i] * uGround2[i]; road += w[i] * uRoad[i]; }
}
`;

export function terrainUniforms(): Record<string, { value: unknown }> {
  const v3 = (pick: (l: RegionLook) => [number, number, number]) => LOOKS.map((l) => pick(l)).flat();
  return {
    uRegLo: { value: REGION_LO.slice() },
    uRegHi: { value: REGION_HI.slice() },
    uAmp: { value: LOOKS.map((l) => l.amp) },
    uRough: { value: LOOKS.map((l) => l.rough) },
    uBase: { value: LOOKS.map((l) => l.base) },
    uMount: { value: LOOKS.map((l) => l.mount) },
    uGround: { value: v3((l) => l.ground) },
    uGround2: { value: v3((l) => l.ground2) },
    uRoad: { value: v3((l) => l.road) },
    uClear: { value: CLEARINGS },
  };
}

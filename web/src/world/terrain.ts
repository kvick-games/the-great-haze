// Ground, road, fen water, and the distant hills. The ground mesh travels with
// the train in whole-cell steps and is displaced in the vertex shader, so the
// land is fixed in the world while only a few thousand vertices exist.

import * as THREE from "three";
import { GLSL_NOISE } from "./noise.ts";
import { GLSL_TERRAIN, U, blendLook, terrainUniforms } from "./regions.ts";

const STEP_Z = 3;
const HALF_WIDTH = 260;
const AHEAD = 420; // world units toward -z
const BEHIND = 420; // toward +z, where the Haze is

function buildGrid(quality: number): THREE.BufferGeometry {
  // Columns are dense near the road and coarse at the edges.
  const cols = quality > 0.5 ? 110 : 70;
  const xs: number[] = [];
  for (let i = 0; i <= cols; i++) {
    const t = (i / cols) * 2 - 1;
    xs.push(Math.sign(t) * Math.pow(Math.abs(t), 1.7) * HALF_WIDTH);
  }
  const rows = Math.round((AHEAD + BEHIND) / STEP_Z);
  const pos = new Float32Array((cols + 1) * (rows + 1) * 3);
  let k = 0;
  for (let r = 0; r <= rows; r++) {
    const z = -AHEAD + r * STEP_Z;
    for (let c = 0; c <= cols; c++) {
      pos[k++] = xs[c];
      pos[k++] = 0;
      pos[k++] = z;
    }
  }
  const idx: number[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = r * (cols + 1) + c;
      const b = a + 1;
      const d = a + cols + 1;
      const e = d + 1;
      idx.push(a, d, b, b, d, e);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

export class Terrain {
  ground: THREE.Mesh;
  water: THREE.Mesh;
  hills: THREE.Mesh[] = [];
  uniforms: Record<string, THREE.IUniform>;
  private hillMats: THREE.ShaderMaterial[] = [];

  constructor(quality: number) {
    this.uniforms = {
      ...terrainUniforms(),
      uBlood: { value: 0 },
      uTime: { value: 0 },
      uHazeFog: { value: new THREE.Color(0.1, 0.01, 0.01) },
    } as Record<string, THREE.IUniform>;
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0, flatShading: true });
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>\n${GLSL_NOISE}\n${GLSL_TERRAIN}\nvarying vec3 vWorldP;\nvarying vec3 vGround;\nvarying vec3 vRoadCol;`,
        )
        .replace(
          "#include <begin_vertex>",
          `vec4 wp0 = modelMatrix * vec4(position, 1.0);
           float hgt = terrainH(wp0.xz);
           vec3 transformed = vec3(position.x, position.y + hgt, position.z);
           vWorldP = vec3(wp0.x, hgt, wp0.z);
           vec3 g1; vec3 g2; vec3 rd;
           regionColors(-wp0.z / UNITS, g1, g2, rd);
           vGround = mix(g2, g1, fbm(wp0.xz * 0.05));
           vRoadCol = rd;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>\n${GLSL_NOISE}\n${GLSL_TERRAIN}\nuniform float uBlood;\nuniform vec3 uHazeFog;\nvarying vec3 vWorldP;\nvarying vec3 vGround;\nvarying vec3 vRoadCol;\nfloat roadMaskF;\nfloat wetF;`,
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
           {
             vec3 rd = vRoadCol;
             float dx = vWorldP.x - roadX(vWorldP.z);
             float ad = abs(dx);
             float edge = ROAD_HALF + (vnoise(vWorldP.xz * 0.6) - 0.5) * 1.2;
             roadMaskF = 1.0 - smoothstep(edge - 0.6, edge + 0.4, ad);
             float rut = 1.0 - smoothstep(0.12, 0.42, abs(ad - 1.15));
             vec3 roadCol = rd * (0.85 + 0.3 * vnoise(vWorldP.xz * 1.7)) * (1.0 - 0.45 * rut);
             vec3 groundCol = vGround * (0.8 + 0.4 * vnoise(vWorldP.xz * 0.35));
             vec3 col = mix(groundCol, roadCol, roadMaskF);
             // Blood pools in the ruts as the Haze closes, like the road concept.
             wetF = 0.0;
             if (uBlood > 0.01 && roadMaskF > 0.0) {
               float pool = smoothstep(0.62 - uBlood * 0.22, 0.7 - uBlood * 0.22, fbm(vWorldP.xz * 0.23 + 9.0)) * (rut * 0.7 + 0.3) * roadMaskF;
               wetF = pool;
             }
             col = mix(col, vec3(0.16, 0.0, 0.004), wetF);
             diffuseColor.rgb = col;
           }`,
        )
        .replace(
          "#include <fog_fragment>",
          `#ifdef USE_FOG
             float fogF = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
             vec3 fdir = normalize(vWorldP - cameraPosition);
             vec3 fcol = mix(fogColor, uHazeFog, smoothstep(-0.3, 1.0, fdir.z));
             gl_FragColor.rgb = mix(gl_FragColor.rgb, fcol, fogF);
           #endif`,
        )
        .replace(
          "#include <roughnessmap_fragment>",
          `#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.18, wetF);`,
        );
    };
    this.ground = new THREE.Mesh(buildGrid(quality), mat);
    this.ground.frustumCulled = false;
    this.ground.receiveShadow = false;

    const waterMat = new THREE.MeshStandardMaterial({ color: 0x05070a, roughness: 0.12, metalness: 0.2 });
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(600, 900).rotateX(-Math.PI / 2), waterMat);
    this.water.position.y = -40;

    // Two rings of hills far beyond the fog, drawn as flat silhouettes.
    for (const [radius, shade, seed] of [
      [760, 0.8, 1.7],
      [1050, 0.55, 4.1],
    ] as const) {
      const segs = 256;
      const geo = new THREE.CylinderGeometry(radius, radius, 1, segs, 1, true);
      const pos = geo.attributes.position as THREE.BufferAttribute;
      const topH = new Float32Array(pos.count);
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const a = Math.atan2(z, x);
        const top = pos.getY(i) > 0;
        const n =
          0.55 * (Math.sin(a * 3 + seed) * 0.5 + 0.5) +
          0.3 * (Math.sin(a * 11 + seed * 3.1) * 0.5 + 0.5) +
          0.15 * (Math.sin(a * 29 + seed * 7.3) * 0.5 + 0.5);
        topH[i] = top ? n : 0;
        pos.setY(i, top ? 1 : -30);
      }
      geo.setAttribute("aTop", new THREE.BufferAttribute(topH, 1));
      const hm = new THREE.ShaderMaterial({
        uniforms: { uHeight: { value: 20 }, uColor: { value: new THREE.Color() }, uShade: { value: shade } },
        vertexShader: `attribute float aTop; uniform float uHeight; varying float vY;
          void main() { vec3 p = position; if (p.y > 0.0) p.y = aTop * uHeight + 2.0; vY = p.y;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
        fragmentShader: `uniform vec3 uColor; uniform float uShade; varying float vY;
          void main() { gl_FragColor = vec4(uColor * uShade, 1.0); }`,
        side: THREE.BackSide,
        fog: false,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, hm);
      mesh.renderOrder = -9;
      mesh.frustumCulled = false;
      this.hills.push(mesh);
      this.hillMats.push(hm);
    }
  }

  addTo(scene: THREE.Scene): void {
    scene.add(this.ground, this.water, ...this.hills);
  }

  update(trainZ: number, camera: THREE.Camera, fogColor: THREE.Color, blood: number, time: number): void {
    this.ground.position.z = Math.round(trainZ / STEP_Z) * STEP_Z;
    this.uniforms.uBlood.value = blood;
    this.uniforms.uTime.value = time;
    const look = blendLook(-trainZ / U);
    this.water.position.set(0, look.water > 0.05 ? -0.55 : -40, trainZ);
    for (let i = 0; i < this.hills.length; i++) {
      const h = this.hills[i];
      h.position.set(camera.position.x, 0, camera.position.z);
      const m = this.hillMats[i];
      m.uniforms.uHeight.value = look.horizon * (i === 0 ? 1 : 1.6) + 6;
      (m.uniforms.uColor.value as THREE.Color).copy(fogColor).multiplyScalar(i === 0 ? 0.55 : 0.8);
    }
  }
}

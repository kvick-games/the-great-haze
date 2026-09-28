// The Great Haze: a wall of churning crimson fog on the eastern horizon whose
// distance is the sim's gap, low mist that creeps ahead of it, and red ash in
// the air when it is close.

import * as THREE from "three";
import { GLSL_HASH } from "./noise.ts";

const wallVertex = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const wallFragment = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
uniform float uTime;
uniform float uSeed;
uniform float uGlow;
uniform float uAlpha;
uniform vec3 uCam;
${GLSL_HASH}
float n2(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * n2(p); p = p * 2.1 + 7.7; a *= 0.5; } return s; }
void main() {
  vec2 p = vec2(vUv.x * 9.0, vUv.y * 3.2);
  float t = uTime * 0.035;
  vec2 warp = vec2(fbm(p + vec2(uSeed, t)), fbm(p + vec2(t * 0.7, uSeed + 3.0)));
  float n = fbm(p * 1.3 + warp * 1.6 + vec2(0.0, -t * 1.5));
  // Dense at the base, tearing into billows toward the top.
  float top = mix(0.52, 0.95, fbm(vec2(vUv.x * 5.0 + uSeed, t * 0.4)));
  float body = 1.0 - smoothstep(top - 0.35, top, vUv.y + (n - 0.5) * 0.35);
  float density = clamp(body * (0.55 + n * 0.9), 0.0, 1.0);
  // Glowing from inside, brightest low down, with slow pulses like something breathing.
  float pulse = 0.75 + 0.25 * sin(uTime * 0.6 + vUv.x * 6.0 + uSeed);
  float inner = smoothstep(0.35, 0.9, n) * (1.0 - vUv.y) * pulse;
  vec3 deep = vec3(0.018, 0.002, 0.003);
  vec3 blood = vec3(0.34, 0.02, 0.018);
  vec3 hot = vec3(1.7, 0.2, 0.07);
  // Smoke above, lit crimson from below and within.
  float under = pow(1.0 - vUv.y, 2.2);
  vec3 col = mix(deep, blood, smoothstep(0.3, 0.85, n) * (0.35 + 0.65 * under));
  col += hot * inner * inner * uGlow * (0.4 + under);
  col *= 0.45 + 0.9 * uGlow;
  // Soft sides so the wall never shows an edge.
  float side = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
  gl_FragColor = vec4(col, density * side * uAlpha);
}
`;

const mistFragment = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
uniform float uTime;
uniform float uReach;
uniform float uWallZ;
uniform float uStrength;
${GLSL_HASH}
float n2(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * n2(p); p = p * 2.1 + 7.7; a *= 0.5; } return s; }
void main() {
  vec2 p = vWorld.xz * 0.025 + vec2(uTime * 0.02, -uTime * 0.035);
  float n = fbm(p + fbm(p * 1.7 + 3.0));
  // Thick near the wall, thinning out uReach units ahead of it.
  float along = clamp((vWorld.z - (uWallZ - uReach)) / max(uReach, 1.0), 0.0, 1.0);
  float a = smoothstep(0.35, 0.8, n) * along * uStrength;
  vec3 col = mix(vec3(0.12, 0.004, 0.006), vec3(0.55, 0.04, 0.03), n);
  gl_FragColor = vec4(col, a * 0.85);
}
`;

export class Haze {
  group = new THREE.Group();
  private walls: THREE.Mesh[] = [];
  private wallMats: THREE.ShaderMaterial[] = [];
  private mists: THREE.Mesh[] = [];
  private mistMat: THREE.ShaderMaterial;
  ash: THREE.Points;
  private ashVel: Float32Array;
  /** Distance from the train's rear to the leading edge of the Haze, in world units. */
  distance = 300;
  proximity = 0;

  constructor(quality: number) {
    const layers = quality > 0.5 ? 3 : 2;
    for (let i = 0; i < layers; i++) {
      const mat = new THREE.ShaderMaterial({
        vertexShader: wallVertex,
        fragmentShader: wallFragment,
        uniforms: {
          uTime: { value: 0 },
          uSeed: { value: i * 13.7 },
          uGlow: { value: 0.5 },
          uAlpha: { value: 1 - i * 0.12 },
          uCam: { value: new THREE.Vector3() },
        },
        transparent: true,
        depthWrite: false,
        fog: false,
        side: THREE.DoubleSide,
      });
      // A shallow arc, concave toward the train, so it wraps the horizon. The
      // arc's centre sits at local z = 0 and its ends curve toward -z.
      const height = 210 - i * 30;
      const geo = new THREE.CylinderGeometry(900, 900, height, 64, 1, true, -0.6, 1.2);
      geo.translate(0, height / 2 - 30, -900);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = 5 + i;
      mesh.frustumCulled = false;
      this.walls.push(mesh);
      this.wallMats.push(mat);
      this.group.add(mesh);
    }
    this.mistMat = new THREE.ShaderMaterial({
      vertexShader: wallVertex,
      fragmentShader: mistFragment,
      uniforms: { uTime: { value: 0 }, uReach: { value: 60 }, uWallZ: { value: 300 }, uStrength: { value: 1 } },
      transparent: true,
      depthWrite: false,
      fog: false,
      side: THREE.DoubleSide,
    });
    for (let i = 0; i < (quality > 0.5 ? 4 : 2); i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(700, 700).rotateX(-Math.PI / 2), this.mistMat);
      m.position.y = 0.4 + i * 0.9;
      m.renderOrder = 4;
      m.frustumCulled = false;
      this.mists.push(m);
      this.group.add(m);
    }
    // Drifting red ash, kept in a box around the camera.
    const count = quality > 0.5 ? 900 : 400;
    const pos = new Float32Array(count * 3);
    this.ashVel = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 80;
      pos[i * 3 + 1] = Math.random() * 25;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 80;
      this.ashVel[i] = 0.3 + Math.random() * 0.7;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.ash = new THREE.Points(
      g,
      new THREE.PointsMaterial({ color: new THREE.Color(1.4, 0.18, 0.1), size: 0.12, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this.ash.frustumCulled = false;
    this.group.add(this.ash);
  }

  /** gap is in world units; proximity 0 (far) .. 1 (upon). */
  update(trainRearZ: number, camera: THREE.Camera, time: number, dt: number): void {
    const wallZ = trainRearZ + this.distance;
    const glow = 0.35 + this.proximity * 1.1;
    this.walls.forEach((w, i) => {
      w.position.set(camera.position.x, 0, wallZ + i * 22);
      const u = this.wallMats[i].uniforms;
      u.uTime.value = time;
      u.uGlow.value = glow;
    });
    const mu = this.mistMat.uniforms;
    mu.uTime.value = time;
    mu.uWallZ.value = wallZ;
    mu.uReach.value = 50 + this.proximity * 260;
    mu.uStrength.value = 0.25 + this.proximity * 0.75;
    for (const m of this.mists) m.position.set(camera.position.x, m.position.y, wallZ - 330);
    // Ash thickens as the Haze closes.
    const mat = this.ash.material as THREE.PointsMaterial;
    mat.opacity = Math.max(0, (this.proximity - 0.25) / 0.75) * 0.9;
    const pos = this.ash.geometry.attributes.position as THREE.BufferAttribute;
    const cx = camera.position.x;
    const cz = camera.position.z;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i) + Math.sin(time * 0.3 + i) * dt * 0.4;
      let y = pos.getY(i) - this.ashVel[i] * dt;
      let z = pos.getZ(i) - dt * 1.2 * this.ashVel[i];
      if (y < 0) y += 25;
      if (x - cx > 40) x -= 80;
      if (x - cx < -40) x += 80;
      if (z - cz > 40) z -= 80;
      if (z - cz < -40) z += 80;
      pos.setXYZ(i, x, y, z);
    }
    pos.needsUpdate = true;
  }
}

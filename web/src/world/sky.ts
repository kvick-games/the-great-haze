// The sky is the game's gauge. Far from the Haze it is the night-camp concept:
// navy and teal cloud, a real starfield, red stains bleeding in like paint.
// Close to it, it becomes the road concept: black smoke, oxblood cloud, a
// blood moon. +z is east, toward the Haze; the Blue Reach lies at -z.

import * as THREE from "three";
import { GLSL_HASH } from "./noise.ts";

const vertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}
`;

const fragment = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform float uTime;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uCloud;
uniform float uStain;
uniform float uHaze;
uniform float uNight;
uniform float uReach;
uniform float uFlare;
uniform vec3 uMoonDir;
uniform vec3 uMoonColor;
uniform vec3 uFog;
uniform vec3 uHazeFog;
${GLSL_HASH}
float n2(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
float fbm5(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * n2(p); p = p * 2.07 + 13.1; a *= 0.5; }
  return s;
}
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  float up = max(h, 0.0);

  // Base gradient.
  vec3 col = mix(uHorizon, uZenith, pow(smoothstep(-0.05, 0.75, h), 0.7));

  // Glow of the Haze on the eastern horizon, and the Blue Reach on the western one.
  float east = smoothstep(-0.3, 1.0, d.z);
  float band = exp(-abs(h - 0.02) * 7.0);
  col += vec3(0.55, 0.05, 0.03) * band * east * (0.25 + 1.6 * uHaze);
  col = mix(col, vec3(0.16, 0.012, 0.01), smoothstep(0.3, 1.0, uHaze) * (0.35 + 0.5 * east) * smoothstep(-0.1, 0.5, h + 0.2));
  float west = smoothstep(0.1, 1.0, -d.z);
  col += vec3(0.25, 0.55, 0.85) * exp(-abs(h - 0.04) * 9.0) * west * uReach * 1.6;

  // Stars, dimmed by smoke and by daylight.
  vec2 sp = vec2(atan(d.z, d.x) * 180.0 / 3.14159, acos(clamp(h, -1.0, 1.0)) * 120.0 / 3.14159);
  vec2 cell = floor(sp);
  float rnd = hash12(cell);
  vec2 jitter = vec2(hash12(cell + 7.1), hash12(cell + 3.3)) * 0.7 + 0.15;
  float dist = length(fract(sp) - jitter);
  float star = step(0.955, rnd) * smoothstep(0.12, 0.0, dist) * (0.6 + 0.4 * sin(uTime * (1.0 + rnd * 3.0) + rnd * 40.0));
  float starVis = uNight * (1.0 - 0.85 * uHaze) * smoothstep(0.02, 0.2, h);

  // Clouds, projected onto a dome.
  vec2 cp = d.xz / (up + 0.12);
  float c = fbm5(cp * 0.9 + vec2(uTime * 0.004, 0.0));
  float cloud = smoothstep(0.52, 0.8, c) * smoothstep(-0.02, 0.1, h) * (1.0 - smoothstep(0.55, 0.95, h));
  float lit = smoothstep(0.55, 0.9, fbm5(cp * 1.7 + 4.0));
  vec3 cloudCol = mix(uCloud * 0.35, uCloud, lit);

  float clear = uReach * smoothstep(-0.25, 0.8, -d.z);
  // Blood stains: paint-like blotches and drips, heavier toward the Haze.
  vec2 bp = cp * 0.75 + vec2(fbm5(cp * 0.6) * 1.4, 0.0) + vec2(0.0, uTime * 0.002);
  float blot = fbm5(bp * 1.3 + 31.0);
  float drip = fbm5(vec2(bp.x * 3.5, bp.y * 0.9) + 51.0);
  float bias = mix(0.25, 1.0, east);
  float thresh = mix(0.9, 0.46, clamp(uStain * bias, 0.0, 1.0));
  float stain = smoothstep(thresh, thresh + 0.05, max(blot, drip * 0.96)) * smoothstep(-0.02, 0.2, h) * (1.0 - clear);
  vec3 stainCol = mix(vec3(0.3, 0.005, 0.01), vec3(0.85, 0.05, 0.05), smoothstep(thresh + 0.02, thresh + 0.2, blot));

  // The Blue Reach: the western half of the sky clears to a fragile blue.
  col = mix(col, mix(vec3(0.22, 0.42, 0.62), vec3(0.05, 0.14, 0.32), smoothstep(0.0, 0.7, h)), clear * 0.85 * smoothstep(-0.05, 0.1, h));
  cloudCol = mix(cloudCol, vec3(0.55, 0.62, 0.7), clear);
  col = mix(col, cloudCol, cloud * (1.0 - 0.6 * uHaze));
  col = mix(col, stainCol * (0.6 + 0.8 * uHaze), stain);
  col += vec3(1.0, 0.95, 0.85) * star * starVis * (1.0 - cloud) * (1.0 - stain) * 1.4;

  // The moon, reddening as the Haze closes.
  float md = dot(d, normalize(uMoonDir));
  float disc = smoothstep(0.99955, 0.99975, md);
  float crater = 0.8 + 0.2 * n2(d.xy * 900.0);
  col = mix(col, uMoonColor * crater * 2.2, disc);
  col += uMoonColor * pow(max(md, 0.0), 400.0) * 0.35 + uMoonColor * pow(max(md, 0.0), 30.0) * 0.06;

  // A signal rocket turns the whole sky pale for a moment.
  col = mix(col, vec3(0.55, 0.7, 0.95), uFlare * 0.45 * smoothstep(-0.1, 0.6, h + 0.2));

  // Below the horizon the ground fog takes over.
  col = mix(col, mix(uFog, uHazeFog, smoothstep(-0.3, 1.0, d.z)), smoothstep(0.0, -0.05, h));
  gl_FragColor = vec4(col, 1.0);
}
`;

export class Sky {
  mesh: THREE.Mesh;
  uniforms: Record<string, THREE.IUniform>;

  constructor() {
    this.uniforms = {
      uTime: { value: 0 },
      uZenith: { value: new THREE.Color(0.004, 0.008, 0.02) },
      uHorizon: { value: new THREE.Color(0.03, 0.055, 0.08) },
      uCloud: { value: new THREE.Color(0.12, 0.2, 0.26) },
      uStain: { value: 0.3 },
      uHaze: { value: 0 },
      uNight: { value: 1 },
      uReach: { value: 0 },
      uFlare: { value: 0 },
      uMoonDir: { value: new THREE.Vector3(-0.35, 0.42, 0.55).normalize() },
      uMoonColor: { value: new THREE.Color(0.9, 0.85, 0.8) },
      uFog: { value: new THREE.Color() },
      uHazeFog: { value: new THREE.Color() },
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 24), mat);
    this.mesh.renderOrder = -10;
    this.mesh.frustumCulled = false;
  }

  follow(camera: THREE.Camera): void {
    this.mesh.position.copy(camera.position);
  }
}

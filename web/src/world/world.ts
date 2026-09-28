// The world: renderer, post-processing, and every visual system, driven by a
// small "mood" state (how dark, how close the Haze is) that the director sets.

import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { Sky } from "./sky.ts";
import { Terrain } from "./terrain.ts";
import { Scenery } from "./scenery.ts";
import { Haze } from "./haze.ts";
import { Train } from "./train.ts";
import { CameraRig } from "./camera.ts";
import { Embers, Flashes, LightPool } from "./fx.ts";
import { Birds } from "./birds.ts";
import { CLEARINGS, U } from "./regions.ts";
import { clamp01, damp, lerp, smoothstep } from "./noise.ts";

export interface Mood {
  /** 0 = the dim red daylight of the road, 1 = full night. */
  night: number;
  /** 0 = the Haze is far, 1 = it is upon you. */
  haze: number;
  /** The blue of the Reach on the western horizon. */
  reach: number;
  /** A signal rocket's glare. */
  flare: number;
}

const FinalShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uRed: { value: 0 }, uVignette: { value: 1 } },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; uniform float uRed; uniform float uVignette; varying vec2 vUv;
    float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime * 7.0) * 43758.5453); }
    void main() {
      vec2 c = vUv - 0.5;
      float r = dot(c, c);
      vec3 col = texture2D(tDiffuse, vUv).rgb;
      col *= 1.0 - uVignette * smoothstep(0.1, 0.6, r) * 0.75;
      col = mix(col, col * vec3(1.25, 0.45, 0.4), uRed * smoothstep(0.05, 0.5, r));
      col += (h(vUv * 1000.0) - 0.5) * 0.045;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export class World {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  rig: CameraRig;
  composer: EffectComposer;
  private bloom: UnrealBloomPass | null = null;
  private final: ShaderPass;
  sky = new Sky();
  terrain: Terrain;
  scenery: Scenery;
  haze: Haze;
  train: Train;
  pool: LightPool;
  embers: Embers;
  flashes = new Flashes(3);
  birds = new Birds();
  hemi: THREE.HemisphereLight;
  moon: THREE.DirectionalLight;
  rim: THREE.DirectionalLight;
  /** A soft light from the camera's side, so the caravan reads in side-on travel shots. */
  fill: THREE.DirectionalLight;
  /** Side-on travel cinematography: a fill light, and the verge on the camera side is kept open. */
  sideOn = false;
  private fillAmt = 0;
  fog: THREE.FogExp2;
  key: THREE.PointLight;
  keyStrength = 0;
  mood: Mood = { night: 1, haze: 0, reach: 0, flare: 0 };
  target: Mood = { night: 1, haze: 0, reach: 0, flare: 0 };
  /** Gap to the Haze in miles, shown on screen; the wall eases toward it. */
  gapMiles = 58;
  /** Extra Haze for scenes where the sky itself turns (sky-bleeds, ash-squall). */
  hazeBoost = 0;
  private shownGap = 58;
  time = 0;
  timeScale = 1;
  quality: number;
  private tick: ((dt: number) => void)[] = [];
  private late: ((dt: number) => void)[] = [];
  private clearKey = "";

  constructor(canvas: HTMLCanvasElement, quality: number) {
    this.quality = quality;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: quality > 0.5, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality > 0.5 ? 1.75 : 1));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.rig = new CameraRig(w / h);

    this.fog = new THREE.FogExp2(0x0a0f14, 0.006);
    this.scene.fog = this.fog;
    this.scene.add(this.sky.mesh);
    this.terrain = new Terrain(quality);
    this.terrain.addTo(this.scene);
    this.scenery = new Scenery(quality);
    this.scene.add(this.scenery.group);
    this.haze = new Haze(quality);
    this.scene.add(this.haze.group);

    this.hemi = new THREE.HemisphereLight(0x3a4a5a, 0x120c08, 1);
    this.moon = new THREE.DirectionalLight(0xbfc8d8, 0.8);
    this.rim = new THREE.DirectionalLight(0xff3020, 0.4);
    this.fill = new THREE.DirectionalLight(0xe8c2a0, 0);
    this.scene.add(this.hemi, this.moon, this.moon.target, this.rim, this.rim.target, this.fill, this.fill.target);
    this.key = new THREE.PointLight(0xffc890, 0, 18, 1.3);
    this.scene.add(this.key);

    this.pool = new LightPool(this.scene, quality > 0.5 ? 7 : 4);
    this.embers = new Embers(quality > 0.5 ? 400 : 160);
    this.scene.add(this.embers.points, this.flashes.group, this.birds.group);
    this.train = new Train(this.pool, this.embers);
    this.scene.add(this.train.group);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.rig.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.85, 0.55, 0.82);
    this.bloom.enabled = quality > 0.5;
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.final = new ShaderPass(FinalShader);
    this.composer.addPass(this.final);
    this.resize();
  }

  /** Switch between full effects and a lighter mode for weak GPUs and phones. */
  setQuality(q: number): void {
    this.quality = q;
    if (this.bloom) this.bloom.enabled = q > 0.5;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q > 0.5 ? 1.75 : 1));
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.resize();
  }

  onTick(fn: (dt: number) => void): () => void {
    this.tick.push(fn);
    return () => {
      this.tick = this.tick.filter((f) => f !== fn);
    };
  }

  /** Callbacks that run each frame after the camera has moved, before drawing (screen-pinned captions). */
  onLate(fn: (dt: number) => void): () => void {
    this.late.push(fn);
    return () => {
      this.late = this.late.filter((f) => f !== fn);
    };
  }

  resize(): void {
    const canvas = this.renderer.domElement;
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.rig.camera.aspect = w / h;
    this.rig.setSize(w, h);
    this.rig.camera.updateProjectionMatrix();
  }

  /** Seconds of world time; tweens scale with timeScale so cinematics can be skipped. */
  wait(seconds: number): Promise<void> {
    return new Promise((resolve) => {
      let t = 0;
      const off = this.onTick((dt) => {
        t += dt;
        if (t >= seconds) {
          off();
          resolve();
        }
      });
    });
  }

  tween(seconds: number, fn: (u: number) => void): Promise<void> {
    return new Promise((resolve) => {
      let t = 0;
      fn(0);
      const off = this.onTick((dt) => {
        t += dt;
        const u = Math.min(1, t / seconds);
        fn(u);
        if (u >= 1) {
          off();
          resolve();
        }
      });
    });
  }

  private applyMood(dt: number): void {
    const m = this.mood;
    const tg = this.target;
    m.night = damp(m.night, tg.night, 0.8, dt);
    m.haze = damp(m.haze, tg.haze, 0.7, dt);
    m.reach = damp(m.reach, tg.reach, 0.5, dt);
    m.flare = damp(m.flare, tg.flare, 2.5, dt);
    tg.flare = damp(tg.flare, 0, 1.2, dt);

    const n = m.night;
    const hz = m.haze;
    const zenith = new THREE.Color(lerp(0.03, 0.004, n), lerp(0.035, 0.008, n), lerp(0.055, 0.02, n));
    zenith.lerp(new THREE.Color(0.05, 0.0, 0.004), hz * 0.75);
    const horizon = new THREE.Color(lerp(0.11, 0.03, n), lerp(0.1, 0.055, n), lerp(0.11, 0.08, n));
    horizon.lerp(new THREE.Color(0.24, 0.035, 0.022), smoothstep(0.1, 1, hz) * 0.9);
    const su = this.sky.uniforms;
    (su.uZenith.value as THREE.Color).copy(zenith);
    (su.uHorizon.value as THREE.Color).copy(horizon);
    (su.uCloud.value as THREE.Color).setRGB(lerp(0.16, 0.1, n), lerp(0.18, 0.17, n), lerp(0.2, 0.24, n)).lerp(new THREE.Color(0.12, 0.03, 0.03), hz);
    su.uStain.value = 0.28 + hz * 0.85;
    su.uHaze.value = hz;
    su.uNight.value = n;
    su.uReach.value = m.reach;
    su.uFlare.value = m.flare;
    su.uTime.value = this.time;
    (su.uMoonColor.value as THREE.Color).setRGB(lerp(0.9, 1.0, hz), lerp(0.88, 0.22, hz), lerp(0.8, 0.14, hz));

    const fogCol = horizon.clone().multiplyScalar(0.3);
    this.fog.color.copy(fogCol);
    const hazeFog = new THREE.Color(0.16, 0.012, 0.01).multiplyScalar(0.35 + hz * 1.1);
    (this.terrain.uniforms.uHazeFog.value as THREE.Color).copy(hazeFog);
    (su.uFog.value as THREE.Color).copy(fogCol);
    (su.uHazeFog.value as THREE.Color).copy(hazeFog);
    this.fog.density = 0.0052 + hz * 0.0045 - m.reach * 0.0015;
    this.renderer.setClearColor(fogCol);

    this.hemi.color.setRGB(lerp(0.36, 0.2, n), lerp(0.38, 0.28, n), lerp(0.44, 0.4, n)).lerp(new THREE.Color(0.5, 0.14, 0.1), hz * 0.6);
    this.hemi.groundColor.setRGB(0.07, 0.045, 0.03);
    this.hemi.intensity = lerp(0.42, 0.24, n) + m.flare * 3;
    this.moon.color.copy(su.uMoonColor.value as THREE.Color);
    this.moon.intensity = lerp(0.35, 0.45, n) * (1 - hz * 0.5) + m.flare * 4;
    this.rim.intensity = 0.2 + hz * 1.6;
    this.final.uniforms.uRed.value = smoothstep(0.55, 1, hz) * 0.8;
    this.final.uniforms.uTime.value = this.time;
    this.terrain.uniforms.uBlood.value = smoothstep(0.35, 0.95, hz);
    if (this.bloom) this.bloom.strength = 0.75 + hz * 0.35 + m.flare * 0.8;
  }

  frame(rawDt: number): void {
    const dt = Math.min(0.05, rawDt) * this.timeScale;
    this.time += dt;
    for (const fn of this.tick.slice()) fn(dt);
    this.applyMood(dt);
    this.train.update(dt, this.time);

    // Ease the Haze wall toward the sim's gap. Close gaps are drawn nearer than scale so it reads.
    this.shownGap = damp(this.shownGap, this.gapMiles, 1.2, dt);
    const g = Math.max(0, this.shownGap);
    this.haze.distance = 14 + g * 5 + Math.max(0, g - 25) * 4;
    this.haze.proximity = clamp01(1 - (g - 4) / 50 + this.hazeBoost);
    this.target.haze = this.haze.proximity;

    const cam = this.rig.camera;
    this.rig.update(dt, this.time);
    if (this.late.length) {
      cam.updateMatrixWorld(true);
      for (const fn of this.late.slice()) fn(dt);
    }
    this.sky.follow(cam);
    const trainZ = -this.train.d;
    const rearZ = this.train.rear().z;
    this.terrain.update(trainZ, cam, this.fog.color, this.terrain.uniforms.uBlood.value as number, this.time);
    const clearKey = CLEARINGS.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)},${c.z},${c.w}`).join("|");
    if (clearKey !== this.clearKey) {
      this.clearKey = clearKey;
      this.scenery.invalidate();
    }
    this.scenery.update(trainZ);
    this.haze.update(rearZ, cam, this.time, dt);
    const lookDir = new THREE.Vector3();
    cam.getWorldDirection(lookDir);
    this.moon.position.copy(cam.position).add((this.sky.uniforms.uMoonDir.value as THREE.Vector3).clone().multiplyScalar(100));
    this.moon.target.position.copy(cam.position);
    this.rim.position.copy(this.train.center()).add(new THREE.Vector3(0, 30, 120));
    this.rim.target.position.copy(this.train.center());
    this.pool.update(this.rig.focus, this.time);
    this.fillAmt = damp(this.fillAmt, this.sideOn ? 1 : 0, 1.6, dt);
    this.scenery.setVerge(this.sideOn ? 34 : 0);
    this.fill.intensity = this.fillAmt * lerp(1.15, 0.8, this.mood.night);
    if (this.fillAmt > 0.01) {
      this.fill.position.copy(this.rig.focus).add(cam.position.clone().sub(this.rig.focus).setY(0).normalize().multiplyScalar(40)).add(new THREE.Vector3(0, 18, 0));
      this.fill.target.position.copy(this.rig.focus);
    }
    // Key light: a soft warm lamp between the camera and its subject, at head height.
    const toCam = cam.position.clone().sub(this.rig.focus).setY(0);
    const reach = Math.min(4, toCam.length() * 0.4);
    this.key.position.copy(this.rig.focus).add(toCam.normalize().multiplyScalar(reach)).setY(this.rig.focus.y + 2.2);
    this.key.intensity = damp(this.key.intensity, this.keyStrength * (0.6 + this.mood.night * 0.6) * 9, 2, dt);
    this.embers.update(dt);
    this.flashes.update(dt);
    this.birds.update(this.train.center(), this.time, dt, this.mood.haze);
    this.composer.render(dt);
  }

  /** Jump every eased value to its target (scene cuts, loading a save). */
  snap(): void {
    this.target.haze = this.haze.proximity = clamp01(1 - (this.gapMiles - 4) / 50 + this.hazeBoost);
    Object.assign(this.mood, this.target);
    this.shownGap = this.gapMiles;
    this.train.camp = this.train.campTarget;
  }

  milesToZ(miles: number): number {
    return -miles * U;
  }
}

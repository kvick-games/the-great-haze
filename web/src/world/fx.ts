// Fire and light: flame sprites, embers, a small pool of real point lights
// shared among the torches nearest the action, and one-shot effects.

import * as THREE from "three";
import { keep } from "./dispose.ts";

let flameTex: THREE.Texture | null = null;
let glowTex: THREE.Texture | null = null;
let blobTex: THREE.Texture | null = null;

function radial(stops: [number, string][], size = 64): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) grd.addColorStop(o, col);
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const t = keep(new THREE.CanvasTexture(c));
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function flameTexture(): THREE.Texture {
  if (!flameTex) {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 128;
    const g = c.getContext("2d")!;
    const grd = g.createRadialGradient(32, 92, 2, 32, 80, 60);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.25, "rgba(255,220,160,0.95)");
    grd.addColorStop(0.55, "rgba(255,120,40,0.5)");
    grd.addColorStop(1, "rgba(255,60,10,0)");
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(32, 4);
    g.bezierCurveTo(52, 50, 60, 80, 54, 104);
    g.bezierCurveTo(48, 124, 16, 124, 10, 104);
    g.bezierCurveTo(4, 80, 12, 50, 32, 4);
    g.fill();
    flameTex = keep(new THREE.CanvasTexture(c));
    flameTex.colorSpace = THREE.SRGBColorSpace;
  }
  return flameTex;
}

export function glowTexture(): THREE.Texture {
  if (!glowTex) glowTex = radial([[0, "rgba(255,255,255,1)"], [0.2, "rgba(255,255,255,0.5)"], [1, "rgba(255,255,255,0)"]]);
  return glowTex;
}

export function blobTexture(): THREE.Texture {
  if (!blobTex) blobTex = radial([[0, "rgba(0,0,0,0.75)"], [0.6, "rgba(0,0,0,0.35)"], [1, "rgba(0,0,0,0)"]]);
  return blobTex;
}

/** A soft dark disc that grounds an object without real shadows. */
export function blobShadow(radius: number): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, opacity: 0.9 }),
  );
  m.position.y = 0.04;
  m.renderOrder = 1;
  return m;
}

export class Flame {
  group = new THREE.Group();
  private core: THREE.Sprite;
  private outer: THREE.Sprite;
  private halo: THREE.Sprite;
  lit = true;
  size: number;
  /** Light strength this flame asks the light pool for. */
  power: number;
  private seed = Math.random() * 100;
  intensity = 1;

  constructor(size = 1, power = 1) {
    this.size = size;
    this.power = power;
    const add = (tex: THREE.Texture, color: THREE.Color, opacity: number) =>
      new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.outer = add(flameTexture(), new THREE.Color(2.2, 0.8, 0.25), 0.9);
    this.core = add(flameTexture(), new THREE.Color(3.2, 2.4, 1.3), 1);
    this.halo = add(glowTexture(), new THREE.Color(1.2, 0.45, 0.12), 0.35);
    this.group.add(this.halo, this.outer, this.core);
    this.update(0);
  }

  update(time: number): void {
    const vis = this.lit ? this.intensity : 0;
    this.group.visible = vis > 0.01;
    if (!this.group.visible) return;
    const s = this.size;
    const f = 0.85 + 0.15 * Math.sin(time * 13 + this.seed) + 0.1 * Math.sin(time * 23.7 + this.seed * 2);
    this.outer.scale.set(0.55 * s * (0.9 + 0.1 * Math.sin(time * 9 + this.seed)), 1.1 * s * f, 1);
    this.outer.position.y = 0.4 * s * f;
    this.core.scale.set(0.3 * s, 0.6 * s * f, 1);
    this.core.position.y = 0.25 * s * f;
    this.halo.scale.setScalar(3.2 * s * (0.9 + 0.1 * f));
    this.halo.position.y = 0.35 * s;
    (this.outer.material as THREE.SpriteMaterial).opacity = 0.9 * vis;
    (this.core.material as THREE.SpriteMaterial).opacity = vis;
    (this.halo.material as THREE.SpriteMaterial).opacity = 0.35 * vis;
  }

  flicker(time: number): number {
    return 0.8 + 0.12 * Math.sin(time * 11 + this.seed) + 0.08 * Math.sin(time * 27.3 + this.seed * 3);
  }
}

/** A handful of real point lights, handed to whichever flames matter most right now. */
export class LightPool {
  lights: THREE.PointLight[] = [];
  private flames = new Set<Flame>();
  private tmp = new THREE.Vector3();

  constructor(scene: THREE.Scene, count: number) {
    for (let i = 0; i < count; i++) {
      const l = new THREE.PointLight(0xff8a3c, 0, 18, 1.6);
      l.castShadow = false;
      scene.add(l);
      this.lights.push(l);
    }
  }

  add(f: Flame): void {
    this.flames.add(f);
  }

  remove(f: Flame): void {
    this.flames.delete(f);
  }

  update(focus: THREE.Vector3, time: number): void {
    const ranked: { f: Flame; score: number }[] = [];
    for (const f of this.flames) {
      if (!f.lit || f.intensity < 0.05 || !f.group.parent) continue;
      f.group.getWorldPosition(this.tmp);
      ranked.push({ f, score: this.tmp.distanceToSquared(focus) / (f.power * f.power) });
    }
    ranked.sort((a, b) => a.score - b.score);
    this.lights.forEach((l, i) => {
      const r = ranked[i];
      if (!r) {
        l.intensity = 0;
        return;
      }
      r.f.group.getWorldPosition(l.position);
      l.position.y += 0.6 * r.f.size;
      l.intensity = 9 * r.f.power * r.f.intensity * r.f.flicker(time);
      l.distance = 16 * Math.sqrt(r.f.power);
    });
  }
}

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
}

/** Rising embers from any number of emitters. */
export class Embers {
  points: THREE.Points;
  private parts: Particle[] = [];
  private emitters: { obj: THREE.Object3D; rate: number; acc: number; spread: number }[] = [];
  private cap: number;

  constructor(cap = 300, color = new THREE.Color(2.4, 0.9, 0.3), size = 0.09) {
    this.cap = cap;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(cap * 3), 3));
    g.setAttribute("alpha", new THREE.BufferAttribute(new Float32Array(cap), 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: color }, uSize: { value: size * 300 } },
      vertexShader: `attribute float alpha; varying float vA; uniform float uSize;
        void main() { vA = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = uSize / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 uColor; varying float vA;
        void main() { float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(uColor * vA * (1.0 - d * 2.0), 1.0); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
  }

  emitter(obj: THREE.Object3D, rate: number, spread = 0.2): void {
    this.emitters.push({ obj, rate, acc: 0, spread });
  }

  clearEmitters(): void {
    this.emitters = [];
  }

  removeEmitter(obj: THREE.Object3D): void {
    this.emitters = this.emitters.filter((e) => e.obj !== obj);
  }

  burst(at: THREE.Vector3, n: number, speed = 4, up = 2, life = 1.2): void {
    for (let i = 0; i < n && this.parts.length < this.cap; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      this.parts.push({ x: at.x, y: at.y, z: at.z, vx: Math.cos(a) * s, vy: up * (0.5 + Math.random()), vz: Math.sin(a) * s, life: 0, max: life * (0.6 + Math.random() * 0.6) });
    }
  }

  update(dt: number): void {
    const p = new THREE.Vector3();
    for (const e of this.emitters) {
      if (!e.obj.visible || !e.obj.parent) continue;
      e.acc += e.rate * dt;
      e.obj.getWorldPosition(p);
      while (e.acc >= 1 && this.parts.length < this.cap) {
        e.acc -= 1;
        this.parts.push({
          x: p.x + (Math.random() - 0.5) * e.spread,
          y: p.y,
          z: p.z + (Math.random() - 0.5) * e.spread,
          vx: (Math.random() - 0.5) * 0.4,
          vy: 1 + Math.random() * 1.5,
          vz: (Math.random() - 0.5) * 0.4,
          life: 0,
          max: 1 + Math.random() * 1.6,
        });
      }
      if (e.acc > 1) e.acc = 1;
    }
    const pos = this.points.geometry.attributes.position as THREE.BufferAttribute;
    const alpha = this.points.geometry.attributes.alpha as THREE.BufferAttribute;
    let n = 0;
    for (let i = 0; i < this.parts.length; i++) {
      const q = this.parts[i];
      q.life += dt;
      if (q.life >= q.max) continue;
      q.vx += (Math.random() - 0.5) * dt * 2;
      q.vz += (Math.random() - 0.5) * dt * 2;
      q.vy -= dt * 0.6;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.z += q.vz * dt;
      this.parts[n] = q;
      pos.setXYZ(n, q.x, q.y, q.z);
      alpha.setX(n, 1 - q.life / q.max);
      n++;
    }
    this.parts.length = n;
    this.points.geometry.setDrawRange(0, n);
    pos.needsUpdate = true;
    alpha.needsUpdate = true;
  }
}

/** A brief light and sprite flash: gunfire, bursts, impacts. */
export class Flashes {
  group = new THREE.Group();
  private items: { sprite: THREE.Sprite; light: THREE.PointLight | null; life: number; max: number; size: number }[] = [];
  private lights: THREE.PointLight[] = [];

  constructor(lightCount = 3) {
    for (let i = 0; i < lightCount; i++) {
      const l = new THREE.PointLight(0xffd29a, 0, 20, 1.5);
      this.lights.push(l);
      this.group.add(l);
    }
  }

  flash(at: THREE.Vector3, color: THREE.Color, size = 1, life = 0.12, light = true): void {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    sprite.position.copy(at);
    sprite.scale.setScalar(size);
    this.group.add(sprite);
    let l: THREE.PointLight | null = null;
    if (light) {
      l = this.lights.find((x) => x.intensity === 0) ?? null;
      if (l) {
        l.color.copy(color).multiplyScalar(1 / Math.max(color.r, color.g, color.b, 1));
        l.position.copy(at);
        l.intensity = 40 * size;
      }
    }
    this.items.push({ sprite, light: l, life: 0, max: life, size });
  }

  update(dt: number): void {
    this.items = this.items.filter((it) => {
      it.life += dt;
      const k = 1 - it.life / it.max;
      if (k <= 0) {
        this.group.remove(it.sprite);
        it.sprite.material.dispose();
        if (it.light) it.light.intensity = 0;
        return false;
      }
      it.sprite.material.opacity = k;
      it.sprite.scale.setScalar(it.size * (1 + (1 - k) * 0.6));
      if (it.light) it.light.intensity = 40 * it.size * k;
      return true;
    });
  }
}

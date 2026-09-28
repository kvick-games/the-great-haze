// Combat staging: enemies come out of the dark on one flank, the party forms a
// line, and each round plays the chosen tactic before enemies strike back.

import * as THREE from "three";
import { Figure } from "../world/actors.ts";
import { ENEMY_LOOKS } from "../world/looks.ts";
import type { World } from "../world/world.ts";
import { Flame, glowTexture } from "../world/fx.ts";
import { terrainHeight } from "../world/regions.ts";
import { roadYaw } from "../world/train.ts";
import { ENEMIES } from "../../../src/game/content/enemies.ts";

interface Foe {
  root: THREE.Group;
  fig: Figure | null;
  legs: THREE.Group[];
  alive: boolean;
  home: THREE.Vector3;
  fade: number;
  phase: number;
}

function hound(): { root: THREE.Group; legs: THREE.Group[] } {
  const root = new THREE.Group();
  const hide = new THREE.MeshStandardMaterial({ color: 0x2a0806, roughness: 0.35, metalness: 0.1, flatShading: true });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.9, 2, 6), hide);
  body.rotation.x = Math.PI / 2;
  body.position.y = 0.75;
  root.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.55), hide);
  head.position.set(0, 0.95, 0.75);
  head.rotation.x = 0.35;
  root.add(head);
  const eye = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.3, 0.1) });
  for (const x of [-0.08, 0.08]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 4, 3), eye);
    e.position.set(x, 1.02, 1.0);
    root.add(e);
  }
  const legs: THREE.Group[] = [];
  for (const [x, z] of [
    [-0.16, 0.4],
    [0.16, 0.4],
    [-0.16, -0.4],
    [0.16, -0.4],
  ]) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.6, 4), hide);
    m.position.y = -0.3;
    g.add(m);
    g.position.set(x, 0.6, z);
    root.add(g);
    legs.push(g);
  }
  return { root, legs };
}

export type CombatOutcome = "victory" | "routed" | "escaped" | "paid" | "withdrew";

export class CombatStage {
  group = new THREE.Group();
  foes: Foe[] = [];
  enemyId: string;
  /** World-space: the point the foes advance on, and the direction they come from. */
  anchor: THREE.Vector3;
  dir: THREE.Vector3;
  private world: World;
  private tracers: { line: THREE.Line; life: number }[] = [];
  private projectiles: { sprite: THREE.Sprite; from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number; arc: number; flame?: Flame; done: () => void }[] = [];

  constructor(world: World, enemyId: string, anchor: THREE.Vector3, side: number, turnedFrom?: THREE.Vector3) {
    this.world = world;
    this.enemyId = enemyId;
    this.anchor = anchor.clone();
    const yaw = world.train.camp > 0.5 ? Math.random() * Math.PI * 2 : roadYaw(world.train.d) + (side > 0 ? Math.PI / 2 : -Math.PI / 2);
    this.dir = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const def = ENEMIES[enemyId];
    const n =
      enemyId === "mob" ? 9 : enemyId === "hollowed-pack" ? 6 : enemyId === "haze-hounds" ? 5 : enemyId === "raiders" ? 6 : enemyId === "toll-thugs" ? 5 : 1;
    const right = new THREE.Vector3(this.dir.z, 0, -this.dir.x);
    for (let i = 0; i < n; i++) {
      const spread = (i - (n - 1) / 2) * 2.2;
      const home = this.anchor.clone().add(this.dir.clone().multiplyScalar(13 + (i % 2) * 1.5)).add(right.clone().multiplyScalar(spread));
      let root: THREE.Group;
      let fig: Figure | null = null;
      let legs: THREE.Group[] = [];
      if (enemyId === "haze-hounds") {
        const h = hound();
        root = h.root;
        legs = h.legs;
      } else {
        const look =
          enemyId === "raiders" ? ENEMY_LOOKS.raider : enemyId === "toll-thugs" ? ENEMY_LOOKS.thug : enemyId === "mob" ? ENEMY_LOOKS.starving : enemyId === "long-man" ? ENEMY_LOOKS.longman : ENEMY_LOOKS.hollowed;
        fig = new Figure(look);
        if (def.tags.includes("hollowed")) fig.eyeGlow = 1;
        if ((enemyId === "raiders" || enemyId === "toll-thugs") && i % 2 === 0) fig.holdRifle(true);
        root = fig.root;
      }
      const start = turnedFrom && n === 1 ? turnedFrom.clone() : home.clone().add(this.dir.clone().multiplyScalar(30 + Math.random() * 10));
      root.position.copy(start);
      this.group.add(root);
      this.foes.push({ root, fig, legs, alive: true, home, fade: 1, phase: Math.random() * 6 });
    }
    world.scene.add(this.group);
  }

  get aliveCount(): number {
    return this.foes.filter((f) => f.alive).length;
  }

  /** Where the party stands to face the foes. */
  partyLine(count: number): { x: number; z: number; face: THREE.Vector3 }[] {
    const right = new THREE.Vector3(this.dir.z, 0, -this.dir.x);
    const out: { x: number; z: number; face: THREE.Vector3 }[] = [];
    const face = this.anchor.clone().add(this.dir.clone().multiplyScalar(20));
    for (let i = 0; i < count; i++) {
      const p = this.anchor.clone().add(this.dir.clone().multiplyScalar(3.5)).add(right.clone().multiplyScalar((i - (count - 1) / 2) * 1.8));
      out.push({ x: p.x, z: p.z, face });
    }
    return out;
  }

  /** Match the number of standing foes to the enemy's remaining strength. */
  setStrength(frac: number): THREE.Vector3[] {
    const want = frac <= 0 ? 0 : Math.max(1, Math.ceil(this.foes.length * frac));
    const fallen: THREE.Vector3[] = [];
    let alive = this.aliveCount;
    for (const f of this.foes) {
      if (alive <= want) break;
      if (!f.alive) continue;
      f.alive = false;
      alive--;
      if (f.fig) f.fig.pose = "lie";
      fallen.push(f.root.position.clone());
    }
    return fallen;
  }

  retreat(): void {
    for (const f of this.foes) {
      if (!f.alive) continue;
      f.home = f.root.position.clone().add(this.dir.clone().multiplyScalar(45));
      f.fade = 0.999;
    }
  }

  nearestFoe(to: THREE.Vector3): Foe | null {
    let best: Foe | null = null;
    let bd = Infinity;
    for (const f of this.foes) {
      if (!f.alive) continue;
      const d = f.root.position.distanceToSquared(to);
      if (d < bd) {
        bd = d;
        best = f;
      }
    }
    return best;
  }

  randomFoe(): Foe | null {
    const alive = this.foes.filter((f) => f.alive);
    return alive.length ? alive[Math.floor(Math.random() * alive.length)] : null;
  }

  /** A foe rushes a target and falls back. */
  async lunge(foe: Foe, target: THREE.Vector3): Promise<void> {
    const home = foe.home.clone();
    const strike = target.clone().add(foe.root.position.clone().sub(target).setY(0).normalize().multiplyScalar(0.9));
    foe.home = strike;
    await this.world.wait(0.45);
    foe.home = home;
  }

  tracer(from: THREE.Vector3, to: THREE.Vector3): void {
    const g = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: new THREE.Color(3, 2.2, 1.2), transparent: true, blending: THREE.AdditiveBlending }));
    this.group.add(line);
    this.tracers.push({ line, life: 0.08 });
  }

  throwFire(from: THREE.Vector3, to: THREE.Vector3, dur = 0.7, arc = 3, flame = true): Promise<void> {
    return new Promise((resolve) => {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: flame ? new THREE.Color(3, 1.2, 0.3) : new THREE.Color(2.5, 3, 4), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
      sprite.scale.setScalar(flame ? 0.9 : 0.6);
      this.group.add(sprite);
      let f: Flame | undefined;
      if (flame) {
        f = new Flame(0.45, 1);
        this.group.add(f.group);
      }
      this.projectiles.push({ sprite, from: from.clone(), to: to.clone(), t: 0, dur, arc, flame: f, done: resolve });
    });
  }

  update(dt: number, time: number): void {
    for (const f of this.foes) {
      f.phase += dt;
      const p = f.root.position;
      const d = f.home.clone().sub(p).setY(0);
      const dist = d.length();
      const fast = this.enemyId === "haze-hounds" ? 9 : this.enemyId === "long-man" ? 3 : 4.5;
      if (dist > 0.1 && (f.alive || f.fade < 1)) {
        const step = Math.min(dist, fast * dt);
        p.addScaledVector(d.normalize(), step);
        if (f.fig) {
          f.fig.speed = fast;
          if (f.alive) f.fig.pose = "walk";
          f.fig.targetYaw = Math.atan2(d.x, d.z);
        } else f.root.rotation.y = Math.atan2(d.x, d.z);
        f.legs.forEach((l, i) => (l.rotation.x = Math.sin(f.phase * 14 + i * Math.PI * 0.5) * 0.7));
      } else {
        if (f.fig) {
          f.fig.speed = 0;
          if (f.alive) {
            f.fig.pose = this.enemyId === "mob" ? "reach" : this.enemyId === "hollowed-pack" || this.enemyId === "hollowed-single" ? "hunch" : "stand";
            f.fig.targetYaw = Math.atan2(this.anchor.x - p.x, this.anchor.z - p.z);
          }
        } else if (f.alive) f.root.rotation.y = Math.atan2(this.anchor.x - p.x, this.anchor.z - p.z);
        for (const l of f.legs) l.rotation.x *= 0.8;
      }
      if (!f.alive && !f.fig) f.root.rotation.z = Math.min(Math.PI / 2, f.root.rotation.z + dt * 4);
      if (f.fade < 1) {
        f.fade = Math.max(0, f.fade - dt * 0.35);
        if (f.fig) f.fig.setFade(f.fade);
        else f.root.visible = f.fade > 0.05;
      }
      p.y = terrainHeight(p.x, p.z);
      f.fig?.update(dt, time);
    }
    this.tracers = this.tracers.filter((t) => {
      t.life -= dt;
      if (t.life <= 0) {
        this.group.remove(t.line);
        t.line.geometry.dispose();
        return false;
      }
      return true;
    });
    this.projectiles = this.projectiles.filter((pr) => {
      pr.t += dt;
      const u = Math.min(1, pr.t / pr.dur);
      const pos = pr.from.clone().lerp(pr.to, u);
      pos.y += Math.sin(u * Math.PI) * pr.arc;
      pr.sprite.position.copy(pos);
      if (pr.flame) {
        pr.flame.group.position.copy(pos);
        pr.flame.update(time);
      }
      if (u >= 1) {
        this.group.remove(pr.sprite);
        if (pr.flame) this.group.remove(pr.flame.group);
        pr.done();
        return false;
      }
      return true;
    });
  }

  dispose(): void {
    this.group.removeFromParent();
  }
}

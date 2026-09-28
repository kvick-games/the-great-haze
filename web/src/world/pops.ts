// Small diegetic events for the day's losses: a crate slides off a tail gate,
// a sack splits and stays behind on the road. They use the wagons' shared
// geometry, so removing them frees nothing that others still need.

import * as THREE from "three";
import { gbox, gball, mat, mesh } from "./gear.ts";
import { disposeTree } from "./dispose.ts";
import { terrainHeight } from "./regions.ts";

type Kind = "crate" | "sack" | "barrel";

interface Item {
  o: THREE.Object3D;
  v: THREE.Vector3;
  spin: THREE.Vector3;
  age: number;
  rest: boolean;
  rad: number;
}

const LIFE = 22;

export class Pops {
  group = new THREE.Group();
  private items: Item[] = [];

  /** Drop a piece of cargo at `from`, sliding toward `away` (world direction, unit). */
  drop(kind: Kind, from: THREE.Vector3, away: THREE.Vector3): void {
    let o: THREE.Object3D;
    let rad = 0.3;
    if (kind === "crate") {
      o = mesh(gbox(0.62, 0.48, 0.62), mat(0x5a4426, 0.9));
      rad = 0.28;
    } else if (kind === "sack") {
      o = mesh(gball(0.34, 6, 5), mat(0x8a7448, 0.98));
      o.scale.set(0.95, 0.6, 1.3);
      rad = 0.2;
    } else {
      o = mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.56, 8), mat(0x4a3018));
      (o as THREE.Mesh).geometry.userData.own = true;
      rad = 0.27;
    }
    o.position.copy(from);
    this.group.add(o);
    this.items.push({ o, v: away.clone().multiplyScalar(1.2 + Math.random() * 0.8).setY(1.4), spin: new THREE.Vector3(Math.random() * 3, Math.random() * 3, Math.random() * 3), age: 0, rest: false, rad });
    while (this.items.length > 10) this.remove(0);
  }

  private remove(i: number): void {
    const it = this.items[i];
    it.o.removeFromParent();
    // Barrels build their own geometry; everything else is shared and kept.
    disposeTree(it.o);
    this.items.splice(i, 1);
  }

  update(dt: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.age += dt;
      if (!it.rest) {
        it.v.y -= 9 * dt;
        it.o.position.addScaledVector(it.v, dt);
        it.o.rotation.x += it.spin.x * dt;
        it.o.rotation.y += it.spin.y * dt;
        it.o.rotation.z += it.spin.z * dt;
        const ground = terrainHeight(it.o.position.x, it.o.position.z) + it.rad;
        if (it.o.position.y <= ground) {
          it.o.position.y = ground;
          if (Math.abs(it.v.y) > 1.2) {
            it.v.y *= -0.3;
            it.v.x *= 0.6;
            it.v.z *= 0.6;
            it.spin.multiplyScalar(0.5);
          } else it.rest = true;
        }
      }
      if (it.age > LIFE) this.remove(i);
    }
  }

  clear(): void {
    while (this.items.length) this.remove(0);
  }
}

// Crows wheeling over the train: black shapes against the sky, restless as the
// Haze closes in.

import * as THREE from "three";

interface Bird {
  mesh: THREE.Mesh;
  radius: number;
  height: number;
  speed: number;
  phase: number;
  flap: number;
}

export class Birds {
  group = new THREE.Group();
  private birds: Bird[] = [];
  private wingPos: THREE.BufferAttribute[] = [];

  constructor(count = 9) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x050404, side: THREE.DoubleSide, fog: true });
    for (let i = 0; i < count; i++) {
      // Two wing triangles and a body sliver; wings flap by moving their tips.
      const g = new THREE.BufferGeometry();
      const pos = new Float32Array([
        0, 0, 0.35, -0.9, 0, 0, 0, 0, -0.2,
        0, 0, 0.35, 0.9, 0, 0, 0, 0, -0.2,
        0, 0.02, 0.45, 0.06, 0, -0.35, -0.06, 0, -0.35,
      ]);
      const attr = new THREE.BufferAttribute(pos, 3);
      g.setAttribute("position", attr);
      const mesh = new THREE.Mesh(g, mat);
      mesh.scale.setScalar(1.3 + Math.random() * 0.6);
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.wingPos.push(attr);
      this.birds.push({ mesh, radius: 18 + Math.random() * 22, height: 18 + Math.random() * 14, speed: 0.18 + Math.random() * 0.12, phase: Math.random() * Math.PI * 2, flap: Math.random() * 6 });
    }
  }

  update(center: THREE.Vector3, time: number, dt: number, unrest: number): void {
    this.birds.forEach((b, i) => {
      const sp = b.speed * (1 + unrest * 1.2);
      b.phase += dt * sp;
      b.flap += dt * (5 + unrest * 6);
      const r = b.radius * (1 - unrest * 0.35);
      const x = center.x + Math.cos(b.phase) * r;
      const z = center.z + Math.sin(b.phase) * r;
      const y = b.height + Math.sin(time * 0.4 + i) * 2;
      b.mesh.position.set(x, y, z);
      // Face along the circle.
      b.mesh.rotation.set(Math.sin(time + i) * 0.1, -b.phase, 0.35);
      const tip = Math.sin(b.flap) * 0.45 * (Math.sin(time * 0.7 + i) > -0.3 ? 1 : 0.1);
      const p = this.wingPos[i];
      p.setY(1, tip);
      p.setY(4, tip);
      p.needsUpdate = true;
    });
  }
}

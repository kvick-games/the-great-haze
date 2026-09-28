// Cinematic camera: a named shot supplies a desired position and look target
// every frame; the rig eases toward it. The player can drag to look around a
// little, and the offset drifts home when they let go.

import * as THREE from "three";
import { damp } from "./noise.ts";

export type ShotFn = (time: number) => { pos: THREE.Vector3; target: THREE.Vector3; fov?: number };

export class CameraRig {
  camera: THREE.PerspectiveCamera;
  private pos = new THREE.Vector3(0, 6, 20);
  private target = new THREE.Vector3(0, 1, 0);
  private shot: ShotFn = () => ({ pos: new THREE.Vector3(0, 6, 20), target: new THREE.Vector3() });
  private rate = 1.6;
  private fov = 50;
  userYaw = 0;
  userPitch = 0;
  userZoom = 1;
  private idle = 0;
  private shake = 0;
  private cut = false;
  /** Where on screen the subject should sit, as a fraction of width/height from centre. */
  private frame = new THREE.Vector2();
  private frameTarget = new THREE.Vector2();
  private size = new THREE.Vector2(1, 1);

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 3500);
  }

  /** Switch shots. rate controls how quickly the camera travels there; cut jumps. */
  set(shot: ShotFn, rate = 1.6, cut = false): void {
    this.shot = shot;
    this.rate = rate;
    this.cut = cut;
  }

  /** Shift the picture so the look target lands at (fx, fy) of the screen, measured from centre. */
  setFrame(fx: number, fy: number, snap = false): void {
    this.frameTarget.set(fx, fy);
    if (snap) this.frame.set(fx, fy);
  }

  setSize(w: number, h: number): void {
    this.size.set(w, h);
  }

  kick(amount: number): void {
    this.shake = Math.min(1.5, this.shake + amount);
  }

  drag(dx: number, dy: number): void {
    this.userYaw = Math.max(-1.2, Math.min(1.2, this.userYaw - dx * 0.005));
    this.userPitch = Math.max(-0.25, Math.min(0.5, this.userPitch + dy * 0.003));
    this.idle = 0;
  }

  zoom(delta: number): void {
    this.userZoom = Math.max(0.55, Math.min(1.8, this.userZoom * (1 + delta * 0.001)));
    this.idle = 0;
  }

  get focus(): THREE.Vector3 {
    return this.target;
  }

  update(dt: number, time: number): void {
    const s = this.shot(time);
    if (this.cut) {
      this.pos.copy(s.pos);
      this.target.copy(s.target);
      this.cut = false;
    } else {
      const k = 1 - Math.exp(-this.rate * dt);
      this.pos.lerp(s.pos, k);
      this.target.lerp(s.target, k * 1.3 > 1 ? 1 : k * 1.3);
    }
    this.fov = damp(this.fov, s.fov ?? 50, 2, dt);
    this.idle += dt;
    if (this.idle > 5) {
      this.userYaw = damp(this.userYaw, 0, 0.6, dt);
      this.userPitch = damp(this.userPitch, 0, 0.6, dt);
      this.userZoom = damp(this.userZoom, 1, 0.6, dt);
    }
    // Apply the player's orbit offset around the look target.
    const off = this.pos.clone().sub(this.target);
    off.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.userYaw);
    const flat = Math.hypot(off.x, off.z);
    const pitch = Math.atan2(off.y, flat) + this.userPitch;
    const len = off.length() * this.userZoom;
    const dir = new THREE.Vector3(off.x, 0, off.z).normalize();
    const cp = this.target.clone().add(dir.multiplyScalar(Math.cos(pitch) * len)).add(new THREE.Vector3(0, Math.sin(pitch) * len, 0));
    this.shake = Math.max(0, this.shake - dt * 2.2);
    const sh = this.shake * this.shake * 0.35;
    cp.x += (Math.random() - 0.5) * sh;
    cp.y += (Math.random() - 0.5) * sh;
    this.camera.position.copy(cp);
    this.camera.lookAt(this.target);
    this.frame.x = damp(this.frame.x, this.frameTarget.x, 3, dt);
    this.frame.y = damp(this.frame.y, this.frameTarget.y, 3, dt);
    const w = this.size.x;
    const h = this.size.y;
    if (Math.abs(this.frame.x) > 0.001 || Math.abs(this.frame.y) > 0.001) {
      this.camera.setViewOffset(w, h, -this.frame.x * w, -this.frame.y * h, w, h);
    } else if (this.camera.view) this.camera.clearViewOffset();
    if (Math.abs(this.camera.fov - this.fov) > 0.01) this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();
  }
}

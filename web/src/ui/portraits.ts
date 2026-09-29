// Portraits for the crew: each person's own 3D figure, framed head and shoulders under
// one warm lamp with a cold rim, rendered once offscreen and kept as a data URL.
// Nothing is stored as a file. A portrait is redrawn only when what the figure would
// show changes (wounds, sickness, the Haze, a broken nerve, death).

import * as THREE from "three";
import type { Role, Trait } from "../../../src/game/types.ts";
import type { Look as SimLook } from "../../../src/game/talk-types.ts";
import { Figure } from "../world/actors.ts";
import { lookFor, lookForSim } from "../world/looks.ts";
import { disposeTree } from "../world/dispose.ts";

export interface PortraitSpec {
  id: string;
  role: Role;
  isLeader: boolean;
  traits: Trait[];
  look?: SimLook;
  health: number;
  nerve: number;
  conditions: string[];
  alive: boolean;
}

const W = 240;
const H = 300;

function signature(p: PortraitSpec): string {
  const hp = p.health > 60 ? 2 : p.health > 30 ? 1 : 0;
  const nv = p.nerve > 55 ? 2 : p.nerve > 25 ? 1 : 0;
  return `${p.id}|${p.alive ? "a" : "x"}|${hp}${nv}|${p.conditions.filter((c) => c !== "frayed" && c !== "breaking").join(",")}|${p.look ? "n" : "r"}`;
}

export class PortraitStudio {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(24, W / H, 0.1, 20);
  private cache = new Map<string, string>();
  private failed = false;

  constructor() {
    this.scene.add(new THREE.HemisphereLight(0x39465a, 0x120c08, 0.9));
    const key = new THREE.DirectionalLight(0xffa860, 5.2);
    key.position.set(-1.6, 1.9, 2.4);
    const rim = new THREE.DirectionalLight(0x7fb4dc, 2.4);
    rim.position.set(2.2, 1.6, -1.8);
    const fill = new THREE.DirectionalLight(0x8a5a40, 0.6);
    fill.position.set(2, 0.6, 2);
    this.scene.add(key, rim, fill);
  }

  private ensure(): THREE.WebGLRenderer | null {
    if (this.renderer || this.failed) return this.renderer;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
      r.setPixelRatio(1);
      r.setSize(W, H, false);
      r.setClearColor(0x000000, 0);
      r.toneMapping = THREE.ACESFilmicToneMapping;
      r.toneMappingExposure = 1.05;
      r.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer = r;
    } catch {
      this.failed = true;
    }
    return this.renderer;
  }

  /** The portrait for this person as it is now, or null where WebGL is not available. */
  get(p: PortraitSpec): string | null {
    const sig = signature(p);
    const hit = this.cache.get(sig);
    if (hit) return hit;
    const url = this.draw(p);
    if (url) this.cache.set(sig, url);
    return url;
  }

  private draw(p: PortraitSpec): string | null {
    const r = this.ensure();
    if (!r) return null;
    const look = p.look && !p.isLeader ? lookForSim(p.look, p.id, p.role) : lookFor(p.id, p.role, p.isLeader, p.traits);
    const fig = new Figure(look);
    try {
      const fog = p.conditions.find((c) => c.startsWith("fogsick") || c === "turning");
      const fogN = !fog ? 0 : fog === "fogsick I" ? 1 : fog === "fogsick II" ? 2 : 3;
      const dying = p.conditions.includes("dying");
      fig.setCondition({
        health: p.alive ? p.health : 5,
        nerve: p.alive ? p.nerve : 20,
        wounded: p.conditions.includes("wounded"),
        sick: p.conditions.includes("sick"),
        fog: fogN,
        dying: dying || !p.alive,
      });
      fig.straighten();
      fig.eyeGlow = fogN === 0 ? 0 : fogN === 1 ? 0.15 : fogN === 2 ? 0.6 : 1;
      const mood = !p.alive ? "grieving" : dying ? "pleading" : p.nerve < 30 ? "afraid" : "calm";
      fig.setExpression(mood, "none", false);
      fig.setFade(1);
      this.scene.add(fig.root);
      // Let posture and expression settle from their standing defaults.
      for (let i = 0; i < 40; i++) fig.update(1 / 30, i / 30);
      fig.root.updateMatrixWorld(true);
      const s = fig.heightScale;
      // Head and shoulders: the eyes sit near 1.6 m on a normal frame.
      const cy = (dying || !p.alive ? 1.6 : 1.64) * s;
      const dist = 1.6 * Math.max(1, s * 0.96);
      this.camera.position.set(0.1 * s, cy + 0.04 * s, dist);
      this.camera.lookAt(0, cy - 0.04 * s, 0);
      r.render(this.scene, this.camera);
      return r.domElement.toDataURL("image/png");
    } catch {
      return null;
    } finally {
      this.scene.remove(fig.root);
      disposeTree(fig.root);
    }
  }

  /** Forget cached portraits (a new run). */
  clear(): void {
    this.cache.clear();
  }
}

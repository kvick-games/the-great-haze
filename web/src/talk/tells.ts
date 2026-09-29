// Staged tells: what the party has noticed shows as a subtle cue in the world.
// Only tells the sim marks visible are ever passed in, so nothing hidden can
// leak here. The cue is picked from the tell's own words: a glint where a
// weapon is hidden, a soft ring at clean boots, extra footprints in the dust,
// and otherwise a small marker on the part of the body the words point at.

import * as THREE from "three";
import type { TellView } from "../../../src/game/types.ts";
import type { Figure } from "../world/actors.ts";
import { glowTexture } from "../world/fx.ts";
import { disposeTree, keep } from "../world/dispose.ts";
import { roadX, terrainHeight } from "../world/regions.ts";

export type CueKind = "glint" | "boots" | "tracks" | "hands" | "face" | "body" | "marker";

/** Pick the kind of cue from a tell's words. */
export function cueKind(text: string): CueKind {
  const t = text.toLowerCase();
  if (/rifle|gun|weapon|knife|blade|pistol|armed|holster|steel|barrel|musket/.test(t)) return "glint";
  if (/boot|shoe|spotless|clean clothes|unmarked|freshly (washed|pressed)|too clean/.test(t)) return "boots";
  if (/track|print|rut|trail|hoof|wheel|footstep|dust|scuff/.test(t)) return "tracks";
  if (/hand|finger|knuckle|grip|shak/.test(t)) return "hands";
  if (/eye|glance|glancing|gaze|stare|look|face|lip|smile|mouth|voice|breath/.test(t)) return "face";
  if (/wound|blood|bandage|leg|arm|coat|limp|scar|burn|bruise/.test(t)) return "body";
  return "marker";
}

let starTex: THREE.Texture | null = null;
/** A four-point glint: a soft core with thin rays. */
function star(): THREE.Texture {
  if (starTex) return starTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const rad = g.createRadialGradient(32, 32, 0, 32, 32, 30);
  rad.addColorStop(0, "rgba(255,246,220,1)");
  rad.addColorStop(0.2, "rgba(255,214,150,0.6)");
  rad.addColorStop(1, "rgba(255,180,90,0)");
  g.fillStyle = rad;
  g.fillRect(0, 0, 64, 64);
  g.globalCompositeOperation = "lighter";
  for (const [w, h] of [[60, 3], [3, 60]]) {
    const lg = g.createLinearGradient(32 - w / 2, 32 - h / 2, 32 + w / 2, 32 + h / 2);
    lg.addColorStop(0, "rgba(255,230,190,0)");
    lg.addColorStop(0.5, "rgba(255,240,215,0.95)");
    lg.addColorStop(1, "rgba(255,230,190,0)");
    g.fillStyle = lg;
    g.fillRect(32 - w / 2, 32 - h / 2, w, h);
  }
  starTex = keep(new THREE.CanvasTexture(c));
  starTex.colorSpace = THREE.SRGBColorSpace;
  return starTex;
}

let ringTex: THREE.Texture | null = null;
function ring(): THREE.Texture {
  if (ringTex) return ringTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const rad = g.createRadialGradient(32, 32, 14, 32, 32, 30);
  rad.addColorStop(0, "rgba(255,190,110,0)");
  rad.addColorStop(0.55, "rgba(255,190,110,0.9)");
  rad.addColorStop(0.7, "rgba(255,190,110,0.35)");
  rad.addColorStop(1, "rgba(255,190,110,0)");
  g.fillStyle = rad;
  g.fillRect(0, 0, 64, 64);
  ringTex = keep(new THREE.CanvasTexture(c));
  ringTex.colorSpace = THREE.SRGBColorSpace;
  return ringTex;
}

interface Cue {
  obj: THREE.Object3D;
  update(t: number): void;
}

const SIZE = { 1: 0.32, 2: 0.44, 3: 0.6 } as const;

export class TellCues {
  private group = new THREE.Group();
  private cues: Cue[] = [];
  private on = false;
  private fig: Figure | null = null;

  private scene: THREE.Scene;
  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  get active(): boolean {
    return this.on;
  }

  get target(): Figure | null {
    return this.fig;
  }

  /** Show cues for the visible tells around one figure. */
  set(tells: TellView[], fig: Figure | null): void {
    this.clear();
    const visible = tells.filter((t) => t.visible).slice(0, 4);
    if (!fig || !visible.length) return;
    this.fig = fig;
    this.on = true;
    this.scene.add(this.group);
    const seen = new Set<CueKind>();
    visible.forEach((t, i) => {
      const kind = cueKind(t.text);
      // One cue of each kind is enough; extra markers share the head.
      const k = seen.has(kind) ? "marker" : kind;
      seen.add(kind);
      this.add(k, t.severity, i, fig);
    });
  }

  private sprite(tex: THREE.Texture, size: number, opacity: number, depth = false): THREE.Sprite {
    const m = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity, depthWrite: false, depthTest: depth, blending: THREE.AdditiveBlending, color: 0xffc078 });
    const s = new THREE.Sprite(m);
    s.scale.setScalar(size);
    s.renderOrder = 20;
    return s;
  }

  private add(kind: CueKind, severity: 1 | 2 | 3, i: number, fig: Figure): void {
    const hs = fig.heightScale;
    const size = SIZE[severity];
    const phase = i * 1.7;
    const follow = (o: THREE.Object3D, x: number, y: number, z: number) => {
      // Cues ride on the figure (in its own frame) so they follow a breath or a step.
      const v = new THREE.Vector3(x, y * hs, z * hs);
      fig.root.localToWorld(v);
      o.position.copy(v);
    };
    switch (kind) {
      case "glint": {
        const s = this.sprite(star(), size * 1.5, 0.9, true);
        this.group.add(s);
        this.cues.push({
          obj: s,
          update: (t) => {
            follow(s, 0.22, 0.95, -0.25);
            // Catches the light now and then rather than burning steadily.
            const p = Math.max(0, Math.sin(t * 2.1 + phase));
            s.material.opacity = 0.25 + 0.7 * p * p;
            s.scale.setScalar(size * (1.0 + 0.7 * p));
            s.material.rotation = t * 0.25;
          },
        });
        break;
      }
      case "boots": {
        const g = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: ring(), transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffc078 }));
        g.renderOrder = 4;
        this.group.add(g);
        this.cues.push({
          obj: g,
          update: (t) => {
            const p = fig.root.getWorldPosition(new THREE.Vector3());
            g.position.set(p.x, terrainHeight(p.x, p.z) + 0.07, p.z);
            const k = 1.5 + 0.18 * Math.sin(t * 2 + phase);
            g.scale.set(k, 1, k);
            (g.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.3 * severity * 0.33 + 0.12 * Math.sin(t * 2 + phase);
          },
        });
        break;
      }
      case "tracks": {
        // A second set of prints beside the first: a line of dark marks that pulse faintly.
        const prints = new THREE.Group();
        const geo = new THREE.PlaneGeometry(0.16, 0.34).rotateX(-Math.PI / 2);
        const mat = new THREE.MeshBasicMaterial({ color: 0x140e0a, transparent: true, opacity: 0.85, depthWrite: false });
        const glow = new THREE.MeshBasicMaterial({ color: 0xffb066, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending });
        const p0 = fig.root.getWorldPosition(new THREE.Vector3());
        // The prints come out of the verge and stop at the figure.
        const dir = new THREE.Vector3(Math.sign(p0.x - roadX(p0.z)) || 1, 0, 0.35).normalize();
        for (let n = 0; n < 9; n++) {
          const d = 1.2 + n * 0.85;
          const side = n % 2 ? 0.17 : -0.17;
          const x = p0.x + dir.x * d - dir.z * side;
          const z = p0.z + dir.z * d + dir.x * side;
          for (const m of [mat, glow]) {
            const pr = new THREE.Mesh(geo, m);
            pr.position.set(x, terrainHeight(x, z) + 0.06, z);
            pr.rotation.y = Math.atan2(-dir.x, -dir.z) + (n % 2 ? 0.12 : -0.12);
            pr.renderOrder = 3;
            prints.add(pr);
          }
        }
        this.group.add(prints);
        this.cues.push({
          obj: prints,
          update: (t) => {
            glow.opacity = 0.16 + 0.12 * Math.sin(t * 1.6 + phase);
          },
        });
        break;
      }
      default: {
        // A marker on the part of the body the words point at.
        const at: Record<string, [number, number, number]> = { hands: [0.32, 0.95, 0.25], face: [0, 1.85, 0.16], body: [0.1, 1.25, 0.3], marker: [0, 2.2, 0] };
        const [x, y, z] = at[kind] ?? at.marker;
        const s = this.sprite(glowTexture(), size, 0.7);
        this.group.add(s);
        this.cues.push({
          obj: s,
          update: (t) => {
            follow(s, x + (kind === "marker" ? Math.sin(phase) * 0.1 : 0), y, z);
            s.material.opacity = 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(t * 2.4 + phase));
          },
        });
      }
    }
    this.cues[this.cues.length - 1].update(0);
  }

  update(time: number): void {
    if (!this.on) return;
    for (const c of this.cues) c.update(time);
  }

  clear(): void {
    if (!this.on && !this.cues.length) return;
    this.group.removeFromParent();
    for (const c of this.cues) {
      c.obj.removeFromParent();
      disposeTree(c.obj);
    }
    this.cues = [];
    this.on = false;
    this.fig = null;
  }
}

// The fork in the road, in 3D. Local frame as for every stage: origin on the
// road ahead, +z back toward the wagons, -z the way on. Each route leaves the
// junction as a ribbon of dirt on its own bearing; a signpost carries one
// board per route, turned toward the road it names. A road picked from the
// card (or hovered) lights up.

import * as THREE from "three";
import type { ForkView } from "../../../src/game/map-types.ts";
import { terrainHeight } from "../world/regions.ts";
import { cyl, merge, part, vcMaterial } from "../world/geo.ts";
import * as P from "./pieces.ts";
import { Stage } from "./vignettes.ts";

const LEN = 58;
const DARKWOOD: [number, number, number] = [0.13, 0.09, 0.06];

interface Branch {
  id: string;
  /** Bearing in radians from straight on; positive bends to local +x. */
  angle: number;
  dir: THREE.Vector2;
  ribbon: THREE.Mesh;
  board: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  boardMat: THREE.MeshStandardMaterial;
  ribbonBase: THREE.Group;
}

/** The capital-letter words on a sign ("MERIDIAN CO. ROAD"), if it has any. */
export function signPhrase(sign: string | undefined): string {
  if (!sign) return "";
  const m = sign.match(/[A-Z][A-Z.' ]{5,}[A-Z.]/);
  return m ? m[0].trim() : "";
}

function boardTexture(name: string, phrase: string, left: boolean): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 176;
  const g = c.getContext("2d")!;
  // A left-pointing board is drawn as the right-pointing one, mirrored, then its writing goes on the right way round.
  // Plank with a pointed end.
  const tip = 52;
  g.beginPath();
  g.moveTo(6, 10);
  g.lineTo(c.width - tip, 10);
  g.lineTo(c.width - 6, c.height / 2);
  g.lineTo(c.width - tip, c.height - 10);
  g.lineTo(6, c.height - 10);
  g.closePath();
  g.fillStyle = "#2d2118";
  g.fill();
  g.lineWidth = 6;
  g.strokeStyle = "#0f0a06";
  g.stroke();
  // Grain.
  g.strokeStyle = "rgba(0,0,0,0.25)";
  g.lineWidth = 2;
  for (let y = 40; y < c.height - 20; y += 34) {
    g.beginPath();
    g.moveTo(14, y);
    g.lineTo(c.width - tip - 8, y + 3);
    g.stroke();
  }
  if (left) {
    // Mirror the plank only; text is drawn afterwards unmirrored, in the plank's new middle.
    const flip = document.createElement("canvas");
    flip.width = c.width;
    flip.height = c.height;
    const fg = flip.getContext("2d")!;
    fg.translate(c.width, 0);
    fg.scale(-1, 1);
    fg.drawImage(c, 0, 0);
    g.clearRect(0, 0, c.width, c.height);
    g.drawImage(flip, 0, 0);
  }
  const cx = left ? (c.width + tip) / 2 - 6 : (c.width - tip) / 2 + 6;
  g.fillStyle = "#d4c2a0";
  g.textAlign = "center";
  g.textBaseline = "middle";
  const avail = c.width - tip - 40;
  let size = phrase ? 56 : 68;
  const font = (s: number, w = "") => `${w} ${s}px "IM Fell English SC", Georgia, serif`;
  g.font = font(size);
  while (g.measureText(name).width > avail && size > 18) {
    size *= 0.92;
    g.font = font(size);
  }
  g.fillText(name, cx, phrase ? 62 : c.height / 2 + 2);
  if (phrase) {
    g.fillStyle = "#a89670";
    let ps = 34;
    g.font = `${ps}px "Special Elite", "Courier New", monospace`;
    while (g.measureText(phrase).width > avail && ps > 12) {
      ps *= 0.92;
      g.font = `${ps}px "Special Elite", "Courier New", monospace`;
    }
    g.fillText(phrase, cx, 122);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export class ForkStage extends Stage {
  branches: Branch[] = [];
  private lit: string | null = null;
  private pulse = 0;
  private rib = new THREE.Group();

  constructor(view: ForkView) {
    super();
    this.id = `fork:${view.node}`;
    this.stopShort = 26;
    this.clearRadius = 34;
    this.look(0, -14, 1.8);
    this.group.add(this.rib);

    const n = view.routes.length;
    const spread = n <= 2 ? 0.42 : n === 3 ? 0.56 : 0.66;
    view.routes.forEach((r, i) => {
      const angle = n === 1 ? 0 : (i / (n - 1) - 0.5) * 2 * spread;
      this.addBranch(r.id, r.name, r.sign, angle, i, n);
    });

    // The post stands on the verge, clear of every road, at the eye-line of the wagons.
    const px = 0.6;
    const pz = 6;
    // One group, so the ground-settling of a stage's top-level children moves post and boards together.
    const signs = new THREE.Group();
    signs.position.set(px, 0, pz);
    signs.add(new THREE.Mesh(merge([part(cyl(0.13, 0.17, 5.4, 6), DARKWOOD, { y: 2.7 })]), vcMaterial()));
    for (const b of this.branches) signs.add(b.board);
    this.group.add(signs);
    this.lantern(px + 2.6, pz + 2.6);

    // Something at the road's mouth, for the ones whose sign says what is on them.
    for (const [i, r] of view.routes.entries()) {
      const b = this.branches[i];
      const bx = b.dir.x * 11 + b.dir.y * 0;
      const bz = b.dir.y * 11;
      if (/cairn/i.test(r.sign ?? "")) this.add(P.cairn(), bx + b.dir.y * 3.6, bz - b.dir.x * 3.6);
      else if (/bell|post/i.test(r.sign ?? "")) this.add(P.lanternPost(), bx + b.dir.y * 3.6, bz - b.dir.x * 3.6);
    }
  }

  private addBranch(id: string, name: string, sign: string | undefined, angle: number, i: number, n: number): void {
    const dir = new THREE.Vector2(Math.sin(angle), -Math.cos(angle));
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.15, 0.105, 0.07), roughness: 1, emissive: new THREE.Color(0.012, 0.008, 0.005), polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, side: THREE.DoubleSide });
    // A strip of flat quads following a gentle curve; heights are set once placed (conform).
    const segs = 22;
    const pos = new Float32Array((segs + 1) * 2 * 3);
    const idx: number[] = [];
    for (let k = 0; k <= segs; k++) {
      const t = k / segs;
      const along = 1 + t * LEN;
      const bend = Math.sin(t * Math.PI) * 0.05 * LEN * (i % 2 ? -1 : 1) * 0.3;
      const cx = dir.x * along;
      const cz = dir.y * along;
      const nx = -dir.y;
      const nz = dir.x;
      const half = 2.5 - t * 0.9;
      const o = k * 6;
      pos[o] = cx + nx * half + bend * nx;
      pos[o + 2] = cz + nz * half + bend * nz;
      pos[o + 3] = cx - nx * half + bend * nx;
      pos[o + 5] = cz - nz * half + bend * nz;
      if (k < segs) {
        const a = k * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const ribbon = new THREE.Mesh(geo, mat);
    ribbon.frustumCulled = false;
    this.rib.add(ribbon);

    const phrase = signPhrase(sign);
    const left = angle < 0;
    const tex = boardTexture(name, phrase, left);
    const boardMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, side: THREE.DoubleSide, transparent: true, alphaTest: 0.5, emissive: new THREE.Color(0.28, 0.24, 0.18), emissiveMap: tex });
    const w = 3.5;
    const h = w * (176 / 512);
    const plane = new THREE.PlaneGeometry(w, h);
    plane.translate(left ? -(w / 2 + 0.06) : w / 2 + 0.06, 0.0, 0.16);
    const board = new THREE.Mesh(plane, boardMat);
    // Higher boards for earlier routes; each turned toward its own road.
    board.rotation.y = angle * 0.9;
    board.position.y = 4.75 - i * (n > 3 ? 0.98 : 1.1);
    this.branches.push({ id, angle, dir, ribbon, board, mat, boardMat, ribbonBase: this.rib });
  }

  /** Lay the ribbons on the ground. Call once the stage has been placed on the road. */
  conform(): void {
    this.group.updateMatrixWorld(true);
    const y0 = this.rib.position.y;
    const v = new THREE.Vector3();
    for (const b of this.branches) {
      const pos = b.ribbon.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let k = 0; k < pos.count; k++) {
        v.set(pos.getX(k), 0, pos.getZ(k));
        this.group.localToWorld(v);
        pos.setY(k, terrainHeight(v.x, v.z) - y0 + 0.22);
      }
      pos.needsUpdate = true;
      b.ribbon.geometry.computeVertexNormals();
      b.ribbon.geometry.computeBoundingSphere();
    }
  }

  /** Light one road (by choice id `route:<edge>`), or none. */
  focusRoute(id: string | null): void {
    this.lit = id;
  }

  /** The bearing of a route as a world-space direction, for cameras. */
  routeDir(id: string): THREE.Vector3 | null {
    const b = this.branches.find((x) => x.id === id);
    if (!b) return null;
    return this.group.localToWorld(new THREE.Vector3(b.dir.x * 20, 0, b.dir.y * 20)).sub(this.group.localToWorld(new THREE.Vector3())).normalize();
  }

  override update(dt: number, time: number): void {
    super.update(dt, time);
    this.pulse = time;
    for (const b of this.branches) {
      const on = this.lit === b.id;
      const k = on ? 0.55 + Math.sin(this.pulse * 4) * 0.12 : 0;
      b.mat.emissive.setRGB(0.012 + 0.5 * k, 0.008 + 0.16 * k, 0.005 + 0.06 * k);
      b.boardMat.emissive.setRGB(0.28 + 0.4 * k, 0.24 + 0.3 * k, 0.18 + 0.2 * k);
      const s = on ? 1.07 : 1;
      b.board.scale.setScalar(THREE.MathUtils.lerp(b.board.scale.x, s, Math.min(1, dt * 8)));
    }
  }

}

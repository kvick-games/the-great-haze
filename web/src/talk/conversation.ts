// Spoken dialogue in the world. A screen's `talk` lines play one at a time as
// captions over whoever is speaking, with the camera cutting between the
// speakers, and their moods and gestures shown on the figures. A dialogue
// check plays first as a die roll over the roller's head. Afterwards the tells
// the party noticed stay staged for the player to read before choosing.
//
// The director owns the world; this class only asks it for the camera, the
// figures and the UI through the small TalkHost interface below.

import * as THREE from "three";
import type { CheckResult, Screen, SceneInstance, SpokenLine } from "../../../src/game/types.ts";
import type { Figure } from "../world/actors.ts";
import type { ShotFn } from "../world/camera.ts";
import type { World } from "../world/world.ts";
import type { UI } from "../ui/ui.ts";
import type { Audio } from "../audio.ts";
import type { Stage } from "../scenes/vignettes.ts";
import { roadPoint } from "../world/train.ts";
import { roadX, terrainHeight } from "../world/regions.ts";
import { Cast } from "./cast.ts";
import type { Spot } from "./cast.ts";
import { TellCues } from "./tells.ts";
import { voice } from "./voice.ts";

export interface TalkHost {
  world: World;
  ui: UI;
  audio: Audio;
  fast: boolean;
  stage(): Stage | null;
  inst(): SceneInstance | null;
  /** Where a loose figure for a stranger with no staged place should stand. */
  spot(): Spot;
  shot(fn: ShotFn, rate: number, cut: boolean): void;
  /** Go back to the scene's own framing once the talking is done. */
  restoreShot(): void;
}

export interface Step {
  line: SpokenLine;
  fig: Figure;
}

export interface Plan {
  steps: Step[];
  check?: CheckResult;
  /** False when someone cannot be put on stage: the card shows the transcript instead. */
  staged: boolean;
}

/** Only these screens happen in the world where people can be seen. */
const TALKING_KINDS = new Set<Screen["kind"]>(["scene", "result", "plan", "arrival"]);
const KEEP_GESTURES = new Set(["kneel", "draw-weapon"]);

const lineKey = (l: SpokenLine) => `${l.speaker}|${l.text}`;
const checkKey = (c: CheckResult) => `${c.by}|${c.kind}|${c.roll}|${c.bonus}|${c.dc}|${c.target}`;

const flat = (v: THREE.Vector3) => new THREE.Vector3(v.x, 0, v.z);

export class Conversation {
  readonly cast: Cast;
  readonly cues: TellCues;
  active = false;
  /** Tools and tests: stop at this line (0-based) until advanced, even under #fast. */
  holdAt: number | null = null;  // -1 holds at the roll readout
  private played = new Set<string>();
  private lastCheck = "";
  private waiter: (() => void) | null = null;
  private timer: number | null = null;
  private skipping = false;
  private speaking: Figure | null = null;
  private roller: Figure | null = null;
  private tumbling = false;
  private tumbleT = 0;
  private placed = new Map<string, number>();
  private sideSign = 1;
  private people: Figure[] = [];

  private host: TalkHost;
  constructor(host: TalkHost) {
    this.host = host;
    this.cast = new Cast(host.world);
    this.cues = new TellCues(host.world.scene);
    host.world.onTick((dt) => this.update(dt));
    host.world.onLate(() => this.place());
  }

  // ------------------------------------------------------------ planning

  /** Forget what has been played (a new choice was made). */
  reset(): void {
    this.played.clear();
    this.lastCheck = "";
    this.cues.clear();
    this.host.ui.speech.showNotice(false);
    this.cast.release();
  }

  /** Let the loose figures go without touching what has been played. */
  release(): void {
    this.cast.release();
  }

  /** Whether this kind of screen is one where the talk is staged in the world. */
  handles(s: Screen): boolean {
    return TALKING_KINDS.has(s.kind);
  }

  /** Work out what there is to play for a screen. Null when there is nothing new. */
  plan(s: Screen): Plan | null {
    if (!TALKING_KINDS.has(s.kind)) return null;
    const fresh = s.talk.filter((l) => !this.played.has(lineKey(l)));
    const check = s.check && checkKey(s.check) !== this.lastCheck ? s.check : undefined;
    if (!fresh.length && !check) return null;
    const st = this.host.stage();
    const inst = this.host.inst();
    const steps: Step[] = [];
    let staged = true;
    for (const line of fresh) {
      const fig = this.cast.figureFor(line, st, inst, () => this.host.spot());
      if (!fig) staged = false;
      else steps.push({ line, fig });
    }
    return { steps, check, staged };
  }

  /** Mark a screen's lines as seen (the fallback path shows them on the card instead). */
  markSeen(s: Screen): void {
    for (const l of s.talk) this.played.add(lineKey(l));
    if (s.check) this.lastCheck = checkKey(s.check);
  }

  // ------------------------------------------------------------ playing

  async run(s: Screen, plan: Plan): Promise<void> {
    const h = this.host;
    this.active = true;
    this.skipping = false;
    this.placed.clear();
    this.people = [...new Set(plan.steps.map((x) => x.fig))];
    this.cues.clear();
    h.ui.speech.showNotice(false);
    h.world.rig.setFrame(0, 0, h.fast);
    this.chooseSide(plan);
    try {
      if (plan.check) {
        await this.playCheck(plan.check, plan);
        this.lastCheck = checkKey(plan.check);
      }
      for (let i = 0; i < plan.steps.length && !this.skipping; i++) {
        await this.playLine(plan, i);
        this.played.add(lineKey(plan.steps[i].line));
      }
    } finally {
      this.finish(s, plan);
    }
  }

  /** One line: cut to the shot, pose the speaker, show the words, wait for the player. */
  private async playLine(plan: Plan, i: number): Promise<void> {
    const h = this.host;
    const { line, fig } = plan.steps[i];
    const listener = this.listenerFor(plan, i);
    this.arrange(fig, listener);
    // The first cut eases in from wherever the camera was; later cuts are hard.
    h.shot(this.clearShot(fig, listener), i === 0 ? 3 : 8, i > 0 || h.fast);
    if (line.mood === "angry" || line.gesture === "draw-weapon") h.world.rig.kick(0.14);
    if (line.gesture === "draw-weapon") h.audio.sfx("sting");
    for (const f of this.people) if (f !== fig) f.setExpression(f.mood, KEEP_GESTURES.has(f.gesture) ? f.gesture : "none", false);
    fig.setExpression(line.mood, line.gesture, true);
    this.speaking = fig;
    h.ui.speech.showLine({ name: line.name, kind: line.kind, mood: line.mood, text: line.text }, i, plan.steps.length, h.fast);
    this.place();
    voice.speak(line);
    // Under #fast lines go by on their own, unless a tool asked to hold here.
    const auto = h.fast && this.holdAt !== i ? 0.35 : null;
    await this.waitAdvance(auto);
    this.speaking = null;
    voice.stop();
    h.ui.speech.hideLine();
    fig.setExpression(line.mood, KEEP_GESTURES.has(line.gesture) ? line.gesture : "none", false);
  }

  /** A dialogue check: the roller lights up, the die tumbles, the total is read against the number. */
  private async playCheck(c: CheckResult, plan: Plan): Promise<void> {
    const h = this.host;
    const tr = h.world.train;
    const roller = tr.figure(c.by) ?? null;
    const other = Cast.primary(h.stage())?.fig ?? plan.steps.find((x) => x.fig !== roller)?.fig ?? null;
    this.roller = roller;
    if (roller) {
      roller.setRing("focus");
      this.arrange(roller, other);
      h.shot(this.clearShot(roller, other), 3, h.fast);
    }
    h.ui.speech.startRoll(c);
    this.tumbling = true;
    this.place();
    await this.pause(h.fast ? 0.1 : 0.95);
    this.tumbling = false;
    h.ui.speech.settle(c);
    h.audio.sfx(c.success ? "coin" : "thud");
    if (!c.success) h.world.rig.kick(0.1);
    this.place();
    await this.waitAdvance(h.fast ? (this.holdAt === -1 ? null : 0.5) : 1.8);
    h.ui.speech.hideRoll();
    roller?.setRing("none");
    this.roller = null;
  }

  private finish(s: Screen, plan: Plan): void {
    const h = this.host;
    this.active = false;
    this.speaking = null;
    this.tumbling = false;
    voice.stop();
    h.ui.speech.hideLine();
    h.ui.speech.hideRoll();
    this.roller?.setRing("none");
    this.roller = null;
    for (const f of this.people) f.setExpression("calm", "none", false);
    for (const st of plan.steps) this.played.add(lineKey(st.line));
    if (plan.check) this.lastCheck = checkKey(plan.check);
    void s;
    h.restoreShot();
  }

  // ------------------------------------------------------------ input

  /** Space, click or tap: finish the words, or go on to the next line. */
  advance(): void {
    if (!this.active) return;
    if (this.host.ui.speech.finishReveal()) return;
    this.release_();
  }

  skipAll(): void {
    if (!this.active) return;
    this.skipping = true;
    voice.stop();
    this.release_();
  }

  private release_(): void {
    const w = this.waiter;
    this.waiter = null;
    this.timer = null;
    w?.();
  }

  private waitAdvance(auto: number | null): Promise<void> {
    return new Promise((res) => {
      this.waiter = res;
      // While the words are still appearing the auto timer waits for them.
      this.timer = auto;
    });
  }

  private pause(sec: number): Promise<void> {
    return new Promise((res) => {
      this.waiter = res;
      this.timer = sec;
    });
  }

  // ------------------------------------------------------------ frame updates

  private update(dt: number): void {
    this.cast.update(dt, this.host.world.time);
    this.cues.update(this.host.world.time);
    if (!this.active) return;
    const sp = this.host.ui.speech;
    const revealing = this.speaking ? sp.reveal(dt) : false;
    if (this.tumbling) {
      this.tumbleT += dt;
      if (this.tumbleT > 0.07) {
        this.tumbleT = 0;
        sp.tumble(1 + Math.floor(Math.random() * 20));
      }
    }
    if (this.timer !== null && !revealing) {
      this.timer -= dt;
      if (this.timer <= 0) this.release_();
    }
  }

  /** Pin the caption, roll readout and notice marker to their heads. */
  private place(): void {
    const h = this.host;
    const sp = h.ui.speech;
    const W = window.innerWidth;
    const H = window.innerHeight;
    if (this.active && this.speaking) {
      const p = this.project(this.headTop(this.speaking));
      sp.placeLine(p.x, p.y, W, H, h.ui.insets("talk"));
    }
    if (this.active && this.roller) {
      const p = this.project(this.headTop(this.roller));
      sp.placeRoll(p.x, p.y, W, H, h.ui.insets("talk"));
    }
    if (!this.active && sp.noticeOn && this.cues.target) {
      const p = this.project(this.headTop(this.cues.target, 0.28));
      sp.placeNotice(p.x, p.y, W, H, h.ui.insets("card"), p.front);
    }
  }

  private project(p: THREE.Vector3): { x: number; y: number; front: boolean } {
    const cam = this.host.world.rig.camera;
    const v = p.clone().project(cam);
    return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight, front: v.z < 1 && Math.abs(v.x) < 1.4 };
  }

  // ------------------------------------------------------------ tells

  /** After the talk: staged cues and the "You notice" marker for what the party has seen. */
  showTells(s: Screen): void {
    const fig = Cast.primary(this.host.stage())?.fig ?? this.cast.loose[0] ?? null;
    const any = s.tells.some((t) => t.visible);
    this.cues.set(s.tells, fig);
    this.host.ui.speech.showNotice(any && !!fig);
    this.place();
  }

  clearTells(): void {
    this.cues.clear();
    this.host.ui.speech.showNotice(false);
  }

  // ------------------------------------------------------------ staging and shots

  private listenerFor(plan: Plan, i: number): Figure | null {
    const me = plan.steps[i].fig;
    for (let k = i - 1; k >= 0; k--) if (plan.steps[k].fig !== me) return plan.steps[k].fig;
    for (let k = i + 1; k < plan.steps.length; k++) if (plan.steps[k].fig !== me) return plan.steps[k].fig;
    const other = Cast.primary(this.host.stage())?.fig;
    if (other && other !== me) return other;
    const lead = this.host.world.train.figure(this.host.world.train.leaderId);
    return lead && lead !== me ? lead : null;
  }

  private wpos(f: Figure): THREE.Vector3 {
    return f.root.getWorldPosition(new THREE.Vector3());
  }

  private memberId(f: Figure): string | null {
    for (const [id, a] of this.host.world.train.members) if (a.fig === f) return id;
    return null;
  }

  /** Eye height of a figure, allowing for sitting and kneeling. */
  private eye(f: Figure): THREE.Vector3 {
    const p = this.wpos(f);
    const pose = f.poseOverride ?? f.pose;
    const k = pose === "sit" ? 1.15 : pose === "kneel" ? 1.3 : pose === "lie" ? 0.5 : 1.82;
    return p.setY(p.y + k * f.heightScale);
  }

  private headTop(f: Figure, extra = 0): THREE.Vector3 {
    const p = this.wpos(f);
    const pose = f.poseOverride ?? f.pose;
    const k = pose === "sit" ? 1.5 : pose === "kneel" ? 1.6 : pose === "lie" ? 0.8 : 2.02;
    return p.setY(p.y + (k + extra) * f.heightScale);
  }

  private face(f: Figure, at: THREE.Vector3): void {
    const id = this.memberId(f);
    if (id) {
      const a = this.host.world.train.members.get(id)!;
      // Stand where they are, turned toward whoever they are talking to.
      const p = a.fig.root.position;
      a.stage = { x: a.stage?.x ?? p.x, z: a.stage?.z ?? p.z, face: at.clone(), pose: a.stage?.pose === "kneel" ? "kneel" : "stand" };
      return;
    }
    const parent = f.root.parent;
    const local = parent ? parent.worldToLocal(at.clone()) : at;
    f.targetYaw = Math.atan2(local.x - f.root.position.x, local.z - f.root.position.z);
  }

  /** Put a party speaker beside the stranger when the two are far apart, and turn both to face. */
  private arrange(a: Figure, b: Figure | null): void {
    if (!b) return;
    const ma = this.memberId(a);
    const mb = this.memberId(b);
    const pa = this.wpos(a);
    const pb = this.wpos(b);
    if (!!ma !== !!mb && flat(pa).distanceTo(flat(pb)) > 7) {
      const id = (ma ?? mb)!;
      const mem = ma ? a : b;
      const other = ma ? pb : pa;
      this.teleport(id, mem, other);
    }
    this.face(a, this.wpos(b));
    this.face(b, this.wpos(a));
  }

  private teleport(id: string, mem: Figure, near: THREE.Vector3): void {
    const tr = this.host.world.train;
    const a = tr.members.get(id);
    if (!a) return;
    let slot = this.placed.get(id);
    if (slot === undefined) {
      slot = this.placed.size;
      this.placed.set(id, slot);
    }
    const toward = (tr.camp > 0.5 ? tr.campCenter.clone() : roadPoint(tr.d + 6)).sub(near).setY(0).normalize();
    const side = new THREE.Vector3(toward.z, 0, -toward.x);
    const off = (slot % 2 ? 1 : -1) * (0.55 + 0.85 * Math.floor(slot / 2 + 0.5) * (slot ? 1 : 0));
    const p = near.clone().add(toward.multiplyScalar(2.6 + Math.floor(slot / 2) * 0.4)).add(side.multiplyScalar(off));
    mem.root.position.set(p.x, terrainHeight(p.x, p.z), p.z);
    a.stage = { x: p.x, z: p.z, face: near.clone(), pose: "stand" };
  }

  /** Pick the side of the conversation the camera lives on and stay there for the scene. */
  private chooseSide(plan: Plan): void {
    const s = plan.steps[0]?.fig ?? this.host.world.train.figure(this.host.world.train.leaderId);
    if (!s) return;
    const p = this.wpos(s);
    // Away from the road: the wagons and the lit road stay behind the speakers.
    this.sideSign = p.x >= roadX(p.z) ? 1 : -1;
  }

  private ray = new THREE.Raycaster();

  /** True when something solid (oxen, wagons, other people) stands between the camera and the speaker's head. */
  private hidden(from: THREE.Vector3, speaker: Figure, listener: Figure | null): boolean {
    const to = this.headTop(speaker, -0.12);
    const dir = to.clone().sub(from);
    const dist = dir.length();
    if (dist < 0.1) return false;
    this.ray.set(from, dir.normalize());
    this.ray.far = dist - 0.15;
    this.ray.camera = this.host.world.rig.camera;
    const roots: THREE.Object3D[] = [this.host.world.train.group];
    const st = this.host.stage();
    if (st) roots.push(st.group);
    const own = (o: THREE.Object3D | null) => {
      for (let n = o; n; n = n.parent) if (n === speaker.root || (listener && n === listener.root)) return true;
      return false;
    };
    for (const hit of this.ray.intersectObjects(roots, true)) {
      const m = hit.object as THREE.Mesh;
      if (!m.isMesh || !m.visible || own(m)) continue;
      const mat = Array.isArray(m.material) ? m.material[0] : m.material;
      if (!mat || mat.transparent || mat.depthWrite === false) continue;
      return true;
    }
    return false;
  }

  /**
   * The usual shot, unless the speaker would be hidden behind the oxen or a wagon. Then the camera
   * swings round the speaker (or climbs) to the nearest angle that shows them.
   */
  private clearShot(speaker: Figure, listener: Figure | null): ShotFn {
    const world = this.host.world;
    const t0 = world.time;
    const variants: [number, number][] = [[0, 0], [0.5, 0], [-0.5, 0], [0, 1.3], [1.0, 0.4], [-1.0, 0.4], [0.7, 1.4], [-0.7, 1.4], [1.5, 0.6], [-1.5, 0.6]];
    for (const [yaw, lift] of variants) {
      const fn = this.shotFor(speaker, listener, yaw * this.sideSign, lift);
      if (!this.hidden(fn(t0).pos, speaker, listener)) return fn;
    }
    // Nothing is clear: a high angle looking down over the obstruction.
    return this.shotFor(speaker, listener, 0, 2.4);
  }

  /** Shot / reverse-shot: over the listener's shoulder when close, otherwise a close 3/4 on the speaker. */
  private shotFor(speaker: Figure, listener: Figure | null, yaw = 0, lift = 0): ShotFn {
    const world = this.host.world;
    const base: ShotFn = (t) => {
      const cam = world.rig.camera;
      const tall = cam.aspect < 1;
      const S = this.eye(speaker);
      const sway = Math.sin(t * 0.35 + speaker.seed) * 0.06;
      if (listener) {
        const L = this.eye(listener);
        const gap = flat(S).distanceTo(flat(L));
        if (gap <= 6.5 && gap > 0.05) {
          // The same world-side normal for both directions, so the shots keep to one side of the axis.
          const ab = speaker.root.uuid < listener.root.uuid ? flat(L).sub(flat(S)) : flat(S).sub(flat(L));
          ab.normalize();
          const n = new THREE.Vector3(ab.z, 0, -ab.x).multiplyScalar(this.sideSign);
          const away = flat(L).sub(flat(S)).normalize();
          const back = tall ? 2.0 : 2.6;
          const pos = L.clone().add(away.multiplyScalar(back)).add(n.multiplyScalar((tall ? 1.1 : 1.4) + sway));
          pos.y = Math.max(Math.max(L.y, S.y) + 0.2, terrainHeight(pos.x, pos.z) + 1.0);
          const target = S.clone();
          target.y -= 0.1;
          return { pos, target, fov: 34 };
        }
      }
      const fwd = listener ? flat(this.eye(listener)).sub(flat(S)) : speaker.root.getWorldDirection(new THREE.Vector3());
      fwd.setY(0);
      if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, 1);
      fwd.normalize();
      fwd.applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.55 * this.sideSign);
      const dist = tall ? 3.0 : 3.5;
      const pos = S.clone().add(fwd.multiplyScalar(dist));
      pos.y = Math.max(S.y + 0.05, terrainHeight(pos.x, pos.z) + 0.9);
      const target = S.clone();
      target.y -= 0.12;
      return { pos, target, fov: 38 };
    };
    if (!yaw && !lift) return base;
    // A variant swings the camera round the speaker and/or lifts it.
    return (t) => {
      const r = base(t);
      const off = r.pos.clone().sub(r.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      const pos = r.target.clone().add(off);
      pos.y += lift;
      return { ...r, pos };
    };
  }
}

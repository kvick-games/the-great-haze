// The VideoDirector watches the game (never steers it), turns each meaningful choice into
// a story beat and a shot request, gets a clip for it (from a pre-baked manifest, the local
// realtime proxy, or a built-in placeholder), and plays it in a skippable overlay after the
// 3D scene. The 3D cinematic always runs first and is the fallback: if a clip is late, missing
// or broken the game simply carries on.
//
// Off by default. When off, every method returns immediately and nothing is recorded.

import type { Game } from "../../../src/game/game.ts";
import { StoryRecorder } from "../../../src/story/recorder.ts";
import type { Beat, Stakes } from "../../../src/story/mutations.ts";
import { shotForBeat } from "../../../src/story/shots.ts";
import type { ShotRequest } from "../../../src/story/shots.ts";
import { buildStoryGraph } from "../../../src/story/graph.ts";
import { planExport } from "../../../src/story/hyperlab.ts";
import { parseVideoMode } from "./mode.ts";
import type { VideoMode } from "./mode.ts";
import { playClip } from "./overlay.ts";
import type { ClipSource } from "./overlay.ts";

const STORY_KEY = "great-haze:3d:v1:story";
const GRAPH_KEY = "great-haze:3d:v1:graph";
const RANK: Record<Stakes, number> = { quiet: 0, minor: 1, notable: 2, "life-altering": 3 };

export type ClipState = "pending" | "ready" | "none" | "failed" | "played" | "skipped";

export interface ClipRecord {
  beat: Beat;
  request: ShotRequest | null;
  state: ClipState;
  source: ClipSource | null;
  note: string;
  /** Resolves when the clip is ready or has given up. */
  settled: Promise<void>;
}

interface BakedManifest {
  version: number;
  clips: Record<string, { url: string; duration?: number }>;
}

export class VideoDirector {
  readonly mode: VideoMode;
  recorder: StoryRecorder | null = null;
  readonly clips = new Map<string, ClipRecord>();
  private baked: Promise<BakedManifest | null> | null = null;
  private inflight = 0;
  private fast: boolean;
  private debugEl: HTMLElement | null = null;
  private playing = false;

  constructor(mode: VideoMode = parseVideoMode()) {
    this.mode = mode;
    this.fast = typeof location !== "undefined" && /fast/.test(location.hash + location.search) && !/videoSlow/.test(location.hash + location.search);
    if (mode.name !== "off" && typeof window !== "undefined") {
      window.addEventListener("keydown", (ev) => {
        if (ev.code === "Backquote" || (ev.shiftKey && ev.code === "KeyV" && !/input|textarea/i.test((ev.target as HTMLElement)?.tagName ?? ""))) this.toggleDebug();
      });
    }
  }

  get enabled(): boolean {
    return this.mode.name !== "off";
  }

  // ------------------------------------------------------------------ run lifecycle

  /** A new run starts. */
  begin(game: Game): void {
    if (!this.enabled) return;
    this.clips.clear();
    this.recorder = StoryRecorder.start(game.serialize(), { seed: game.s.seed });
    this.persist(game);
    this.refresh();
  }

  /** A saved run resumes: pick its story back up, or start a fresh one from here. */
  resume(game: Game): void {
    if (!this.enabled) return;
    this.clips.clear();
    try {
      const raw = localStorage.getItem(STORY_KEY);
      if (raw) {
        const rec = StoryRecorder.restore(raw);
        if (rec.run.seed === game.s.seed) {
          this.recorder = rec;
          this.refresh();
          return;
        }
      }
    } catch {
      /* fall through to a fresh story */
    }
    this.recorder = StoryRecorder.start(game.serialize(), { seed: game.s.seed });
    this.refresh();
  }

  static clearSaved(): void {
    try {
      localStorage.removeItem(STORY_KEY);
      localStorage.removeItem(GRAPH_KEY);
    } catch {
      /* ignore */
    }
  }

  /** Save the story next to the game save. The graph is rewritten every few beats and at the end. */
  persist(game: Game): void {
    if (!this.enabled || !this.recorder) return;
    try {
      if (game.over) {
        // Keep the finished story readable in the debug panel until the next run, but the save is done.
        localStorage.setItem(STORY_KEY, this.recorder.serialize());
        localStorage.setItem(GRAPH_KEY, JSON.stringify(buildStoryGraph(this.recorder.runRecord).sequence));
        return;
      }
      localStorage.setItem(STORY_KEY, this.recorder.serialize());
      if (this.recorder.beats.length % 5 === 0) localStorage.setItem(GRAPH_KEY, JSON.stringify(buildStoryGraph(this.recorder.runRecord).sequence));
    } catch {
      /* storage may be full or unavailable */
    }
  }

  // ------------------------------------------------------------------ per choice

  /** Capture the state just before a choice. */
  mark(game: Game): string {
    return this.enabled ? game.serialize() : "";
  }

  /** Record what the choice did and, if it is worth a clip, start getting one. */
  observe(before: string, game: Game, choiceId: string): Beat | null {
    if (!this.enabled || !this.recorder || !before) return null;
    let beat: Beat | null = null;
    try {
      beat = this.recorder.record(before, game.serialize(), choiceId);
    } catch (e) {
      console.error("story record failed", e);
      return null;
    }
    if (!beat) return null;
    const rec: ClipRecord = { beat, request: null, state: "none", source: null, note: "", settled: Promise.resolve() };
    this.clips.set(beat.id, rec);
    if (RANK[beat.stakes] >= RANK[this.mode.minStakes]) {
      rec.request = shotForBeat(beat, this.recorder.log, { specs: this.recorder.characters });
      rec.state = "pending";
      rec.settled = this.fetchClip(rec).catch((e) => {
        rec.state = "failed";
        rec.note = e instanceof Error ? e.message : String(e);
      });
    }
    this.refresh();
    return beat;
  }

  /** After the 3D scene: give a clip a moment to arrive, then play it. Never blocks longer than maxWaitMs. */
  async playFor(beat: Beat | null): Promise<void> {
    if (!beat || !this.enabled) return;
    const rec = this.clips.get(beat.id);
    if (!rec || rec.state === "none") return;
    if (rec.state === "pending") {
      await Promise.race([rec.settled, new Promise<void>((r) => setTimeout(r, this.fast ? Math.min(this.mode.maxWaitMs, 600) : this.mode.maxWaitMs))]);
    }
    if (rec.state === "ready") await this.play(rec);
  }

  async play(rec: ClipRecord): Promise<void> {
    if (!rec.source || this.playing) return;
    this.playing = true;
    try {
      const why = await playClip(rec.source, rec.beat.title, `${rec.beat.kind} · ${rec.beat.stakes}`, { fast: this.fast });
      rec.state = why === "skipped" ? "skipped" : why === "failed" ? "failed" : "played";
      if (why === "failed") rec.note = "playback failed; the 3D scene stands in";
    } finally {
      this.playing = false;
      this.refresh();
    }
  }

  // ------------------------------------------------------------------ getting clips

  private async fetchClip(rec: ClipRecord): Promise<void> {
    const req = rec.request!;
    const m = this.mode;
    if (m.name === "mock") {
      rec.source = { kind: "card", title: rec.beat.title, summary: req.summary, duration: this.fast ? 3 : 4 };
      rec.state = "ready";
      rec.note = "mock placeholder";
      this.refresh();
      return;
    }
    if (m.name === "baked") {
      this.baked ??= fetch(m.url, { cache: "no-store" }).then((r) => (r.ok ? (r.json() as Promise<BakedManifest>) : null)).catch(() => null);
      const man = await this.baked;
      const hit = man?.clips[req.templateKey];
      if (!hit) {
        rec.state = "none";
        rec.note = man ? "no baked clip for this beat" : "baked manifest not found";
        this.refresh();
        return;
      }
      rec.source = { kind: "video", url: new URL(hit.url, new URL(m.url, location.href)).toString() };
      rec.state = "ready";
      rec.note = "baked";
      this.refresh();
      return;
    }
    // realtime: ask the local proxy, then poll. Two at a time keeps the budget from running away.
    if (this.inflight >= 2) {
      rec.state = "none";
      rec.note = "skipped: two clips already rendering";
      this.refresh();
      return;
    }
    this.inflight++;
    try {
      const post = await fetch(`${m.url}/shot`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req) });
      const first = (await post.json()) as ShotStatus;
      if (!post.ok && post.status !== 202) throw new Error(first.error ?? `server said ${post.status}`);
      let st = first;
      const deadline = Date.now() + 180000;
      while (st.status !== "done" && st.status !== "error" && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, this.fast ? 250 : 1200));
        const r = await fetch(`${m.url}/shot/${st.id}`);
        st = (await r.json()) as ShotStatus;
      }
      if (st.status !== "done") throw new Error(st.error ?? "timed out");
      if (st.url) rec.source = { kind: "video", url: new URL(st.url, m.url).toString() };
      else if (st.placeholder) rec.source = { kind: "card", title: rec.beat.title, summary: st.placeholder.summary || req.summary, duration: this.fast ? 3 : st.placeholder.duration };
      else throw new Error("server sent no clip");
      rec.state = "ready";
      rec.note = "realtime";
    } finally {
      this.inflight--;
      this.refresh();
    }
  }

  // ------------------------------------------------------------------ debug panel

  toggleDebug(): void {
    if (this.debugEl) {
      this.debugEl.remove();
      this.debugEl = null;
      return;
    }
    const el = document.createElement("div");
    el.className = "hz-video-debug";
    el.style.cssText = "position:fixed;right:8px;top:8px;bottom:8px;width:min(420px,92vw);z-index:95;overflow:auto;background:rgba(6,8,13,0.94);color:#ebe2d1;border:1px solid rgba(235,226,209,0.3);font:11px/1.45 'Courier New',monospace;padding:8px 10px;";
    document.body.appendChild(el);
    this.debugEl = el;
    this.refresh();
  }

  /** Download helpers for the panel: the story, the Hyperlab graph and the export plan. */
  private download(name: string, data: unknown): void {
    const blob = new Blob([typeof data === "string" ? data : JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  private refresh(): void {
    const el = this.debugEl;
    if (!el) return;
    const rec = this.recorder;
    el.textContent = "";
    const head = document.createElement("div");
    head.textContent = `VIDEO ${this.mode.name.toUpperCase()}${this.mode.url ? " " + this.mode.url : ""} · min ${this.mode.minStakes} · ${rec ? rec.beats.length : 0} beats · ${rec ? rec.log.size : 0} datoms · ~$${this.totalUsd().toFixed(2)} requested`;
    head.style.cssText = "color:#f4a04d;margin-bottom:6px";
    el.appendChild(head);
    const bar = document.createElement("div");
    bar.style.marginBottom = "6px";
    const button = (label: string, fn: () => void) => {
      const b = document.createElement("button");
      b.textContent = label;
      b.style.cssText = "font:inherit;margin-right:6px;background:#1a1d27;color:#ebe2d1;border:1px solid rgba(235,226,209,0.3);padding:2px 6px;cursor:pointer";
      b.addEventListener("click", fn);
      bar.appendChild(b);
    };
    button("close", () => this.toggleDebug());
    if (rec) {
      button("story.json", () => this.download("great-haze-story.json", rec.serialize()));
      button("graph.hlseq.json", () => this.download("great-haze.hlseq.json", buildStoryGraph(rec.runRecord).sequence));
      button("hyperlab plan", () => this.download("great-haze-hyperlab-plan.json", planExport(rec.runRecord, { projectPath: "PATH_TO_PROJECT_FOLDER" })));
    }
    el.appendChild(bar);
    if (!rec) return;
    for (const b of rec.beats.slice().reverse().slice(0, 60)) {
      const c = this.clips.get(b.id);
      const row = document.createElement("div");
      row.style.cssText = "border-top:1px solid rgba(235,226,209,0.12);padding:4px 0";
      const muts = b.mutations.filter((m) => m.kind !== "region").map((m) => `${m.lifeAltering ? "!" : ""}${m.kind}:${m.subject}`).join(" ");
      row.textContent = `#${b.index} d${b.day} ${b.kind}/${b.stakes} tx${b.tx}\n${b.title}\n${muts}\n${c?.request ? `req ${c.request.cacheKey.slice(-22)} ${c.request.duration}s ${c.request.resolution} $${c.request.estimated_usd.toFixed(2)} refs${c.request.references.length}` : "no request"} [${c?.state ?? "-"}] ${c?.note ?? ""}`;
      row.style.whiteSpace = "pre-wrap";
      if (c && c.source && (c.state === "ready" || c.state === "played" || c.state === "skipped")) {
        const p = document.createElement("button");
        p.textContent = "play";
        p.style.cssText = "font:inherit;margin-left:6px;background:#1a1d27;color:#ebe2d1;border:1px solid rgba(235,226,209,0.3);padding:0 5px;cursor:pointer";
        p.addEventListener("click", () => void this.play(c));
        row.appendChild(p);
      }
      el.appendChild(row);
    }
  }

  totalUsd(): number {
    let n = 0;
    for (const c of this.clips.values()) if (c.request && c.state !== "none") n += c.request.estimated_usd;
    return n;
  }
}

interface ShotStatus {
  id: string;
  status: "queued" | "running" | "done" | "error";
  url?: string;
  placeholder?: { title: string; summary: string; duration: number };
  error?: string;
}

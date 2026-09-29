// The game's adaptive soundtrack: reads the director and world a few times a
// second, maps them to score states and parameters (cues.ts), and drives the
// DreamEngine music host. Deaths, a closing Haze and dialogue are handled here
// as stingers, a held grief section and ducking.
//
// Headless and #fast runs get an inert host: the sequencer still runs, so
// status() and the probes see sections change, but no audio context is made.

import { DreamMusicHost, defaultMusicInert, type MusicStatus } from "@dreamatron/dreamengine-music/host";
import score from "../../../assets/music/the-great-haze.dtscore.json";
import type { GameState, HazeZone, Screen } from "../../../src/game/types.ts";
import { musicCues, newlyDead, zoneWorsened, type MusicScene, type MusicView } from "./cues.ts";

/** How long the grief section holds after a death, in seconds. */
const MOURN_SECONDS = 36;
const POLL_SECONDS = 0.25;

/** The parts of the director the music reads. */
export interface MusicSource {
  game: { s: GameState } | null;
  screen: Screen | null;
  busy: boolean;
  conv: { active: boolean };
}

/** The parts of the world the music reads. */
export interface MusicWorld {
  mood: { night: number };
  train: { camp: number; speed: number };
}

function suppressed(): boolean {
  if (defaultMusicInert()) return true;
  return typeof location !== "undefined" && /fast/.test(location.hash + location.search);
}

function speaking(): boolean {
  try {
    return typeof speechSynthesis !== "undefined" && speechSynthesis.speaking;
  } catch {
    return false;
  }
}

export class GameMusic {
  readonly host: DreamMusicHost;
  private acc = POLL_SECONDS;
  private mournLeft = 0;
  private mournFor: string | null = null;
  private scenario = "none";
  private alive: Set<string> | null = null;
  private zone: HazeZone | null = null;
  private scene: MusicScene | null = null;
  private previous: MusicScene | null = null;
  private manualDuck = false;
  private userMuted = false;
  private soundOn = true;
  private volume = 0.7;
  private failed = false;

  constructor() {
    let host: DreamMusicHost;
    try {
      host = new DreamMusicHost(score, { volume: this.volume, states: { scene: "title" } }, { inert: suppressed() });
    } catch (e) {
      // A broken score must never stop the game: fall back to a silent host.
      console.error(e);
      this.failed = true;
      host = new DreamMusicHost(score, {}, { inert: true });
    }
    this.host = host;
    // An inert host needs no gesture: run it from the start so probes can read sections.
    if (host.inert) void host.resume().catch(() => undefined);
  }

  /** Start on a user gesture (browsers block audio until one). */
  wake(): void {
    if (this.failed) return;
    void this.host.resume().catch(() => undefined);
  }

  /** Lower the music while a voice speaks. The speech voice (talk/voice.ts) can call this directly. */
  duck(on: boolean): void {
    this.manualDuck = on;
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.host.setVolume(this.volume);
  }

  setMuted(muted: boolean): void {
    this.userMuted = muted;
    this.applyMute();
  }

  /** Follow the game's master sound switch. */
  setSound(on: boolean): void {
    this.soundOn = on;
    this.applyMute();
  }

  /** True when music is audible (not muted, not inert). */
  get audible(): boolean {
    return !this.host.inert && this.host.running && this.soundOn && !this.userMuted;
  }

  private applyMute(): void {
    this.host.setMuted(this.userMuted || !this.soundOn);
  }

  update(dt: number, src: MusicSource, world: MusicWorld): void {
    this.host.advance(dt);
    this.mournLeft = Math.max(0, this.mournLeft - dt);
    this.acc += dt;
    if (this.acc < POLL_SECONDS) return;
    this.acc = 0;

    const s = src.game?.s ?? null;
    const screen = src.game ? src.screen : null;
    const hud = screen?.hud;

    // Deaths since the last look: toll the bell and hold the grief section.
    if (s) {
      if (this.alive) {
        const dead = newlyDead(this.alive, s.party);
        if (dead.length) {
          this.host.stinger("death");
          this.mournLeft = MOURN_SECONDS;
          this.mournFor = dead[0];
        }
      }
      this.alive = new Set(s.party.filter((m) => m.alive).map((m) => m.id));
    } else {
      this.alive = null;
      this.mournLeft = 0;
      this.mournFor = null;
    }

    const zone = hud?.zone ?? null;
    if (zoneWorsened(this.zone, zone)) this.host.stinger("haze");
    this.zone = zone;

    const view: MusicView = {
      state: s,
      screenKind: screen?.kind ?? null,
      regionId: hud?.regionId ?? null,
      zone,
      night: world.mood.night,
      camp: world.train.camp,
      moving: Math.min(1, Math.abs(world.train.speed) / 4),
      busy: src.busy,
      mourning: this.mournLeft > 0,
      mournFor: this.mournLeft > 0 ? this.mournFor : null,
      previous: this.previous,
    };
    const { states, params } = musicCues(view);
    // The witch announces herself once each time she appears.
    if (states.scenario === "witch" && this.scenario !== "witch") this.host.stinger("witch");
    this.scenario = states.scenario;
    if (states.scene !== this.scene) {
      this.previous = this.scene;
      this.scene = states.scene;
    }
    this.host.setParams(params);
    this.host.setStates(states);
    this.host.duck(this.manualDuck || src.conv.active || speaking());
  }

  status(): MusicStatus & { inert: boolean; audible: boolean; mourning: boolean } {
    return { ...this.host.status(), inert: this.host.inert, audible: this.audible, mourning: this.mournLeft > 0 };
  }
}

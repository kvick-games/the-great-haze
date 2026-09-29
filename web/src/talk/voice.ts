// Spoken voices for dialogue. `Voice` is the small seam the conversation uses:
// speak(line) when a caption appears, stop() when it goes. The default backend
// is the browser's built-in speech synthesis: no network, no keys, and a robotic
// but stable voice per speaker. A recorded voice pack can replace it later by
// registering a clip resolver (setClipResolver): when a line has a baked audio
// clip, that plays instead and synthesis is skipped.

import type { Mood, SpokenLine } from "../../../src/game/types.ts";

export interface Voice {
  speak(line: SpokenLine): void;
  stop(): void;
  /** Flip muting; returns whether voices are now on. */
  toggle(): boolean;
  readonly enabled: boolean;
}

/** Maps a line to a URL of a pre-generated audio clip, or null when there is none. */
export type ClipResolver = (line: SpokenLine) => string | null;

const KEY = "the-great-haze.voice";

function readEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

/** Headless tests and #fast runs must stay silent and never wait on speech. */
function suppressed(): boolean {
  if (typeof navigator !== "undefined" && navigator.webdriver) return true;
  return typeof location !== "undefined" && /fast/.test(location.hash + location.search);
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Mood nudges to rate and pitch, as multipliers. */
const MOOD: Record<Mood, { rate: number; pitch: number }> = {
  calm: { rate: 1, pitch: 1 },
  afraid: { rate: 1.18, pitch: 1.15 },
  angry: { rate: 1.08, pitch: 0.92 },
  pleading: { rate: 1.02, pitch: 1.1 },
  sly: { rate: 0.92, pitch: 0.95 },
  grieving: { rate: 0.78, pitch: 0.82 },
  cold: { rate: 0.95, pitch: 0.7 },
};

export class SpeechVoice implements Voice {
  enabled = readEnabled();
  private synth: SpeechSynthesis | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private clip: HTMLAudioElement | null = null;
  private resolver: ClipResolver | null = null;

  constructor() {
    if (suppressed()) return;
    const synth = typeof speechSynthesis !== "undefined" ? speechSynthesis : null;
    if (!synth || typeof SpeechSynthesisUtterance === "undefined") return;
    this.synth = synth;
    const load = () => {
      const all = synth.getVoices();
      const en = all.filter((v) => /^en\b/i.test(v.lang));
      // Sorted so the same speaker gets the same voice on every visit.
      this.voices = (en.length ? en : all).slice().sort((a, b) => a.name.localeCompare(b.name));
    };
    load();
    synth.addEventListener?.("voiceschanged", load);
  }

  /** Extension point: prefer a pre-generated recording of a line when one exists. */
  setClipResolver(fn: ClipResolver | null): void {
    this.resolver = fn;
  }

  speak(line: SpokenLine): void {
    this.stop();
    if (!this.enabled || suppressed()) return;
    const url = this.resolver?.(line);
    if (url) {
      try {
        const a = new window.Audio(url);
        this.clip = a;
        void a.play().catch(() => undefined);
      } catch {
        /* a missing clip is just silence */
      }
      return;
    }
    const synth = this.synth;
    if (!synth || !this.voices.length || !line.text.trim()) return;
    try {
      const h = hash(line.speaker);
      const u = new SpeechSynthesisUtterance(line.text);
      const v = this.voices[h % this.voices.length];
      u.voice = v;
      u.lang = v.lang;
      // Narrators and townsfolk sit low and slow; party members and strangers vary by person.
      const base = line.kind === "npc" ? { rate: 0.88, pitch: 0.6 } : { rate: 0.9 + ((h >> 8) % 30) / 100, pitch: 0.7 + ((h >> 16) % 70) / 100 };
      const m = MOOD[line.mood] ?? MOOD.calm;
      u.rate = Math.max(0.5, Math.min(2, base.rate * m.rate));
      u.pitch = Math.max(0, Math.min(2, base.pitch * m.pitch));
      synth.speak(u);
    } catch {
      /* speech is a nicety; never break the scene */
    }
  }

  stop(): void {
    if (this.clip) {
      this.clip.pause();
      this.clip = null;
    }
    try {
      this.synth?.cancel();
    } catch {
      /* ignore */
    }
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    try {
      localStorage.setItem(KEY, this.enabled ? "on" : "off");
    } catch {
      /* ignore */
    }
    if (!this.enabled) this.stop();
    return this.enabled;
  }
}

/** The one voice the client uses. */
export const voice = new SpeechVoice();

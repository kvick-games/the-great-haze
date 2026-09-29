// Types for the DreamEngine music host, which the build resolves from a
// DreamEngine checkout (tools/music-engine.ts). Only what the client uses.

declare module "@dreamatron/dreamengine-music/host" {
  export type MusicQuantize = "now" | "beat" | "bar" | "phrase";
  export interface MusicStatus {
    started: boolean;
    section: string | null;
    bar: number;
    phrase: number;
    pending: { section: string; quantize: MusicQuantize } | null;
    layers: string[];
    motifs: string[];
    states: Record<string, string>;
    params: Record<string, number>;
  }
  export interface MusicMarker {
    type: "section" | "bar" | "cut" | "stinger";
    time: number;
    [key: string]: unknown;
  }
  export interface DreamMusicSettings {
    enabled?: boolean;
    volume?: number;
    duckDb?: number;
    startSection?: string;
    seed?: number;
    params?: Record<string, number>;
    states?: Record<string, string>;
  }
  export function defaultMusicInert(): boolean;
  export class DreamMusicHost {
    constructor(score: unknown, settings?: DreamMusicSettings, options?: { context?: AudioContext | null; destination?: AudioNode; inert?: boolean });
    readonly inert: boolean;
    readonly running: boolean;
    resume(): Promise<void>;
    setStates(states: Record<string, string>): void;
    setParams(params: Record<string, number>): void;
    play(section: string, quantize?: MusicQuantize): void;
    stinger(id: string): void;
    duck(on: boolean): void;
    setVolume(volume: number): void;
    setMuted(muted: boolean): void;
    onMarker(listener: (event: MusicMarker) => void): () => void;
    advance(seconds: number): void;
    status(): MusicStatus;
    dispose(): void;
  }
}

/** Score documents are bundled as JSON and validated by the host when it loads them. */
declare module "*.dtscore.json" {
  const score: unknown;
  export default score;
}

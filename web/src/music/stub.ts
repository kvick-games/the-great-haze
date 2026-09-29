// Stand-in for the DreamEngine music host when the build finds no DreamEngine
// checkout with the music package (see tools/music-engine.ts). Silent, never throws.

type Status = {
  started: boolean;
  section: string | null;
  bar: number;
  phrase: number;
  pending: null;
  layers: string[];
  motifs: string[];
  states: Record<string, string>;
  params: Record<string, number>;
};

export function defaultMusicInert(): boolean {
  return true;
}

export class DreamMusicHost {
  readonly inert = true;
  readonly unavailable = true;
  private states: Record<string, string> = {};
  private params: Record<string, number> = {};
  get running(): boolean {
    return false;
  }
  async resume(): Promise<void> {}
  setStates(states: Record<string, string>): void {
    Object.assign(this.states, states);
  }
  setParams(params: Record<string, number>): void {
    Object.assign(this.params, params);
  }
  play(): void {}
  stinger(): void {}
  duck(): void {}
  setVolume(): void {}
  setMuted(): void {}
  onMarker(): () => void {
    return () => undefined;
  }
  advance(): void {}
  status(): Status {
    return { started: false, section: null, bar: 0, phrase: 0, pending: null, layers: [], motifs: [], states: { ...this.states }, params: { ...this.params } };
  }
  dispose(): void {}
}

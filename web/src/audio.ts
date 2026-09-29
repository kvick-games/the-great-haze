// Procedural sound, no files: wind, a low drone that swells as the Haze
// closes, wheel rumble on the road, fire crackle in camp, and one-shot effects.

export type Sfx = "shot" | "burst" | "rocket" | "bell" | "hit" | "thud" | "coin" | "sting" | "creak" | "whisper";

export interface AudioMood {
  haze: number;
  night: number;
  camp: number;
  moving: number;
}

export class Audio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private noise!: AudioBuffer;
  private windGain!: GainNode;
  private windFilter!: BiquadFilterNode;
  private droneGain!: GainNode;
  private rumbleGain!: GainNode;
  private crackleAcc = 0;
  private creakAcc = 0;
  on = false;
  /** 0-1: how much the adaptive music is carrying the Haze. Its dread layer replaces most of this drone. */
  musicBed = 0;
  private unavailable = false;

  private init(): boolean {
    if (this.ctx) return true;
    if (this.unavailable) return false;
    const Ctor = (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) as typeof AudioContext | undefined;
    let ctx: AudioContext;
    try {
      if (!Ctor) throw new Error("no Web Audio");
      ctx = new Ctor();
    } catch {
      // No sound is better than no game.
      this.unavailable = true;
      return false;
    }
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      d[i] = white * 0.6 + last * 3;
    }
    // Wind.
    const wind = this.loop();
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = "lowpass";
    this.windFilter.frequency.value = 400;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.08;
    wind.connect(this.windFilter).connect(this.windGain).connect(this.master);
    // Drone.
    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0;
    const dl = ctx.createBiquadFilter();
    dl.type = "lowpass";
    dl.frequency.value = 220;
    dl.connect(this.droneGain).connect(this.master);
    for (const [f, type, g] of [
      [41.2, "sawtooth", 0.25],
      [55.4, "sawtooth", 0.2],
      [27.5, "sine", 0.6],
      [82.7, "triangle", 0.12],
    ] as [number, OscillatorType, number][]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = g;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07 + Math.random() * 0.1;
      const lg = ctx.createGain();
      lg.gain.value = g * 0.5;
      lfo.connect(lg).connect(og.gain);
      o.connect(og).connect(dl);
      o.start();
      lfo.start();
    }
    // Rumble of wheels and hooves.
    const rum = this.loop();
    const rl = ctx.createBiquadFilter();
    rl.type = "lowpass";
    rl.frequency.value = 140;
    this.rumbleGain = ctx.createGain();
    this.rumbleGain.gain.value = 0;
    rum.connect(rl).connect(this.rumbleGain).connect(this.master);
    return true;
  }

  private loop(): AudioBufferSourceNode {
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.loopStart = Math.random();
    src.start(0, Math.random() * 1.5);
    return src;
  }

  toggle(): boolean {
    if (!this.on) {
      if (!this.init()) return false;
      void this.ctx!.resume();
      this.on = true;
      this.master.gain.setTargetAtTime(0.9, this.ctx!.currentTime, 0.4);
    } else {
      this.on = false;
      this.master.gain.setTargetAtTime(0, this.ctx!.currentTime, 0.2);
    }
    return this.on;
  }

  /** Start sound on the first user gesture if the player has not muted it. */
  wake(): void {
    if (this.on || this.ctx) return;
    this.toggle();
  }

  update(mood: AudioMood, dt: number): void {
    if (!this.ctx || !this.on) return;
    const t = this.ctx.currentTime;
    this.windGain.gain.setTargetAtTime(0.05 + 0.05 * mood.night + 0.06 * mood.haze, t, 0.5);
    this.windFilter.frequency.setTargetAtTime(300 + 500 * (0.5 + 0.5 * Math.sin(t * 0.13)) + 400 * mood.haze, t, 0.8);
    this.droneGain.gain.setTargetAtTime((0.02 + 0.3 * mood.haze * mood.haze) * (1 - 0.7 * this.musicBed), t, 1.2);
    this.rumbleGain.gain.setTargetAtTime(0.28 * mood.moving, t, 0.3);
    this.crackleAcc += dt * 9 * mood.camp;
    while (this.crackleAcc > 1) {
      this.crackleAcc -= Math.random() * 2;
      this.click(1800 + Math.random() * 2400, 0.02 + Math.random() * 0.05, 0.05);
    }
    this.creakAcc += dt * 0.35 * mood.moving;
    if (this.creakAcc > 1) {
      this.creakAcc = 0;
      this.sfx("creak");
    }
  }

  private click(freq: number, gain: number, dur: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = freq;
    bp.Q.value = 3;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t, Math.random() * 1.5, dur + 0.05);
  }

  private tone(freq: number, dur: number, gain: number, type: OscillatorType = "sine", sweepTo?: number, delay = 0): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    const t = ctx.currentTime + delay;
    o.frequency.setValueAtTime(freq, t);
    if (sweepTo) o.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private hiss(dur: number, gain: number, from: number, to: number, type: BiquadFilterType = "bandpass", delay = 0): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    const t = ctx.currentTime + delay;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random(), dur + 0.1);
  }

  sfx(kind: Sfx): void {
    if (!this.ctx || !this.on) return;
    switch (kind) {
      case "shot":
        this.hiss(0.35, 0.9, 2400, 300, "lowpass");
        this.tone(90, 0.25, 0.6, "sine", 40);
        break;
      case "burst":
        this.hiss(0.7, 0.5, 300, 2000);
        this.tone(70, 0.4, 0.3, "sine", 35);
        break;
      case "rocket":
        this.hiss(1.1, 0.25, 600, 5000, "highpass");
        this.hiss(0.9, 0.9, 1800, 200, "lowpass", 1.1);
        this.tone(55, 0.8, 0.7, "sine", 30, 1.1);
        break;
      case "bell":
        for (const [f, g] of [
          [196, 0.25],
          [233, 0.12],
          [392, 0.08],
          [587, 0.05],
        ]) this.tone(f, 4.5, g);
        break;
      case "hit":
        this.tone(120, 0.18, 0.5, "triangle", 50);
        this.hiss(0.15, 0.4, 900, 200, "lowpass");
        break;
      case "thud":
        this.tone(60, 0.5, 0.6, "sine", 30);
        break;
      case "coin":
        this.tone(1320, 0.12, 0.12, "triangle");
        this.tone(1760, 0.18, 0.1, "triangle", undefined, 0.07);
        break;
      case "sting":
        this.tone(55, 3, 0.35, "sine");
        this.tone(58.3, 3, 0.25, "sawtooth");
        this.hiss(2.5, 0.12, 200, 1200);
        break;
      case "creak":
        this.tone(180 + Math.random() * 80, 0.35, 0.03, "sawtooth", 120 + Math.random() * 60);
        break;
      case "whisper":
        this.hiss(1.8, 0.1, 3000, 800);
        break;
    }
  }
}

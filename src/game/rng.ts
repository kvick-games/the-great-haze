// Deterministic seeded RNG (mulberry32). The generator state lives inside the
// game state object so a save file replays identically.

export type Amount = number | [number, number];

export class Rng {
  holder: { rng: number };

  constructor(holder: { rng: number }) {
    this.holder = holder;
  }

  next(): number {
    let t = (this.holder.rng = (this.holder.rng + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Inclusive integer range. */
  int(min: number, max: number): number {
    return Math.floor(min + this.next() * (max - min + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }

  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  /** Weighted pick; entries with weight <= 0 are never chosen. Returns undefined if none qualify. */
  weighted<T>(items: readonly T[], weight: (item: T) => number): T | undefined {
    let total = 0;
    const weights = items.map((item) => {
      const w = Math.max(0, weight(item));
      total += w;
      return w;
    });
    if (total <= 0) return undefined;
    let roll = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      roll -= weights[i];
      if (roll < 0) return items[i];
    }
    return items[items.length - 1];
  }

  /** Resolve a fixed number or an inclusive [min, max] range to an integer. */
  amount(spec: Amount): number {
    return typeof spec === "number" ? Math.round(spec) : this.int(spec[0], spec[1]);
  }
}

export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h | 0;
}

// Deciding what the road throws at you each day.

import type { GameState, QueueItem, SceneDef } from "./types.ts";
import type { Env } from "./effects.ts";
import { allConds } from "./effects.ts";
import { avgNerve, bond, living, hasTrait } from "./party.ts";
import { PACES, TUNING, zoneOf } from "./tuning.ts";
import { encounterBonus, regionOf } from "./map.ts";
import { SCENES } from "./content/scenes/index.ts";
import { hasPair } from "./scenes.ts";

const ROAD_KINDS = new Set(["hazard", "stranger", "find", "haze", "oddity", "respite"]);

function eligible(env: Env, def: SceneDef): boolean {
  const s = env.s;
  if (def.regions && !def.regions.includes(regionOf(s).id)) return false;
  if (def.minMile !== undefined && s.miles < def.minMile) return false;
  if (def.maxMile !== undefined && s.miles > def.maxMile) return false;
  if (def.once && s.used.includes(def.id)) return false;
  if (def.others && s.party.filter((m) => m.alive && !m.isLeader).length < 2) return false;
  env.bind = {};
  return allConds(env, def.when);
}

function recencyFactor(s: GameState, id: string): number {
  const idx = s.recent.lastIndexOf(id);
  if (idx < 0) return 1;
  const age = s.recent.length - 1 - idx;
  if (age < 3) return 0;
  if (age < 8) return 0.2;
  return 1;
}

export function pickRoadScene(env: Env, exclude: string[] = []): SceneDef | undefined {
  const s = env.s;
  const pool = SCENES.filter((d) => ROAD_KINDS.has(d.kind) && !exclude.includes(d.id) && eligible(env, d));
  const zone = zoneOf(s.gap);
  return env.rng.weighted(pool, (d) => {
    let w = d.weight * recencyFactor(s, d.id);
    if (d.closeBias && (zone === "close" || zone === "upon")) w *= d.closeBias;
    // Respite only makes sense when people are worn down.
    if (d.kind === "respite") w *= avgNerve(s) < 55 ? 2 : 0.2;
    return w;
  });
}

export function disputeChance(s: GameState): number {
  const ms = living(s);
  if (ms.length < 2) return 0;
  let p = TUNING.disputeBase;
  p += (1 - avgNerve(s) / 100) * 0.25;
  if (s.res.rations < ms.length * 3) p += 0.1;
  if (s.rations === "meager") p += 0.03;
  if (s.rations === "bare") p += 0.07;
  let lowBonds = 0;
  for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) if (bond(s, ms[i].id, ms[j].id) < -20) lowBonds++;
  p += Math.min(0.12, lowBonds * 0.03);
  p += ms.filter((m) => hasTrait(m, "hothead")).length * 0.02;
  const zone = zoneOf(s.gap);
  if (zone === "close" || zone === "upon") p += 0.05;
  return Math.max(0, Math.min(0.55, p));
}

export function pickDispute(env: Env): SceneDef | undefined {
  const s = env.s;
  const pool = SCENES.filter((d) => d.kind === "dispute" && eligible(env, d) && hasPair(env, d));
  return env.rng.weighted(pool, (d) => d.weight * recencyFactor(s, d.id));
}

/** Roll the scenes for a day, in the order the road delivers them. */
export function rollDay(env: Env): QueueItem[] {
  const { s, rng } = env;
  const items: QueueItem[] = [];
  const pace = PACES[s.pace];
  const region = regionOf(s);
  const chosen: string[] = [];

  // A member with a low mood or a dying friend can also ruin the day, but the
  // road itself is the main source of trouble.
  if (s.gap < 14 && s.gap > 0 && s.day - (s.flags.lastStandDay ?? -99) >= 6) {
    s.flags.lastStandDay = s.day;
    items.push({ t: "scene", id: "last-stand" });
    chosen.push("last-stand");
  }
  if (s.train.condition < 50 && rng.chance((50 - s.train.condition) / 100)) {
    items.push({ t: "scene", id: "axle-break" });
    chosen.push("axle-break");
  }

  const pEncounter = Math.max(0.1, Math.min(0.9, region.encounter + pace.encounter + encounterBonus(s)));
  if (rng.chance(pEncounter)) {
    const def = pickRoadScene(env, chosen);
    if (def) {
      items.push({ t: "scene", id: def.id });
      chosen.push(def.id);
    }
    if (rng.chance(0.14)) {
      const second = pickRoadScene(env, chosen);
      if (second) {
        items.push({ t: "scene", id: second.id });
        chosen.push(second.id);
      }
    }
  }

  if (rng.chance(disputeChance(s))) {
    const dispute = pickDispute(env);
    if (dispute) items.push({ t: "scene", id: dispute.id });
  }
  return items;
}

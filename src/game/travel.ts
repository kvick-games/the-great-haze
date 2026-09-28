// Movement math: how fast the train goes and how fast the Haze follows.

import type { GameState, HazeZone } from "./types.ts";
import { TUNING, PACES, DIFFICULTY, zoneOf } from "./tuning.ts";
import { clamp } from "./party.ts";
import { regionAt } from "./world.ts";

export function wagonSpeedFactor(s: GameState): number {
  return 0.55 + 0.45 * (s.train.condition / 100);
}

/** Miles covered per travel hour right now. */
export function mph(s: GameState): number {
  return TUNING.baseMph * regionAt(s.miles).terrain * wagonSpeedFactor(s);
}

export function hoursToMiles(s: GameState, hours: number): number {
  return hours * mph(s);
}

export function travelHoursAvailable(s: GameState): number {
  return PACES[s.pace].hours;
}

export function zone(s: GameState): HazeZone {
  return zoneOf(s.gap);
}

export function baseHazeMiles(s: GameState): number {
  return regionAt(s.miles).haze * DIFFICULTY[s.difficulty].haze;
}

export interface TravelPlan {
  /** Hours actually spent moving today. */
  travelHours: number;
  /** Hours of delay that spill into tomorrow. */
  carry: number;
  /** 0-1: how restful a halt day was. */
  restQuality: number;
}

/**
 * Turn the hours the day's business consumed into hours on the road. Every hour
 * spent stopping is an hour not travelling while the Haze keeps its own clock.
 */
export function planTravel(s: GameState): TravelPlan {
  const spent = s.today.hoursUsed + s.carryHours;
  if (s.pace === "halt") {
    return { travelHours: 0, carry: Math.max(0, spent - 12), restQuality: clamp(1 - spent / 12, 0.25, 1) };
  }
  const available = travelHoursAvailable(s);
  return {
    travelHours: Math.max(0, available - spent),
    carry: Math.min(TUNING.maxCarryHours, Math.max(0, spent - available)),
    restQuality: 1,
  };
}

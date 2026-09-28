// Movement math: how fast the train goes and how fast the Haze follows.

import type { GameState, HazeZone } from "./types.ts";
import { TUNING, PACES, DIFFICULTY, zoneOf } from "./tuning.ts";
import { clamp } from "./party.ts";
import { activeEdge, hazeMult, mphOn, regionOf, wagonSpeedFactor } from "./map.ts";

export { wagonSpeedFactor };

/** Miles covered per travel hour right now. */
export function mph(s: GameState): number {
  const e = activeEdge(s);
  return e ? mphOn(s, e) : TUNING.baseMph * regionOf(s).terrain * wagonSpeedFactor(s);
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
  return regionOf(s).haze * hazeMult(s) * DIFFICULTY[s.difficulty].haze;
}

/** Catch-up pressure: the Haze quickens when the wagons pull far ahead. */
export function catchupMiles(s: GameState): number {
  return Math.max(0, s.gap - TUNING.catchupGap) * TUNING.catchupRate;
}

/** What the Haze is expected to cover today, before noise and surges. This is what the party can see. */
export function expectedHazeMiles(s: GameState): number {
  return baseHazeMiles(s) + catchupMiles(s);
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

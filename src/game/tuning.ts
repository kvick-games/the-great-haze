// Every balance knob lives here. The simulate tool (tools/simulate.ts) exists to
// check these against the design pillar: resources are always tight, stopping
// always costs you, and neither reflexive kindness nor reflexive suspicion wins.

import type { PaceId, RationId, HazeZone, ResourceId, Difficulty } from "./types.ts";

export const TUNING = {
  totalMiles: 840,
  startGap: 58,
  baseMph: 1.75,
  startScrip: 600,
  startWagons: 3,
  cargoPerWagon: 110,
  maxParty: 8,
  /** Hours a resupply stop takes out of the next travel day. */
  storeHours: 3,
  /** Hours of daylight-equivalent lost per carried hour cap. */
  maxCarryHours: 6,
  disputeBase: 0.07,
  hazeNoise: 0.12,
  /** Past this gap the Haze quickens to close the distance, so a cushion can never grow comfortable. */
  catchupGap: 62,
  catchupRate: 0.4,
  surgeChance: 0.08,
  lullChance: 0.06,
  surgeMiles: 8,
  lullMiles: 5,
  /** Gap under which torches must burn at night. */
  torchGap: 32,
  lowNerve: 30,
  breakingNerve: 10,
  grief: 7,
} as const;

export const DIFFICULTY: Record<Difficulty, { name: string; haze: number; gap: number; scrip: number; blurb: string }> = {
  normal: {
    name: "Exodus",
    haze: 1,
    gap: 0,
    scrip: 0,
    blurb: "Scarcity, cruelty, and a narrow way through.",
  },
  dire: {
    name: "Ash Reckoning",
    haze: 1.06,
    gap: -6,
    scrip: -60,
    blurb: "The Haze is faster and the Company has already picked you clean.",
  },
};

export interface PaceDef {
  id: PaceId;
  name: string;
  hours: number;
  nerve: number;
  health: number;
  wear: number;
  encounter: number;
  blurb: string;
}

export const PACES: Record<PaceId, PaceDef> = {
  easy: {
    id: "easy",
    name: "Easy",
    hours: 8,
    nerve: 1,
    health: 1,
    wear: 0.6,
    encounter: -0.05,
    blurb: "8 hours on the road. Everyone breathes. The Haze does not.",
  },
  steady: {
    id: "steady",
    name: "Steady",
    hours: 10,
    nerve: 0,
    health: 0,
    wear: 1,
    encounter: 0,
    blurb: "10 hours on the road. What the oxen were built for.",
  },
  hard: {
    id: "hard",
    name: "Forced march",
    hours: 14,
    nerve: -3,
    health: -1,
    wear: 2,
    encounter: 0.06,
    blurb: "14 hours on the road. Bodies and axles pay for it.",
  },
  halt: {
    id: "halt",
    name: "Halt",
    hours: 0,
    nerve: 5,
    health: 6,
    wear: 0,
    encounter: -0.2,
    blurb: "No travel. The Haze gains a full day on you.",
  },
};

export interface RationDef {
  id: RationId;
  name: string;
  perHead: number;
  nerve: number;
  health: number;
  blurb: string;
}

export const RATIONS: Record<RationId, RationDef> = {
  full: { id: "full", name: "Full", perHead: 1, nerve: 1, health: 1, blurb: "A proper meal. Costs 1 ration a head." },
  meager: { id: "meager", name: "Meager", perHead: 0.7, nerve: 0, health: 0, blurb: "Watered stew. Costs 0.7 a head." },
  bare: { id: "bare", name: "Bare", perHead: 0.4, nerve: -2, health: -2, blurb: "A heel of bread. Costs 0.4 a head; people fray." },
};

export function zoneOf(gap: number): HazeZone {
  if (gap >= 45) return "far";
  if (gap >= 25) return "near";
  if (gap >= 10) return "close";
  return "upon";
}

export interface ItemDef {
  id: ResourceId;
  name: string;
  blurb: string;
  /** Base price at the first market. */
  price: number;
  weight: number;
  start: number;
}

export const ITEMS: Record<ResourceId, ItemDef> = {
  rations: {
    id: "rations",
    name: "Rations",
    blurb: "Hardtack, salt pork, dried beans. One person, one meal.",
    price: 2,
    weight: 1,
    start: 0,
  },
  torches: {
    id: "torches",
    name: "Pitch torches",
    blurb: "The ring of fire around camp. The dark things stay outside it.",
    price: 6,
    weight: 1.5,
    start: 0,
  },
  ammo: {
    id: "ammo",
    name: "Powder & shot",
    blurb: "One charge, one shot. Hunting and fighting both draw from it.",
    price: 2,
    weight: 0.5,
    start: 0,
  },
  medicine: {
    id: "medicine",
    name: "Physic",
    blurb: "Laudanum, lint, carbolic. Stops a wound killing someone tonight.",
    price: 12,
    weight: 1,
    start: 0,
  },
  spares: {
    id: "spares",
    name: "Spare parts",
    blurb: "Wheels, axles, wagon tongues. A broken wagon is a dead wagon.",
    price: 20,
    weight: 6,
    start: 0,
  },
  veils: {
    id: "veils",
    name: "Haze veils",
    blurb: "Oiled linen soaked in vinegar. Slows what the Haze does to lungs.",
    price: 10,
    weight: 1,
    start: 0,
  },
  rockets: {
    id: "rockets",
    name: "Signal rockets",
    blurb: "Company blue-light rockets. Bright enough to make the dark flinch.",
    price: 16,
    weight: 1,
    start: 0,
  },
};

export interface StoreDef {
  id: string;
  name: string;
  keeper: string;
  /** Price multiplier. */
  markup: number;
  /** Max units of each item on offer (Infinity-ish at the first market). */
  stock: Record<ResourceId, number>;
  /** Fraction of price paid when the train sells goods back. */
  buyback: number;
  /** A crooked keeper delivers only this fraction of rations and physic until the scales are checked. */
  rigged?: number;
  /** The fair-play hint that something is off. */
  tell?: string;
}

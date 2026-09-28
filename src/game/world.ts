// The road: regions, landmarks, and the sky. Names here are provisional and
// meant to be swapped as the art direction firms up.

import type { RegionId, ResourceId } from "./types.ts";
import type { StoreDef } from "./tuning.ts";

export interface RegionDef {
  id: RegionId;
  name: string;
  start: number;
  end: number;
  /** Miles the Haze advances per day over this ground. */
  haze: number;
  /** Multiplier on wagon speed. */
  terrain: number;
  encounter: number;
  /** How much the land gives a forager. */
  forage: number;
  blurb: string;
  /** Sky descriptions per zone: far, near, close, upon. */
  sky: [string, string, string, string];
}

export const REGIONS: RegionDef[] = [
  {
    id: "tallow",
    name: "The Tallow Fields",
    start: 0,
    end: 130,
    haze: 10.3,
    terrain: 1.0,
    encounter: 0.6,
    forage: 1,
    blurb: "Abandoned farms in flat wheat. The scarecrows all face east.",
    sky: [
      "Stars overhead, clean and cold. Only a few red stains, far off, like spilled wine on dark cloth.",
      "The stains have spread across the east. The stars there are gone.",
      "A red smoke stands on the horizon behind you. The moon has turned the color of a wound.",
      "The sky behind you is closed. Red fog rolls between the wheat, waist deep.",
    ],
  },
  {
    id: "fen",
    name: "The Sallow Fen",
    start: 130,
    end: 250,
    haze: 11.3,
    terrain: 0.9,
    encounter: 0.62,
    forage: 0.8,
    blurb: "Black water and drowned fences. The road is a causeway of rotting planks.",
    sky: [
      "Cold stars over black water. Somewhere a bell rings, slowly, with nobody to ring it.",
      "Red clouds bleed slowly along the tree line. Frogs have stopped calling.",
      "Red smoke coils above the reeds. The water reflects a sky that is not quite the one above.",
      "Fog the color of rust lies on the fen. It moves against the wind.",
    ],
  },
  {
    id: "flats",
    name: "The Glass Flats",
    start: 250,
    end: 400,
    haze: 12.3,
    terrain: 1.1,
    encounter: 0.55,
    forage: 0.35,
    blurb: "A dry salt lakebed, flat to the edge of the world. Nothing to hide behind.",
    sky: [
      "A vast bowl of stars. The salt glows blue. Behind you, a distant smear of red.",
      "The red rises like a second dawn in the east that will not finish.",
      "You can see the Haze wall from here, a red cliff across the whole horizon.",
      "The wall is upon you. The salt turns pink as the fog washes across it.",
    ],
  },
  {
    id: "pines",
    name: "The Drowned Pines",
    start: 400,
    end: 560,
    haze: 13.5,
    terrain: 0.95,
    encounter: 0.66,
    forage: 1.2,
    blurb: "Old forest, waterlogged and silent. Things watch from between the trunks.",
    sky: [
      "Black branches against a starry gap. Red drips through the canopy like sap.",
      "The crimson creeps through the pines. Every trunk on the east side has gone dark and wet.",
      "The trees ahead are still. The trees behind you are... waving.",
      "The forest behind you has vanished into red. You hear it coming.",
    ],
  },
  {
    id: "spine",
    name: "The Spine",
    start: 560,
    end: 720,
    haze: 8.8,
    terrain: 0.75,
    encounter: 0.6,
    forage: 0.55,
    blurb: "Switchbacks and scree. The Haze thins over stone. The road, and everyone on it, does not.",
    sky: [
      "The peaks cut a blue-black sky. For the first time in months you can see the Milky Way.",
      "Red pools in the valleys like water. The peaks stand above it like islands.",
      "Fog fills the pass below you. It climbs slowly, patiently.",
      "The mountains are drowning. You are on the last dry rock.",
    ],
  },
  {
    id: "threshold",
    name: "The Threshold",
    start: 720,
    end: 840,
    haze: 14.5,
    terrain: 1.0,
    encounter: 0.55,
    forage: 1,
    blurb: "High grass and cold rivers. The far sky ahead is, impossibly, a clean and fragile blue.",
    sky: [
      "Ahead, at the very edge of the world, a band of blue. Behind you, stars and stains.",
      "The blue grows. The red behind you howls.",
      "The blue is close enough to touch. The Haze is close enough to touch, too.",
      "The last stretch. The fog is at your heels and the blue is a wall ahead of you.",
    ],
  },
];

export function regionAt(miles: number): RegionDef {
  for (const r of REGIONS) if (miles < r.end) return r;
  return REGIONS[REGIONS.length - 1];
}

export interface LandmarkDef {
  id: string;
  mile: number;
  name: string;
  blurb: string;
  storeId?: string;
  /** Scene that fires when the train leaves the landmark. */
  scene?: string;
}

export const LANDMARKS: LandmarkDef[] = [
  {
    id: "ninefold-bridge",
    mile: 128,
    name: "Ninefold Bridge",
    blurb: "Nine stone arches over a brown river. Most of one is missing.",
    scene: "ninefold-crossing",
  },
  {
    id: "meridian-wayhouse",
    mile: 250,
    name: "Meridian Wayhouse",
    blurb: "A Company waystation at the edge of the Flats, lit windows and a well-fed man on the porch.",
    storeId: "wayhouse",
  },
  {
    id: "glass-fork",
    mile: 380,
    name: "The Fork at Glass Cross",
    blurb: "Two roads part in the salt. One goes around the old woods. One goes through them.",
    scene: "glass-fork",
  },
  {
    id: "saint-ambrose",
    mile: 500,
    name: "Mission of Saint Ambrose",
    blurb: "A whitewashed mission with a bell tower. A single light burns in the window.",
    scene: "saint-ambrose",
  },
  {
    id: "spine-toll",
    mile: 590,
    name: "The Toll Gate",
    blurb: "A chain across the pass, a hut, and men who have been waiting a long time for someone like you.",
    scene: "toll-gate",
  },
  {
    id: "last-lamp",
    mile: 715,
    name: "Last Lamp",
    blurb: "The final trading post before the Reach. Every lantern here is lit, and every price is a hostage.",
    storeId: "last-lamp",
  },
  {
    id: "the-gate",
    mile: 840,
    name: "The Blue Reach",
    blurb: "A wall of white stone. Above it, a sky that is still blue.",
    scene: "the-gate",
  },
];

export const STORES: Record<string, StoreDef> = {
  "cinder-ford": {
    id: "cinder-ford",
    name: "Cinder Ford Emporium",
    keeper: "Old Man Prewitt",
    markup: 1,
    stock: { rations: 999, torches: 999, ammo: 999, medicine: 30, spares: 10, veils: 20, rockets: 10 },
    buyback: 1,
  },
  wayhouse: {
    id: "wayhouse",
    name: "Meridian Wayhouse Commissary",
    keeper: "Mr. Halloran, Company factor",
    markup: 1.35,
    stock: { rations: 60, torches: 20, ammo: 40, medicine: 6, spares: 4, veils: 8, rockets: 4 },
    buyback: 0.35,
  },
  "last-lamp": {
    id: "last-lamp",
    name: "Last Lamp Trading Post",
    keeper: "Widow Sorrel",
    markup: 2.1,
    stock: { rations: 35, torches: 14, ammo: 20, medicine: 4, spares: 2, veils: 6, rockets: 3 },
    buyback: 0.25,
  },
};

export const STORE_RESOURCES: ResourceId[] = ["rations", "torches", "ammo", "medicine", "spares", "veils", "rockets"];

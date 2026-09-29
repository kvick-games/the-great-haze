import type { Effect } from "../types.ts";

export type EnemyTag = "human" | "hollowed" | "beast" | "witch";

export interface EnemyDef {
  id: string;
  name: string;
  tags: EnemyTag[];
  /** Base Threat (hit points), scaled by how far along the road you are. */
  hp: number;
  hits: number;
  atk: [number, number];
  lightWeak: boolean;
  /** Will break off if badly hurt. */
  canFlee: boolean;
  tribute?: { scrip?: number; rations?: number };
  parleyOdds?: number;
  /** Chance a hit also exposes the target to the Haze. */
  fogTouch?: number;
  intro: string;
  win: string;
  fled: string;
  loot?: Effect[];
  /** Her voice finds a member each round: they lose nerve, and may come away hexed. */
  hex?: { chance: number; nerve: [number, number]; mark: number };
  /** While captives are held she turns one on the party each round: `chance`, then a blow of `dmg`. */
  puppets?: { chance: number; dmg: [number, number] };
  /** While captives are held she keeps them in front of the shots: this share of the party's damage is undone. */
  shield?: number;
  /** A flag that, once set, makes the fight easier: her strength is multiplied. */
  weakenedBy?: { flag: string; mult: number };
}

export const ENEMIES: Record<string, EnemyDef> = {
  raiders: {
    id: "raiders",
    name: "Raiders",
    tags: ["human"],
    hp: 26,
    hits: 2,
    atk: [4, 8],
    lightWeak: false,
    canFlee: true,
    tribute: { scrip: 60 },
    parleyOdds: 0.5,
    intro: "Riders spread out on both sides of the road. Somebody racks a hammer back.",
    win: "The last of them goes down in the dust. The rest scatter.",
    fled: "They break and run, dragging their wounded.",
    loot: [
      { t: "scrip", d: [30, 90] },
      { t: "res", res: "ammo", d: [3, 8] },
      { t: "res", res: "rations", d: [4, 10] },
    ],
  },
  "toll-thugs": {
    id: "toll-thugs",
    name: "Toll thugs",
    tags: ["human"],
    hp: 20,
    hits: 2,
    atk: [3, 7],
    lightWeak: false,
    canFlee: true,
    tribute: { scrip: 40 },
    parleyOdds: 0.75,
    intro: "Men with clubs and a Company armband they clearly did not earn step out of the treeline.",
    win: "The chain, and the men holding it, are on the ground. The pass is yours.",
    fled: "The thugs drop their clubs and vanish into the rocks.",
    loot: [
      { t: "scrip", d: [20, 60] },
      { t: "res", res: "rations", d: [2, 6] },
    ],
  },
  mob: {
    id: "mob",
    name: "Starving mob",
    tags: ["human"],
    hp: 18,
    hits: 2,
    atk: [2, 5],
    lightWeak: false,
    canFlee: true,
    tribute: { rations: 12 },
    parleyOdds: 0.8,
    intro: "They come out of the ruins all at once, thin as fence posts, hands out. Then hands closing.",
    win: "They fall back, sobbing. You are left with what you took from starving people.",
    fled: "They melt back into the ruins as quickly as they came.",
    loot: [{ t: "res", res: "rations", d: [1, 4] }],
  },
  "hollowed-pack": {
    id: "hollowed-pack",
    name: "The Hollowed",
    tags: ["hollowed"],
    hp: 34,
    hits: 2,
    atk: [4, 8],
    lightWeak: true,
    canFlee: false,
    fogTouch: 0.35,
    intro: "They walk out of the fog together. Their eyes are open. Their faces are patient. They call the oxen by name.",
    win: "The last one goes down and does not get up. For a long moment none of you can look at the others.",
    fled: "They stop, all at once, and turn back toward the Haze as if called.",
  },
  "hollowed-single": {
    id: "hollowed-single",
    name: "A Hollowed",
    tags: ["hollowed"],
    hp: 14,
    hits: 1,
    atk: [5, 9],
    lightWeak: true,
    canFlee: false,
    fogTouch: 0.4,
    intro: "It was a man once. It runs at you with terrible, effortless economy.",
    win: "It falls. Its face, now, is just a face.",
    fled: "It stops, and looks at the Haze, and goes.",
  },
  "haze-hounds": {
    id: "haze-hounds",
    name: "Haze hounds",
    tags: ["beast"],
    hp: 22,
    hits: 2,
    atk: [3, 7],
    lightWeak: true,
    canFlee: true,
    fogTouch: 0.1,
    intro: "The dogs of some abandoned farm, running in a pack. Their coats are wet with red, and they do not bark.",
    win: "They lie where they fell, thin and strange. You bury none of them.",
    fled: "The pack peels off, yelping, back toward the fog.",
    loot: [{ t: "res", res: "rations", d: [3, 6] }],
  },
  "long-man": {
    id: "long-man",
    name: "The Long Man",
    tags: ["hollowed"],
    hp: 55,
    hits: 1,
    atk: [10, 16],
    lightWeak: true,
    canFlee: false,
    fogTouch: 0.8,
    intro:
      "Something tall stands at the edge of the torchlight. It was a man, once, and a very tall man at that. The Haze has kept stretching him.",
    win: "It folds to the ground in sections. The fog closes over where it fell, and does not come further this night.",
    fled: "It draws back into the dark, unhurried, and you know that is not the last time you will see it.",
  },
  witch: {
    id: "witch",
    name: "The witch",
    tags: ["witch"],
    hp: 38,
    hits: 1,
    atk: [6, 10],
    lightWeak: true,
    canFlee: false,
    hex: { chance: 0.7, nerve: [2, 5], mark: 0.1 },
    puppets: { chance: 0.4, dmg: [3, 6] },
    shield: 0.3,
    weakenedBy: { flag: "witch:weakened", mult: 0.7 },
    intro: "She stands in the road with the ones she took on either side of her, hands held loosely, eyes open. She smiles at you.",
    win: "She folds up like wet paper. The fog lets go of the ones she held, and they breathe.",
    fled: "She steps back into the fog with her hands on their shoulders, and the fog closes like a door.",
    loot: [
      { t: "res", res: "rations", d: [8, 16] },
      { t: "res", res: "medicine", d: [1, 2] },
      { t: "restore", changed: 0.15 },
      { t: "scene", id: "witch-freed" },
    ],
  },
  "the-turned": {
    id: "the-turned",
    name: "The Turned",
    tags: ["hollowed"],
    hp: 22,
    hits: 1,
    atk: [6, 10],
    lightWeak: true,
    canFlee: false,
    fogTouch: 0.6,
    intro: "It stands up from the bedroll with the shape of someone you know. The eyes are the wrong color, and very calm.",
    win: "It is over. It is not over in your head.",
    fled: "It walks out of camp, stiffly, into the fog, and does not look back.",
  },
};

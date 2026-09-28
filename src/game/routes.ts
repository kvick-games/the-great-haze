// The true shape of the road from Cinder Ford to the Blue Reach: nodes, roads,
// and the maps for sale along it. Nothing here is what the player necessarily
// believes; see map.ts for beliefs.
//
// The main road sums to exactly 840 miles. Every fork offers roads within a few
// dozen miles of each other, so any route lands near that.

import type { Accuracy, EdgeDef, NodeDef } from "./map-types.ts";

export const NODES: NodeDef[] = [
  { id: "cinder-ford", name: "Cinder Ford", kind: "start", x: 0.05, y: 0.78, region: "tallow", storeId: "cinder-ford", blurb: "The last town the Haze has not reached." },
  {
    id: "drovers-rest",
    name: "Drovers' Rest",
    kind: "outpost",
    x: 0.13,
    y: 0.7,
    region: "tallow",
    storeId: "drovers-rest",
    blurb: "A cattle pen, a well, and a lean-to shop. The drovers left. The shopkeeper stayed.",
  },
  {
    id: "crows-parting",
    name: "Crow's Parting",
    kind: "fork",
    x: 0.22,
    y: 0.62,
    region: "tallow",
    blurb: "Three ways leave this crossroads. The scarecrows here stand in a ring, all facing the one you cannot see.",
  },
  {
    id: "ninefold-bridge",
    name: "Ninefold Bridge",
    kind: "landmark",
    x: 0.37,
    y: 0.58,
    region: "tallow",
    scene: "ninefold-crossing",
    blurb: "Nine stone arches over a brown river. Most of one is missing.",
  },
  {
    id: "sallow-landing",
    name: "Sallow Landing",
    kind: "outpost",
    x: 0.44,
    y: 0.66,
    region: "fen",
    storeId: "sallow-landing",
    blurb: "Stilt-houses over black water. A woman with a lantern is selling things off a raft.",
  },
  {
    id: "black-water",
    name: "The Black Water Split",
    kind: "fork",
    x: 0.5,
    y: 0.72,
    region: "fen",
    blurb: "The causeway forks over the water. One arm is planks. The other has bells hung along it, ringing on no wind.",
  },
  {
    id: "meridian-wayhouse",
    name: "Meridian Wayhouse",
    kind: "outpost",
    x: 0.6,
    y: 0.66,
    region: "flats",
    storeId: "wayhouse",
    blurb: "A Company waystation at the edge of the Flats, lit windows and a well-fed man on the porch.",
  },
  {
    id: "halfway-cairn",
    name: "The Halfway Cairn",
    kind: "landmark",
    x: 0.66,
    y: 0.55,
    region: "flats",
    blurb: "A cairn as high as a wagon, every stone chalked with a name. Some of the chalk is still wet.",
  },
  {
    id: "glass-cross",
    name: "The Fork at Glass Cross",
    kind: "fork",
    x: 0.72,
    y: 0.46,
    region: "flats",
    blurb: "Roads part in the salt. A weathered sign points three ways and has been crossed out by a knife.",
  },
  {
    id: "saint-ambrose",
    name: "Mission of Saint Ambrose",
    kind: "landmark",
    x: 0.8,
    y: 0.36,
    region: "pines",
    scene: "saint-ambrose",
    blurb: "A whitewashed mission with a bell tower. A single light burns in the window.",
  },
  {
    id: "spine-foot",
    name: "The Foot of the Spine",
    kind: "fork",
    x: 0.85,
    y: 0.3,
    region: "spine",
    blurb: "The mountains stand up out of the pines like a wall. Two ways climb them, and only one of them has a chain across it.",
  },
  {
    id: "last-lamp",
    name: "Last Lamp",
    kind: "outpost",
    x: 0.92,
    y: 0.2,
    region: "spine",
    storeId: "last-lamp",
    blurb: "The final trading post before the Reach. Every lantern here is lit, and every price is a hostage.",
  },
  {
    id: "the-gate",
    name: "The Blue Reach",
    kind: "end",
    x: 0.97,
    y: 0.09,
    region: "threshold",
    scene: "the-gate",
    blurb: "A wall of white stone. Above it, a sky that is still blue.",
  },
];

export const EDGES: EdgeDef[] = [
  { id: "e-ford-road", from: "cinder-ford", to: "drovers-rest", name: "The Ford Road", terrain: "tallow", miles: 45, danger: 1, main: true },
  { id: "e-tallow-pike", from: "drovers-rest", to: "crows-parting", name: "The Tallow Pike", terrain: "tallow", miles: 35, danger: 1, main: true },

  // --- Fork 1: Crow's Parting ------------------------------------------------
  {
    id: "f1-company-road",
    from: "crows-parting",
    to: "ninefold-bridge",
    name: "The Company Road",
    terrain: "tallow",
    miles: 48,
    danger: 1,
    main: true,
    sign: "A tin sign, MERIDIAN CO. ROAD, riddled with shot. The ruts are deep, old and empty.",
    words: {
      truth: "Metalled road. Slow, dull, safe.",
      grim: "Company pickets. Expect trouble and a toll.",
    },
  },
  {
    id: "f1-drovers-cut",
    from: "crows-parting",
    to: "ninefold-bridge",
    name: "The Drovers' Cut",
    terrain: "tallow",
    miles: 42,
    danger: 2,
    speed: 1.1,
    via: [[0.29, 0.5]],
    sign: "A painted board: DROVERS ONLY. Many tracks lead in. You look for the ones that lead out.",
    beats: [
      {
        at: 0.5,
        scene: "route-harrow",
        twist: { kind: "burned", clear: "Harrow's End: a market village with a well", truth: "Harrow's End is burned to the ground" },
      },
    ],
    words: {
      truth: "Harrow's End is a burned ruin. Ash, and things that come for ash.",
      rosy: "Quick cut through Harrow's End: a market, a well, a bed.",
    },
  },
  {
    id: "f1-river-track",
    from: "crows-parting",
    to: "ninefold-bridge",
    name: "The River Track",
    terrain: "tallow",
    miles: 56,
    danger: 1,
    speed: 0.92,
    hazeMult: 0.9,
    forage: 1.5,
    via: [[0.3, 0.72]],
    sign: "Reeds, a rope between two posts, and a brass bell on it waiting for a hand.",
    beats: [{ at: 0.5, scene: "route-ferry" }],
    words: {
      truth: "A ferryman at the bend wants scrip. Fish in the shallows, and the Haze is slow over water.",
    },
  },

  { id: "e-ninefold-landing", from: "ninefold-bridge", to: "sallow-landing", name: "The Drowned Fence Road", terrain: "fen", miles: 37, danger: 1, main: true },
  { id: "e-fen-road", from: "sallow-landing", to: "black-water", name: "The Reed Road", terrain: "fen", miles: 35, danger: 1, main: true },

  // --- Fork 2: The Black Water Split --------------------------------------------
  {
    id: "f2-causeway",
    from: "black-water",
    to: "meridian-wayhouse",
    name: "The Causeway",
    terrain: "fen",
    miles: 50,
    danger: 1,
    wear: 1.5,
    main: true,
    sign: "Planks, black with wet, laid end to end. Some are new. Someone keeps mending it.",
    words: {
      truth: "Rotting planks, but someone mends them. Hard on axles.",
      grim: "Half the planks are gone. Wagons have been lost.",
    },
  },
  {
    id: "f2-bell-road",
    from: "black-water",
    to: "meridian-wayhouse",
    name: "The Bell Road",
    terrain: "fen",
    miles: 58,
    danger: 2,
    hazeMult: 0.85,
    forage: 1.3,
    via: [[0.55, 0.8]],
    sign: "Bells on posts, all the way to the fog. None of them are moving, and they ring.",
    beats: [
      {
        at: 0.6,
        scene: "route-drowned-bridge",
        twist: { kind: "bridge-out", clear: "A stone bridge, sound, marked with bells", truth: "The Drowned Bridge is down" },
      },
    ],
    words: {
      truth: "The Drowned Bridge is out. Ford it or go round. Good hunting.",
      rosy: "Stone bridge, sound. Bells mark the way. Easy going.",
    },
  },

  { id: "e-flats-road", from: "meridian-wayhouse", to: "halfway-cairn", name: "The Salt Road", terrain: "flats", miles: 70, danger: 1, main: true },
  { id: "e-cairn-road", from: "halfway-cairn", to: "glass-cross", name: "The Cairn Road", terrain: "flats", miles: 60, danger: 1, main: true },

  // --- Fork 3: Glass Cross -----------------------------------------------------
  {
    id: "f3-pilgrim-road",
    from: "glass-cross",
    to: "saint-ambrose",
    name: "The Pilgrim Road",
    terrain: "pines",
    miles: 120,
    danger: 1,
    cache: [5, 12],
    main: true,
    sign: "Cairns, one every mile, going away up the slope. Some hold bread.",
    words: {
      truth: "Long, dry and safe. The pilgrim cairns often hold food.",
      grim: "Bandits work the cairns. Long, and not safe.",
    },
  },
  {
    id: "f3-rail-line",
    from: "glass-cross",
    to: "saint-ambrose",
    name: "The Old Rail Line",
    terrain: "flats",
    miles: 95,
    danger: 3,
    speed: 1.3,
    via: [[0.75, 0.32]],
    sign: "A flat railbed, dead straight. Rust-red rails run into a hill. Something has dragged things off it.",
    beats: [
      {
        at: 0.65,
        scene: "route-tunnel",
        twist: { kind: "dead-end", clear: "Flat, fast and clear the whole way", truth: "Tunnel Three has come down" },
      },
    ],
    words: {
      truth: "Fast, but Tunnel Three has come down and something nests in it.",
      rosy: "Flat, fast and clear. Saves a day and a half.",
    },
  },
  {
    id: "f3-salt-track",
    from: "glass-cross",
    to: "saint-ambrose",
    name: "The Salt Track",
    terrain: "flats",
    miles: 105,
    danger: 2,
    speed: 1.05,
    wear: 0.7,
    forage: 0.3,
    via: [[0.8, 0.5]],
    sign: "White ground, bones of oxen, and a line of stakes into the glare.",
    words: {
      truth: "No water, no cover, no food. Easy on the axles.",
      rosy: "A clean, quick track. Some wells.",
    },
  },

  { id: "e-ambrose-foot", from: "saint-ambrose", to: "spine-foot", name: "The Pine Steps", terrain: "pines", miles: 60, danger: 1, main: true },

  // --- Fork 4: the Foot of the Spine -------------------------------------------
  {
    id: "f4-toll-road",
    from: "spine-foot",
    to: "last-lamp",
    name: "The Toll Road",
    terrain: "spine",
    miles: 155,
    danger: 1,
    main: true,
    sign: "A graded road, and at the first bend a chain gleaming across it.",
    beats: [{ at: 0.2, scene: "toll-gate" }],
    words: {
      truth: "Graded road, held by men with a chain. Pay or fight.",
      grim: "Impassable in the wet. The chain-men shoot.",
    },
  },
  {
    id: "f4-goat-track",
    from: "spine-foot",
    to: "last-lamp",
    name: "The Goat Track",
    terrain: "spine",
    miles: 145,
    danger: 2,
    speed: 0.8,
    hazeMult: 0.6,
    wear: 1.5,
    via: [[0.9, 0.34]],
    sign: "A scratch in the scree. No wheels have used it lately. The mountain looks bare and unbothered.",
    words: {
      truth: "Slow and steep. The Haze thins over bare rock.",
      rosy: "A short, clean pass. No chain, no toll.",
    },
  },

  { id: "e-last-stretch", from: "last-lamp", to: "the-gate", name: "The Threshold Road", terrain: "threshold", miles: 125, danger: 1, main: true },
];

export const NODE_BY_ID = new Map(NODES.map((n) => [n.id, n]));
export const EDGE_BY_ID = new Map(EDGES.map((e) => [e.id, e]));
/** Position of each node along the main road, in node order. */
export const NODE_ORDER = new Map(NODES.map((n, i) => [n.id, i]));

export function outEdges(nodeId: string): EdgeDef[] {
  return EDGES.filter((e) => e.from === nodeId);
}

/** Order of an edge: the order of the node it leaves. */
export function edgeOrder(e: EdgeDef): number {
  return NODE_ORDER.get(e.from) ?? 0;
}

/** The main road's length: exactly the nominal 840. */
export function mainLength(): number {
  return EDGES.filter((e) => e.main).reduce((n, e) => n + e.miles, 0);
}

// ---------------------------------------------------------------------------
// Maps for sale
// ---------------------------------------------------------------------------

export interface MapOfferDef {
  id: string;
  name: string;
  seller: string;
  /** Store the map is sold at. */
  storeId: string;
  /** Node it covers from. */
  fromNode: string;
  /** What a faithful copy costs; worse copies are cheaper. */
  price: number;
  pitch: string;
  weights: Record<Accuracy, number>;
  /** The seller's tells. Two are drawn: usually from the true pool, sometimes from any. */
  tells: Record<Accuracy, string[]>;
}

const COMMON_TELLS: Record<Accuracy, string[]> = {
  faithful: [
    "The paper is thumbed soft, inked over where the road changed.",
    "Corrections in three hands, each one dated.",
    "The seller says what is uncertain before you ask.",
    "Nobody has to sell it to you. There is a waiting list of one.",
  ],
  careless: [
    "Whole valleys are blank, and someone has written 'somewhere here' in the gap.",
    "Half the ink is a different colour. The rivers do not join up.",
    "The seller will not say where it came from, or from whom.",
    "The lettering wobbles. It was copied from a copy.",
  ],
  misleading: [
    "The paper is crisp, clean and unfolded, as if it has never been carried anywhere.",
    "The seller asks which road you mean to take before he mentions the price.",
    "He is very glad you came. He is a little too glad.",
    "Only one road on it has any detail, and it is the one he keeps tapping.",
  ],
};

export const MAP_OFFERS: MapOfferDef[] = [
  {
    id: "survey-old",
    name: "An old Company survey",
    seller: "Old Man Prewitt",
    storeId: "cinder-ford",
    fromNode: "cinder-ford",
    price: 24,
    pitch: "Prewitt unrolls a Company survey sheet of the whole road, stamped and dated.",
    weights: { faithful: 0.35, careless: 0.55, misleading: 0.1 },
    tells: {
      faithful: ["The stamp is from last spring, and there are marginal notes in a surveyor's hand.", ...COMMON_TELLS.faithful],
      careless: ["The date in the corner is nine winters old.", ...COMMON_TELLS.careless],
      misleading: ["The stamp looks wet. The date does not fit the paper.", ...COMMON_TELLS.misleading],
    },
  },
  {
    id: "drover-sketch",
    name: "Tam's drover sketch",
    seller: "the drover Tam",
    storeId: "drovers-rest",
    fromNode: "drovers-rest",
    price: 38,
    pitch: "Tam sketched it in charcoal from the saddle, every road east.",
    weights: { faithful: 0.35, careless: 0.3, misleading: 0.35 },
    tells: {
      faithful: ["Tam's hands are scarred with rope work. He touches the map like a wound.", ...COMMON_TELLS.faithful],
      careless: ["Tam sold cattle, not maps. He waves a hand at the Fen and says 'boggy, I hear.'", ...COMMON_TELLS.careless],
      misleading: ["Tam looks at your wagons, not your face, while he talks.", ...COMMON_TELLS.misleading],
    },
  },
  {
    id: "ferry-chart",
    name: "The Landing woman's chart",
    seller: "the woman on the raft",
    storeId: "sallow-landing",
    fromNode: "sallow-landing",
    price: 44,
    pitch: "She keeps the chart in oilcloth against the wet. It shows the causeways and what lies past them.",
    weights: { faithful: 0.4, careless: 0.25, misleading: 0.35 },
    tells: {
      faithful: ["She has drawn the drowned things, too, in the margin, with names.", ...COMMON_TELLS.faithful],
      careless: ["She squints at it like it is somebody else's handwriting.", ...COMMON_TELLS.careless],
      misleading: ["The chart is dry. Everything else on the raft is wet.", ...COMMON_TELLS.misleading],
    },
  },
  {
    id: "factor-chart",
    name: "The factor's chart",
    seller: "Mr. Halloran",
    storeId: "wayhouse",
    fromNode: "meridian-wayhouse",
    price: 52,
    pitch: "Halloran's Company chart of the Flats and the Spine, folded once, and never carried out of the office.",
    weights: { faithful: 0.35, careless: 0.25, misleading: 0.4 },
    tells: {
      faithful: ["The chart is in the Company's own cartographers' hand, and it has been redrawn twice.", ...COMMON_TELLS.faithful],
      careless: ["Half the chart is a Company survey and half is a guess in pencil.", ...COMMON_TELLS.careless],
      misleading: ["Halloran keeps a thumb on the Toll Road and a finger off the rest.", ...COMMON_TELLS.misleading],
    },
  },
];

export const OFFER_BY_ID = new Map(MAP_OFFERS.map((m) => [m.id, m]));

/** A phantom road a misleading map adds to a fork. */
export const PHANTOMS: { fork: string; to: string; id: string; name: string; miles: number; danger: number; note: string; via: [number, number][] }[] = [
  {
    fork: "crows-parting",
    to: "ninefold-bridge",
    id: "ph-merchants-bypass",
    name: "The Merchants' Bypass",
    miles: 34,
    danger: 1,
    note: "A dry, empty bypass. Saves a day.",
    via: [[0.29, 0.62]],
  },
  {
    fork: "glass-cross",
    to: "saint-ambrose",
    id: "ph-blue-line",
    name: "The Blue Line Spur",
    miles: 70,
    danger: 1,
    note: "A new spur off the rail. Fast, and the Company keeps it clear.",
    via: [[0.77, 0.41]],
  },
];

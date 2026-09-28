// Who looks like what. A look is plain data: build, age, hair, beard, coat
// colour, headwear and a list of props. Anything that can describe a person in
// those terms (a roster member, a companion met on the road, a stranger) maps
// onto it with resolveLook(), and figureFromLook() turns it into a body.
//
// Silhouette leads: builds, hats, hair, beards and one prop per role tell people
// apart at a distance in the dark; coat colours vary but are a secondary cue.

import type { Role, Trait } from "../../../src/game/types.ts";
import { Figure } from "./actors.ts";
import type { Age, BeardStyle, Build, Hat, HairStyle, Look, Prop } from "./actors.ts";

export type { Age, BeardStyle, Build, Hat, HairStyle, Look, Prop } from "./actors.ts";

export const ROLE_ACCENT: Record<Role, number> = {
  scout: 0x3f8a86,
  mechanic: 0x9a7430,
  medic: 0xcfc6b2,
  hunter: 0x55703a,
  guard: 0x6a7684,
  speaker: 0x7a4f7e,
};

/** What each role carries and wears whatever else about them varies. */
export const ROLE_PROPS: Record<Role, Prop[]> = {
  medic: ["satchel"],
  hunter: ["rifle"],
  mechanic: ["toolbelt", "apron"],
  scout: ["spyglass"],
  speaker: ["collar", "book", "lantern"],
  guard: ["bandolier"],
};

/** Headwear a role tends to wear when nothing else is said. */
const ROLE_HAT: Partial<Record<Role, Hat>> = { hunter: "furcap" };

/** A colour as a number (0xrrggbb), "#rrggbb", or one of the words in COLOR_WORDS. */
export type ColorLike = number | string;

export const COLOR_WORDS: Record<string, number> = {
  black: 0x131114,
  charcoal: 0x26262a,
  grey: 0x48484a,
  gray: 0x48484a,
  white: 0xcfcac0,
  cream: 0xb8b09a,
  brown: 0x4a3320,
  tan: 0x8a7050,
  ochre: 0x9a7430,
  ginger: 0x8a4a22,
  auburn: 0x5a2a1a,
  blond: 0xb0a070,
  blonde: 0xb0a070,
  red: 0x7a1a16,
  crimson: 0x6a1010,
  rust: 0x7a3a1c,
  green: 0x3a5230,
  olive: 0x3a4030,
  blue: 0x2a3a5a,
  navy: 0x1f2630,
  teal: 0x2a5a58,
  plum: 0x3a2a40,
  purple: 0x3a2848,
  yellow: 0x9a8430,
  pink: 0x8a5a60,
};

export function parseColor(c: ColorLike | undefined, fallback: number): number {
  if (c === undefined) return fallback;
  if (typeof c === "number") return c;
  const t = c.trim().toLowerCase();
  if (COLOR_WORDS[t] !== undefined) return COLOR_WORDS[t];
  const m = /^#?([0-9a-f]{6})$/.exec(t);
  if (m) return parseInt(m[1], 16);
  // "faded blue wool coat": take the last colour word found.
  let found: number | undefined;
  for (const w of t.split(/[^a-z]+/)) if (COLOR_WORDS[w] !== undefined) found = COLOR_WORDS[w];
  return found ?? fallback;
}

/**
 * The data-driven description of a person's look. Everything is optional: gaps are
 * filled deterministically from a seed (an id), so the same person always looks the same.
 */
export interface LookDescription {
  build?: Build;
  age?: Age;
  skin?: ColorLike;
  hair?: HairStyle | { style?: HairStyle; color?: ColorLike };
  beard?: BeardStyle | { style?: BeardStyle; color?: ColorLike };
  /** The colour of the main coat. */
  coat?: ColorLike;
  trousers?: ColorLike;
  /** Scarf or neckerchief colour; defaults to the role's colour. */
  accent?: ColorLike;
  longCoat?: boolean;
  headwear?: Hat;
  hatColor?: ColorLike;
  /** Extra props beyond the role's own. */
  props?: Prop[];
  /** Adds the role's signature props and colour. */
  role?: Role;
  hollow?: boolean;
  /** Thin, tired, ill-looking by nature (a "sickly" trait). */
  gaunt?: boolean;
}

export const SKINS = [0x6a4a3a, 0x4a3226, 0x8a6a55, 0x3a2820, 0x7a5a48, 0x5c4033];
const HAIR_COLORS = [0x0f0b09, 0x1c130e, 0x2a1c12, 0x4a3320, 0x6a4526, 0x8a4a22, 0xb0a070, 0x5a5a5c];
const COATS = [0x2b2620, 0x3a3530, 0x2a3036, 0x3a2a1a, 0x262b30, 0x2c2230, 0x3a2e22, 0x2a2e2a, 0x302418, 0x34302c, 0x1f2630, 0x2a2218, 0x3a2618, 0x2a3a34, 0x4a2a24];
const HAIR_STYLES: HairStyle[] = ["short", "short", "long", "bun", "braid", "wild", "short", "long"];
const BEARDS: BeardStyle[] = ["none", "none", "stubble", "short", "full", "goatee", "mustache", "long"];
const BUILDS: Build[] = ["normal", "normal", "broad", "slight", "normal", "broad", "slight"];
const AGES: Age[] = ["young", "adult", "adult", "middle", "middle", "old"];
const HATS: Hat[] = ["wide", "cap", "bonnet", "bare", "hood", "tall", "cap"];

export function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h;
}

/** A small deterministic stream of numbers in [0, 1) from a string. */
function stream(seed: string): () => number {
  let a = (hashString(seed) ^ 0x9e3779b9) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function greyed(color: number, amount: number): number {
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  const t = (v: number) => Math.round(v + (176 - v) * amount);
  return (t(r) << 16) | (t(g) << 8) | t(b);
}

/** Fill a description out into everything a Figure needs. Same seed, same person. */
export function resolveLook(desc: LookDescription, seed = ""): Look {
  const rnd = stream(seed || "anon");
  const pick = <T>(list: T[]): T => list[Math.floor(rnd() * list.length)];
  const role = desc.role;
  const age: Age = desc.age ?? (desc.build === "child" ? "child" : pick(AGES));
  const build: Build = desc.build ?? (age === "child" ? "child" : pick(BUILDS));
  const skin = parseColor(desc.skin, pick(SKINS));
  const coat = parseColor(desc.coat, pick(COATS));
  const hat: Hat = desc.headwear ?? (role && ROLE_HAT[role]) ?? pick(HATS);
  const hairObj = typeof desc.hair === "string" ? { style: desc.hair } : (desc.hair ?? {});
  const beardObj = typeof desc.beard === "string" ? { style: desc.beard } : (desc.beard ?? {});
  let hairColor = parseColor(hairObj.color, pick(HAIR_COLORS));
  if (age === "old") hairColor = greyed(hairColor, 0.75);
  else if (age === "middle" && rnd() < 0.5) hairColor = greyed(hairColor, 0.35);
  const hairStyle: HairStyle = hairObj.style ?? pick(HAIR_STYLES);
  // Beards are for adults; a child or a slight youth keeps a clean face unless told otherwise.
  const rollBeard = pick(BEARDS);
  const beardStyle: BeardStyle = beardObj.style ?? (age === "child" || age === "young" ? (rollBeard === "long" || rollBeard === "full" ? "stubble" : rollBeard) : rollBeard);
  const beardColor = parseColor(beardObj.color, hairColor);
  const props = [...(role ? ROLE_PROPS[role] : []), ...(desc.props ?? [])].filter((p, i, a) => a.indexOf(p) === i);
  const longCoat = desc.longCoat ?? (role === "scout" || rnd() < 0.25);
  return {
    hat,
    coat,
    trousers: parseColor(desc.trousers, 0x171411),
    accent: parseColor(desc.accent, role ? ROLE_ACCENT[role] : 0x5a4a3a),
    skin,
    build: desc.gaunt && build === "normal" ? "gaunt" : build,
    longCoat,
    hollow: desc.hollow,
    age,
    hair: { style: hairStyle, color: hairColor },
    beard: { style: beardStyle, color: beardColor },
    hatColor: desc.hatColor !== undefined ? parseColor(desc.hatColor, 0x0b0908) : undefined,
    props,
    seed: hashString(seed || "anon") & 0x7fffffff,
  };
}

/** Build a figure from a description. Other systems (NPC descriptions, video sheets) start here. */
export function figureFromLook(desc: LookDescription, seed = ""): Figure {
  return new Figure(resolveLook(desc, seed));
}

/** Authored looks for the named roster. Anyone not listed is generated from their id. */
const PEOPLE: Record<string, LookDescription> = {
  ines: { build: "slight", age: "adult", coat: 0x3a3d44, headwear: "bonnet", hair: { style: "bun", color: 0x2a1c12 }, beard: "none", skin: SKINS[2] },
  dov: { build: "normal", age: "young", coat: 0x4a3a28, headwear: "cap", hair: { style: "short", color: 0x1c130e }, beard: "stubble", skin: SKINS[0] },
  odalys: { build: "normal", age: "middle", coat: 0x17171d, headwear: "hood", longCoat: true, beard: "none", skin: SKINS[1] },
  cutter: { build: "broad", age: "middle", coat: 0x3a2a1a, headwear: "furcap", hair: { style: "short", color: 0x8a4a22 }, beard: { style: "full", color: 0x8a4a22 }, skin: SKINS[4] },
  wren: { build: "slight", age: "young", coat: 0x2a3036, headwear: "bare", hair: { style: "braid", color: 0x6a4526 }, beard: "none", longCoat: true, skin: SKINS[2] },
  pim: { build: "child", age: "child", coat: 0x3a3a2a, headwear: "furcap", hatColor: 0x6a5238, hair: { style: "short", color: 0x2a1c12 }, beard: "none", skin: SKINS[2] },
  harlan: { build: "broad", age: "old", coat: 0x262b30, headwear: "wide", longCoat: true, hair: { style: "short", color: 0x8a8a88 }, beard: { style: "long", color: 0x8a8a88 }, skin: SKINS[3] },
  marisol: { build: "normal", age: "adult", coat: 0x3a2a40, headwear: "bare", hair: { style: "bun", color: 0x0f0b09 }, beard: "none", skin: SKINS[5] },
  abel: { build: "normal", age: "middle", coat: 0x3a2e22, headwear: "furcap", hair: { style: "long", color: 0x4a3320 }, beard: { style: "long", color: 0x4a3320 }, longCoat: true, skin: SKINS[0] },
  priya: { build: "normal", age: "middle", coat: 0x3a4030, headwear: "bare", hair: { style: "braid", color: 0x0f0b09 }, beard: "none", skin: SKINS[5] },
  gus: { build: "broad", age: "middle", coat: 0x302418, headwear: "cap", hair: { style: "short", color: 0x0f0b09 }, beard: { style: "full", color: 0x0f0b09 }, skin: SKINS[1] },
  elspeth: { build: "slight", age: "old", coat: 0x121216, headwear: "bonnet", longCoat: true, hair: { style: "bun", color: 0xb8b4aa }, beard: "none", skin: SKINS[2] },
  mattie: { build: "slight", age: "young", coat: 0x34302c, headwear: "bonnet", hair: { style: "long", color: 0x6a4526 }, beard: "none", skin: SKINS[4] },
  juniper: { build: "child", age: "child", coat: 0x3a2f26, headwear: "bare", hair: { style: "braid", color: 0x1c130e }, beard: "none", longCoat: true, skin: SKINS[3] },
  thaddeus: { build: "normal", age: "adult", coat: 0x1f2630, headwear: "tall", longCoat: true, hair: { style: "short", color: 0x0f0b09 }, beard: { style: "goatee", color: 0x0f0b09 }, skin: SKINS[1] },
  birdie: { build: "gaunt", age: "middle", coat: 0x2f2a22, headwear: "cap", hair: { style: "wild", color: 0x5a5a5c }, beard: "stubble", skin: SKINS[3] },
  ambrose: { build: "normal", age: "old", coat: 0x5a4a34, headwear: "hood", longCoat: true, beard: { style: "short", color: 0x8a8a88 }, skin: SKINS[0] },
  rue: { build: "normal", age: "adult", coat: 0x3a2618, headwear: "wide", hair: { style: "braid", color: 0x8a4a22 }, beard: "none", skin: SKINS[5] },
  orin: { build: "slight", age: "adult", coat: 0x2a2a2a, headwear: "bare", hair: { style: "wild", color: 0x2a1c12 }, beard: "stubble", skin: SKINS[2] },
  hollis: { build: "slight", age: "young", coat: 0x2a2c24, headwear: "cap", hair: { style: "short", color: 0x6a4526 }, beard: "none", skin: SKINS[4] },
  nell: { build: "slight", age: "adult", coat: 0x2a2630, headwear: "bonnet", hair: { style: "bun", color: 0x4a3320 }, beard: "none", skin: SKINS[0] },
};

/** The wagon-master: wide hat, long coat, a torch in hand. */
const LEADER: LookDescription = { headwear: "wide", coat: 0x2a1c14, longCoat: true, build: "normal", age: "adult", skin: SKINS[4], hair: { style: "short", color: 0x2a1c12 }, beard: "stubble" };

/** The description of a roster member or anyone else who travels with the train. */
export function describeMember(id: string, role: Role, isLeader: boolean, traits: Trait[] = []): LookDescription {
  const base: LookDescription = isLeader ? LEADER : (PEOPLE[id] ?? {});
  return { ...base, role, gaunt: base.gaunt ?? traits.includes("sickly") };
}

export function lookFor(id: string, role: Role, isLeader: boolean, traits: Trait[] = []): Look {
  return resolveLook(describeMember(id, role, isLeader, traits), id);
}

export const ENEMY_LOOKS: Record<string, Look> = {
  raider: { hat: "wide", coat: 0x221a14, trousers: 0x14110e, accent: 0x6a1010, skin: SKINS[4], build: "normal", longCoat: true },
  thug: { hat: "cap", coat: 0x262220, trousers: 0x14110e, accent: 0x7a6a30, skin: SKINS[0], build: "broad" },
  starving: { hat: "bare", coat: 0x2a2620, trousers: 0x1a1612, accent: 0x3a3228, skin: SKINS[2], build: "gaunt" },
  hollowed: { hat: "bare", coat: 0x3a3634, trousers: 0x2a2826, accent: 0x4a2020, skin: 0x8a8886, build: "gaunt", hollow: true },
  longman: { hat: "bare", coat: 0x1a1818, trousers: 0x141212, accent: 0x3a1010, skin: 0x9a9894, build: "long", hollow: true },
  stranger: { hat: "wide", coat: 0x2e261e, trousers: 0x171411, accent: 0x5a4a3a, skin: SKINS[1], build: "normal" },
  woman: { hat: "bonnet", coat: 0x2a2228, trousers: 0x171411, accent: 0x6a5a5a, skin: SKINS[2], build: "slight" },
  child: { hat: "bare", coat: 0x3a3026, trousers: 0x171411, accent: 0x5a3a2a, skin: SKINS[3], build: "child" },
  monk: { hat: "hood", coat: 0xb8b0a0, trousers: 0x171411, accent: 0x8a8070, skin: SKINS[0], build: "normal", longCoat: true },
  official: { hat: "tall", coat: 0x1c2230, trousers: 0x12141a, accent: 0x8a2020, skin: SKINS[4], build: "broad", longCoat: true },
  preacher: { hat: "wide", coat: 0x140c0c, trousers: 0x100a0a, accent: 0x9a1a1a, skin: SKINS[2], build: "gaunt", longCoat: true },
};

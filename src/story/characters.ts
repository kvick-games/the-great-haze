// Characters, props and environments as Hyperlab Ether records, and the "look"
// model that says when a character's appearance has changed enough to need a
// new reference image.
//
// A base record is written once and never rewritten. Injuries, bandages, a
// dropped rifle or a Haze-marked face are extra slots (state_variants/... or
// outfit_variants/...) on the SAME character record, each with a visual version.

import { NPCS, npcById } from "../game/content/npcs.ts";
import { BACKGROUNDS, RECRUITS, ROSTER } from "../game/content/roster.ts";
import { SCENES } from "../game/content/scenes/index.ts";
import type { Look as NpcLook, Role, Trait } from "../game/types.ts";
import { REGIONS } from "../game/world.ts";
import { etherId, slotLink, withSlots } from "./datoms.ts";
import type { EtherRecord } from "./datoms.ts";

/**
 * How a person looks, as prompt text. Roster members are written straight into these fields;
 * NPCs and named strangers arrive as the game's structured `Look` and go through
 * `visualFromLook`. Both read out through `visualText`, so every character is described in
 * the same order and the same words wherever the description came from.
 */
export interface VisualDescription {
  build?: string;
  age?: string;
  skin?: string;
  hair?: string;
  clothing?: string;
  prop?: string;
  /** Two or three dominant colours. */
  palette?: string;
  /** Scars, injuries, tics. */
  marks?: string;
}

export type CharacterKind = "leader" | "companion" | "recruit" | "npc" | "stranger" | "archetype";

export interface CharacterSpec {
  /** Stable key: a roster id, "leader", "npc.<id>" or "archetype.<id>". */
  key: string;
  name: string;
  kind: CharacterKind;
  role?: Role;
  traits?: Trait[];
  bio: string;
  visual: VisualDescription;
  /** Prop keys carried from the start. */
  kit: string[];
}

/** The shape another workstream uses for named NPCs; accepted so it can be wired after merge. */
export interface NpcInput {
  id: string;
  name: string;
  role?: Role;
  traits?: Trait[];
  bio?: string;
  visual: VisualDescription;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PropSpec {
  key: string;
  name: string;
  description: string;
  /** Equipment slot a character carries it in. */
  slot: string;
}

export const PROPS: Record<string, PropSpec> = {
  torch: { key: "torch", name: "Pitch torch", description: "A pitch-soaked torch on a hand-length pole, burning with a low orange flame.", slot: "main_hand" },
  rifle: { key: "rifle", name: "Long rifle", description: "A worn percussion long rifle with a cracked walnut stock.", slot: "back" },
  "medic-satchel": { key: "medic-satchel", name: "Medic satchel", description: "A canvas satchel with a faded red cross stitched on the flap.", slot: "hip" },
  "tool-belt": { key: "tool-belt", name: "Tool belt", description: "A leather apron and tool belt heavy with wrenches, awls and a mallet.", slot: "waist" },
  spyglass: { key: "spyglass", name: "Spyglass", description: "A brass spyglass with a cracked cap, worn on a cord.", slot: "chest" },
  lantern: { key: "lantern", name: "Lantern and book", description: "A shuttered hand lantern and a black prayer book with a cracked spine.", slot: "off_hand" },
  bandolier: { key: "bandolier", name: "Bandolier", description: "A cartridge bandolier across the chest, mostly loops with nothing in them.", slot: "chest" },
  slingshot: { key: "slingshot", name: "Slingshot", description: "A forked-branch slingshot with a leather pouch of pebbles.", slot: "hip" },
  ledger: { key: "ledger", name: "Ledger", description: "A cloth-bound ledger, its pages dense with small handwriting.", slot: "off_hand" },
  cudgel: { key: "cudgel", name: "Iron-shod cudgel", description: "A hickory club capped in iron.", slot: "main_hand" },
};

export function propRecord(spec: PropSpec): EtherRecord {
  return {
    id: etherId("prop", spec.key),
    type: "concept.prop",
    name: spec.name,
    meta: { name: spec.name, description: spec.description, identity_brief: spec.description, slot: spec.slot },
    links: [],
  };
}

/** Which prop each role carries, matching the 3D client's silhouettes. */
export const ROLE_PROP: Record<Role, string> = {
  medic: "medic-satchel",
  hunter: "rifle",
  mechanic: "tool-belt",
  scout: "spyglass",
  speaker: "lantern",
  guard: "bandolier",
};

// ---------------------------------------------------------------------------
// Environments
// ---------------------------------------------------------------------------

export interface EnvSpec {
  key: string;
  name: string;
  description: string;
}

const ENV_LOOK: Record<string, string> = {
  tallow: "Flat wheat country under a bruised teal sky, scarecrows all facing east, a dirt road pale in the dusk.",
  fen: "Drowned trees and reeds in black standing water, mist at knee height, the road a causeway of planks.",
  flats: "White salt flats under a wide dead sky, the horizon a hard line, blood-coloured light on the crust.",
  pines: "Dark pines pressed close on both sides of a narrow road, needles underfoot, torch light swallowed by the trunks.",
  spine: "Bare mountain switchbacks with boulders and cold wind, ash-grey rock, the drop on one side.",
  threshold: "Green grass under a clearing sky, the first clean air in years, the Blue Reach's wall on the far ridge.",
};

export function environmentSpecs(): EnvSpec[] {
  const out: EnvSpec[] = REGIONS.map((r) => ({
    key: `region.${r.id}`,
    name: r.name,
    description: ENV_LOOK[r.id] ?? r.name,
  }));
  out.push(
    { key: "cinder-ford", name: "Cinder Ford", description: "A last frontier town at dusk, timber shopfronts, muster fires, wagons lining up on the dirt street." },
    { key: "camp", name: "The night camp", description: "Covered wagons drawn into a ring, pitch torches planted round the edge, oxen dozing, red stains bleeding into the night sky." },
  );
  return out;
}

export function environmentRecord(spec: EnvSpec): EtherRecord {
  return {
    id: etherId("env", spec.key),
    type: "concept.environment",
    name: spec.name,
    meta: { name: spec.name, description: spec.description, identity_brief: spec.description },
    links: [],
  };
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

const V = (build: string, age: string, hair: string, clothing: string, prop: string): VisualDescription => ({ build, age, hair, clothing, prop });

const ROSTER_VISUALS: Record<string, VisualDescription> = {
  ines: V("slight, stooped", "mid-30s", "dark hair pinned under a grey kerchief", "faded blue infirmary smock under a wool coat", "medic satchel with a red cross"),
  dov: V("broad, calloused", "late 20s", "short black hair, sooty stubble", "leather apron over a patched work shirt", "tool belt and a heavy wrench"),
  odalys: V("tall, composed", "early 40s", "cropped silver-streaked hair under a grey veil", "undyed habit with a wooden cross", "shuttered lantern and prayer book"),
  cutter: V("heavy-shouldered", "mid-40s", "cropped red beard, thinning hair", "scarred leather toll-guard coat, brass buttons", "rifle slung across the back"),
  wren: V("wiry, watchful", "early 20s", "long braid the colour of straw", "long dust-coloured coat, fingerless gloves", "brass spyglass on a cord"),
  pim: V("skinny, small for fifteen", "15", "floppy brown hair", "oversized jacket, squirrel-skin cap", "slingshot"),
  harlan: V("stout, thick-necked", "50", "bald with a grey moustache", "buckled greatcoat with a Company armband", "cartridge bandolier"),
  marisol: V("elegant, narrow", "late 30s", "black hair in a tight bun", "ink-stained clerk's waistcoat and cuffs", "leather ledger under her arm"),
  abel: V("gaunt, weathered", "late 50s", "long grey hair, braided beard", "fur-collared trapper's coat, snowshoes tied to the pack", "rifle and a string of trap chains"),
  priya: V("compact, upright", "early 50s", "iron-grey hair cut short", "army surgeon's coat, sleeves rolled, bloodstained cuffs", "surgeon's satchel"),
  gus: V("huge, barrel-chested", "mid-30s", "unruly ginger hair, wide grin", "sleeveless smith's vest, soot to the elbows", "sledge mallet on his shoulder"),
  elspeth: V("small, straight-backed", "60", "white hair under a black widow's cap", "black mourning dress with a shawl", "ledger of names, a pencil behind her ear"),
};

/** Named companions describe themselves: their structured Look is the only source. */
const recruitVisual = (id: string): VisualDescription => visualFromLook(npcById(id)!.look);

const LEADER_VISUALS: Record<string, VisualDescription> = {
  surveyor: V("lean, sun-browned", "early 40s", "short dark hair greying at the temples", "wide-brimmed hat, long dust coat, surveyor's boots", "a lit pitch torch"),
  nurse: V("steady, tired", "late 30s", "hair tied back under a wide-brimmed hat", "wide-brimmed hat, long coat over a stained apron", "a lit pitch torch and a small satchel"),
  wheelwright: V("broad, ropy forearms", "mid-40s", "cropped hair, heavy brows", "wide-brimmed hat, leather waistcoat, rolled sleeves", "a lit pitch torch"),
  sergeant: V("hard, upright", "late 40s", "grey buzz cut", "wide-brimmed hat, faded militia coat with the insignia torn off", "a lit pitch torch"),
};

/** Archetypes for people and things met on the road. */
const ARCHETYPES: { key: string; name: string; bio: string; visual: VisualDescription }[] = [
  { key: "stranger", name: "A stranger on the road", bio: "Someone met on the road, in need or pretending to be.", visual: V("thin, travel-worn", "indeterminate", "matted hair under a hood", "layers of patched coats, one boot wrapped in cloth", "a bundle tied in a blanket") },
  { key: "raiders", name: "Raiders", bio: "A band of riders in mismatched coats with bandanas over their faces.", visual: V("hard, hungry", "20s to 40s", "hidden under hats and rags", "mismatched coats, bandanas over the face", "rifles and pistols drawn") },
  { key: "toll-thugs", name: "Toll thugs", bio: "Men with clubs and a Company armband they did not earn.", visual: V("heavy, swaggering", "30s", "shaved or greasy", "stolen Company armbands over rough coats", "clubs and a rope chain") },
  { key: "mob", name: "A starving mob", bio: "Thin people out of the ruins, hands out.", visual: V("skeletal", "all ages", "unkempt", "tatters of good clothes", "empty hands held out") },
  { key: "hollowed", name: "The Hollowed", bio: "People the Haze has emptied: eyes open, hands patient.", visual: V("upright, unhurried", "all ages", "hair damp with red fog", "grave-clean clothes from before, faintly stained crimson", "empty hands") },
  { key: "haze-hounds", name: "Haze hounds", bio: "Farm dogs in a pack, coats wet with red, silent.", visual: V("lean, low", "n/a", "short matted fur dark with red mist", "none", "none") },
  { key: "long-man", name: "The Long Man", bio: "A man the Haze kept stretching.", visual: V("impossibly tall and thin, limbs too long", "indeterminate", "sparse", "a coat that no longer reaches his wrists", "none") },
  { key: "the-turned", name: "The Turned", bio: "Someone you knew, with the wrong-coloured eyes and a very calm face.", visual: V("familiar", "same as before", "same as before", "the same clothes, immaculate", "none") },
];

function roleTraitsText(role?: Role, traits?: Trait[]): string {
  return [role, ...(traits ?? [])].filter(Boolean).join(", ");
}

export function visualText(v: VisualDescription): string {
  return [v.build, v.age, v.skin && `${v.skin} skin`, v.hair, v.clothing, v.palette && `colours: ${v.palette}`, v.prop && `carrying ${v.prop}`, v.marks && `marked by ${v.marks}`]
    .filter(Boolean)
    .join("; ");
}

/** Map the game's structured `Look` (NPCs, named strangers) into the story's description fields. */
export function visualFromLook(l: NpcLook): VisualDescription {
  const hair = l.hair.style === "bald" ? "bald" : l.hair.style === "covered" ? `hair covered, ${l.hair.color}` : `${l.hair.style} hair, ${l.hair.color}`;
  const facial = l.hair.facial === "none" ? "" : l.hair.facial.replace("-", " ");
  return {
    build: `${l.build} build, ${l.height}`,
    age: l.age < 16 ? `a child of ${l.age}` : `age ${l.age}`,
    skin: l.skin,
    hair: facial ? `${hair}, ${facial}` : hair,
    clothing: l.clothing.join(", "),
    palette: l.palette.join(", "),
    prop: l.prop.desc,
    marks: l.marks.length ? l.marks.join("; ") : undefined,
  };
}

/** Same person? Age, skin, hair and the defining prop survive the variations scenes make to a look. */
function sameFace(a: NpcLook, b: NpcLook): boolean {
  return a.age === b.age && a.skin === b.skin && a.hair.color === b.hair.color && a.hair.style === b.hair.style && a.prop.id === b.prop.id;
}

/** The character key a scene's stranger is drawn as: the named NPC if it is that person, else its own. */
export function strangerKey(sceneId: string): string | null {
  const def = SCENES.find((s) => s.id === sceneId);
  if (!def?.stranger) return null;
  const npc = NPCS.find((n) => sameFace(n.look, def.stranger!.look));
  return npc ? npc.id : `stranger.${sceneId}`;
}

function backgroundOf(role?: Role, traits?: Trait[]): string {
  const hit = BACKGROUNDS.find((b) => b.role === role && b.traits.every((t) => (traits ?? []).includes(t)));
  return hit ? hit.id : BACKGROUNDS[0].id;
}

export interface CharacterSpecOptions {
  /** Leader details from the run. Omit for the default wagon-master. */
  leader?: { name: string; role?: Role; traits?: Trait[] };
  npcs?: NpcInput[];
}

/** Every character the story layer can know about, in a stable order. */
export function characterSpecs(opts: CharacterSpecOptions = {}): CharacterSpec[] {
  const out: CharacterSpec[] = [];
  const lead = opts.leader ?? { name: "The Wagon-Master", role: BACKGROUNDS[0].role, traits: BACKGROUNDS[0].traits };
  const bg = backgroundOf(lead.role, lead.traits);
  out.push({
    key: "leader",
    name: lead.name,
    kind: "leader",
    role: lead.role,
    traits: lead.traits,
    bio: BACKGROUNDS.find((b) => b.id === bg)?.blurb ?? "The wagon-master.",
    visual: LEADER_VISUALS[bg],
    kit: ["torch", ...(lead.role ? [ROLE_PROP[lead.role]] : [])],
  });
  for (const t of ROSTER) {
    out.push({ key: t.id, name: t.name, kind: "companion", role: t.role, traits: t.traits, bio: t.bio, visual: ROSTER_VISUALS[t.id], kit: kitFor(t.id, t.role) });
  }
  for (const t of RECRUITS) {
    out.push({ key: t.id, name: t.name, kind: "recruit", role: t.role, traits: t.traits, bio: t.bio, visual: recruitVisual(t.id), kit: kitFor(t.id, t.role) });
  }
  for (const n of opts.npcs ?? []) {
    out.push({
      key: n.id.startsWith("npc.") ? n.id : `npc.${n.id}`,
      name: n.name,
      kind: "npc",
      role: n.role,
      traits: n.traits,
      bio: n.bio ?? n.name,
      visual: n.visual,
      kit: n.role ? [ROLE_PROP[n.role]] : [],
    });
  }
  // Strangers with a face of their own. A stranger who is one of the named NPCs is that NPC's datom,
  // so the face met on the road is the face that later joins.
  const known = new Set(out.map((c) => c.key));
  for (const def of SCENES) {
    if (!def.stranger) continue;
    const key = strangerKey(def.id)!;
    if (known.has(key)) continue;
    known.add(key);
    out.push({ key, name: def.stranger.name, kind: "stranger", bio: def.stranger.look.summary, visual: visualFromLook(def.stranger.look), kit: [] });
  }
  for (const a of ARCHETYPES) {
    out.push({ key: `archetype.${a.key}`, name: a.name, kind: "archetype", bio: a.bio, visual: a.visual, kit: [] });
  }
  return out;
}

function kitFor(key: string, role: Role): string[] {
  if (key === "pim") return ["slingshot"];
  if (key === "elspeth" || key === "marisol" || key === "orin") return ["ledger"];
  if (key === "cutter" && role === "hunter") return ["rifle"];
  return [ROLE_PROP[role]];
}

/** Build the Ether record for a character: identity_brief is the stable identity, appearance the base look. */
export function characterRecord(spec: CharacterSpec): EtherRecord {
  const brief = `${spec.name}${spec.role ? `, the ${roleTraitsText(spec.role, spec.traits)}` : ""}. ${visualText(spec.visual)}.`;
  const rec: EtherRecord = {
    id: etherId("char", spec.key),
    type: "concept.character",
    name: spec.name,
    meta: {
      name: spec.name,
      identity_brief: brief,
      appearance: visualText(spec.visual),
      description: spec.bio,
      character_id: spec.key,
      kind: spec.kind,
      generation_constraints: "Grim frontier horror, torchlight and dusk, muted period costume, no modern items.",
    },
    links: ["hero", "front_view", "three_quarter", "character_sheet"].map(slotLink),
  };
  return rec;
}

/** Records for every character, prop and environment, base looks only. */
export function allRecords(opts: CharacterSpecOptions = {}): EtherRecord[] {
  return [
    ...characterSpecs(opts).map(characterRecord),
    ...Object.values(PROPS).map(propRecord),
    ...environmentSpecs().map(environmentRecord),
  ];
}

export function specByKey(specs: CharacterSpec[], key: string): CharacterSpec | undefined {
  return specs.find((s) => s.key === key);
}

// ---------------------------------------------------------------------------
// The look model
// ---------------------------------------------------------------------------

export type CharacterStatus = "active" | "dead" | "departed" | "turned";
export type Costume = "travel" | "bloodied" | "bandaged";

/** Everything about a character that can change how they must be drawn. */
export interface Look {
  status: CharacterStatus;
  wounded: boolean;
  sick: boolean;
  dying: boolean;
  maimed: boolean;
  gaunt: boolean;
  /** Haze exposure, 0 to 3. */
  fog: number;
  costume: Costume;
  kit: string[];
}

export function baseLook(kit: string[]): Look {
  return { status: "active", wounded: false, sick: false, dying: false, maimed: false, gaunt: false, fog: 0, costume: "travel", kit: kit.slice().sort() };
}

/** A canonical string for a look. Equal signatures mean the same reference image works. */
export function lookSignature(l: Look): string {
  if (l.status !== "active") return l.status;
  const p: string[] = [l.status];
  if (l.dying) p.push("dying");
  else if (l.wounded) p.push("wounded");
  if (l.sick) p.push("sick");
  if (l.maimed) p.push("maimed");
  if (l.gaunt) p.push("gaunt");
  if (l.fog) p.push(`fog${l.fog}`);
  if (l.costume !== "travel") p.push(l.costume);
  p.push("kit=" + l.kit.slice().sort().join("+"));
  return p.join("|");
}

/** Inverse of lookSignature, so a recorded signature can be redrawn without its history. */
export function lookFromSignature(sig: string): Look {
  const parts = sig.split("|");
  const l = baseLook([]);
  l.status = parts[0] as Look["status"];
  for (const p of parts.slice(1)) {
    if (p === "dying") l.dying = true;
    else if (p === "wounded") l.wounded = true;
    else if (p === "sick") l.sick = true;
    else if (p === "maimed") l.maimed = true;
    else if (p === "gaunt") l.gaunt = true;
    else if (p.startsWith("fog")) l.fog = Number(p.slice(3));
    else if (p === "bloodied" || p === "bandaged") l.costume = p;
    else if (p.startsWith("kit=")) l.kit = p.slice(4) ? p.slice(4).split("+") : [];
  }
  return l;
}

/** The most salient thing about a look, used to name its slot. */
export function lookLabel(l: Look, baseKit: string[]): string {
  if (l.status === "dead") return "dead";
  if (l.status === "turned") return "turned";
  if (l.status === "departed") return "departed";
  if (l.dying) return "dying";
  if (l.fog >= 2) return `fogsick-${l.fog}`;
  if (l.maimed) return "maimed";
  if (l.wounded) return "wounded";
  if (l.fog === 1) return "fogsick-1";
  if (l.sick) return "sick";
  if (l.gaunt) return "gaunt";
  if (l.costume !== "travel") return l.costume;
  const same = l.kit.slice().sort().join() === baseKit.slice().sort().join();
  return same ? "base" : "kit";
}

/** Slot key for a look at a visual version: v1 is the base sheet; later versions are variants. */
export function slotKeyFor(label: string, version: number): string {
  if (version <= 1) return "hero";
  const outfit = label === "bloodied" || label === "bandaged" || label === "kit";
  return `${outfit ? "outfit_variants" : "state_variants"}/${label}-v${version}`;
}

/** Text for a prompt describing how a look differs from the base. */
export function lookDescription(l: Look, propNames: (key: string) => string, baseKit: string[]): string {
  const bits: string[] = [];
  if (l.status === "dead" || l.status === "departed") {
    if (l.status === "dead") bits.push("lying dead");
    else bits.push("walking away");
    if (l.costume === "bloodied") bits.push("clothes stained with blood");
    return bits.join("; ");
  }
  if (l.status === "turned") bits.push("turned by the Haze, eyes an unnatural calm colour, still and patient");
  if (l.dying) bits.push("dying, grey-faced and unable to stand without help");
  else if (l.wounded) bits.push("wounded, favouring one side");
  if (l.sick) bits.push("feverish");
  if (l.maimed) bits.push("permanently marked by a serious injury, a scar and a limp");
  if (l.gaunt) bits.push("gaunt from hunger");
  if (l.fog === 1) bits.push("a faint red flush under the skin from Haze exposure");
  if (l.fog === 2) bits.push("pale, with red-veined eyes, marked by the Haze");
  if (l.fog >= 3) bits.push("hollow-eyed, nearly Turned");
  if (l.costume === "bloodied") bits.push("clothes stained with fresh blood");
  if (l.costume === "bandaged") bits.push("wrapped in clean bandages over the wound");
  const lost = baseKit.filter((k) => !l.kit.includes(k));
  const gained = l.kit.filter((k) => !baseKit.includes(k));
  if (lost.length) bits.push(`no longer carrying ${lost.map(propNames).join(", ")}`);
  if (gained.length) bits.push(`now carrying ${gained.map(propNames).join(", ")}`);
  return bits.join("; ");
}

/** Record with extra variant slots declared. Used by exports once a look has reference art. */
export function recordWithVariants(spec: CharacterSpec, slotKeys: string[]): EtherRecord {
  return withSlots(characterRecord(spec), slotKeys);
}

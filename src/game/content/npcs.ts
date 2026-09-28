// Named people the train can meet on the road and take aboard. Each one has a
// role and traits (so the party systems treat them like anyone else once they
// join), a one-line past, a structured look that both the 3D figures and the
// video character datoms read, a complication that surfaces some days after
// they join, and words of their own.
//
// Where they are met lives in scenes/companions.ts (and a few older stranger
// scenes). `recruit` in effects.ts turns a definition into a party member.

import type { Look, NpcDef } from "../types.ts";

/** Build a look with sensible defaults for the parts a caller does not care about. */
function look(l: Omit<Look, "marks"> & { marks?: string[] }): Look {
  return { marks: [], ...l };
}

export const NPCS: NpcDef[] = [
  {
    id: "mattie",
    name: "Mattie Voss",
    role: "medic",
    traits: ["kind", "coward"],
    backstory: "A country doctor's daughter, pulled from under a fallen roof beam.",
    maxHealth: 70,
    look: look({
      build: "slight",
      height: "average",
      age: 26,
      skin: "fair, freckled, sunburnt across the nose",
      hair: { style: "bun", color: "ash blonde, dusty", facial: "none" },
      clothing: ["a doctor's oilcloth apron over a torn blue dress", "a man's boots two sizes too big", "one leather glove"],
      palette: ["faded blue", "oilcloth yellow", "rust brown"],
      prop: { id: "doctors-bag", desc: "a cracked black doctor's bag held to her chest with both arms" },
      marks: ["a healing cut along the left brow", "hands that shake until she has something to do with them"],
      summary: "A thin young woman in a doctor's apron, clutching a cracked black bag and looking at the ground.",
    }),
    complication: {
      text: "She freezes when someone screams. In a crisis she will not be the one with steady hands.",
      scene: "npc-mattie-freezes",
      afterDays: 3,
    },
    join: [
      { who: "npc:mattie", text: "I can set bones. I can. Just don't ask me to be brave.", mood: "afraid", gesture: "clutch" },
      { who: "leader", text: "Nobody asked. Get in the wagon.", mood: "calm", gesture: "beckon" },
    ],
  },
  {
    id: "juniper",
    name: "Juniper Cole",
    role: "scout",
    traits: ["charming", "haunted"],
    backstory: "Eleven years old and unnervingly good at knowing when to be quiet.",
    maxHealth: 55,
    nerve: 45,
    look: look({
      build: "small",
      height: "short",
      age: 11,
      skin: "olive, ground with dirt",
      hair: { style: "braided", color: "black, one braid unravelling", facial: "none" },
      clothing: ["a man's wool coat with the sleeves rolled four times", "no shoes, one shoe carried in her hand"],
      palette: ["coat grey", "dirt brown", "a thread of red ribbon"],
      prop: { id: "single-shoe", desc: "one child's shoe, carried like a treasure, never worn" },
      marks: ["scabs on both knees", "eyes that stay on the horizon behind you"],
      summary: "A very small girl in an enormous grey coat, carrying one shoe and watching the road behind you.",
    }),
    complication: {
      text: "She hears the Haze speak names at night, and lately one of the names is yours.",
      scene: "npc-juniper-names",
      afterDays: 4,
    },
    join: [
      { who: "npc:juniper", text: "I don't take up much room. I promise.", mood: "pleading", gesture: "offer" },
      { who: "actor", text: "You take up exactly the room you need.", mood: "calm", gesture: "beckon" },
    ],
  },
  {
    id: "thaddeus",
    name: "Thaddeus Moreau",
    role: "guard",
    traits: ["stoic", "pious"],
    backstory: "A deserter from the Company guard, and honest about it.",
    look: look({
      build: "broad",
      height: "tall",
      age: 44,
      skin: "dark brown, wind-cracked",
      hair: { style: "cropped", color: "grey stubble", facial: "stubble" },
      clothing: ["a Company guard's coat with the badge cut off", "a rope belt with a wooden cross on it", "worn cavalry boots"],
      palette: ["Company grey-green", "dull brass", "black"],
      prop: { id: "cut-badge-coat", desc: "a Company coat with a clean pale square where the badge used to be" },
      marks: ["a pale square on the coat", "a knuckle scar that he rubs when he prays"],
      summary: "A tall grey-stubbled man in a Company coat with the badge cut out, lips moving in a silent prayer.",
    }),
    complication: {
      text: "A Company rider knows his face. The Company does not forgive desertion, and neither does he.",
      scene: "npc-thaddeus-rider",
      afterDays: 5,
    },
    join: [
      { who: "npc:thaddeus", text: "I ran. I will not run again. That is my only promise.", mood: "cold", gesture: "none" },
    ],
  },
  {
    id: "birdie",
    name: "Birdie Nkemelu",
    role: "mechanic",
    traits: ["kind", "sickly"],
    backstory: "A tinker with a mule and a limp. The mule is dead. The limp remains.",
    maxHealth: 75,
    generic: true,
    look: look({
      build: "sturdy",
      height: "short",
      age: 52,
      skin: "deep brown, lined",
      hair: { style: "covered", color: "grey, under a patched green headscarf", facial: "none" },
      clothing: ["a patched green headscarf", "a leather tinker's apron heavy with pockets", "a wooden crutch under one arm"],
      palette: ["patched green", "tarnished brass", "faded orange"],
      prop: { id: "tinker-roll", desc: "a rolled canvas of small tools, tied to her back with a bootlace" },
      marks: ["a limp on the left", "a wet cough she hides in a handkerchief"],
      summary: "A short, sturdy older woman in a patched green headscarf, leaning on a crutch with a roll of tools on her back.",
    }),
    complication: {
      text: "The cough is getting worse, and she is hiding the handkerchief.",
      scene: "npc-birdie-cough",
      afterDays: 4,
    },
    join: [
      { who: "npc:birdie", text: "I can fix anything you break. Except maybe me.", mood: "sly", gesture: "shrug" },
      { who: "leader", text: "Then we will not break you.", mood: "calm", gesture: "offer" },
    ],
  },
  {
    id: "ambrose",
    name: "Brother Ambrose",
    role: "speaker",
    traits: ["pious", "stoic"],
    backstory: "The only monk from the mission who could still speak in full sentences.",
    look: look({
      build: "lean",
      height: "tall",
      age: 58,
      skin: "pale, sun-freckled",
      hair: { style: "bald", color: "none, a sunburnt scalp", facial: "long-beard" },
      clothing: ["a brown habit gone black at the hem", "rope sandals", "a wooden rosary wrapped twice round the wrist"],
      palette: ["habit brown", "ash grey", "dull gold"],
      prop: { id: "mission-bell", desc: "a small handbell with a cracked tongue, muffled with cloth" },
      marks: ["burn scars up both forearms", "he does not blink often enough"],
      summary: "A tall, bald, long-bearded monk in a soot-blackened habit, carrying a handbell wrapped in cloth.",
    }),
    complication: {
      text: "He knows what the mission did. He will tell you, in pieces, at the worst time.",
      scene: "npc-ambrose-confession",
      afterDays: 6,
    },
    join: [
      { who: "npc:ambrose", text: "I will speak for you where speaking still works.", mood: "calm", gesture: "offer" },
    ],
  },
  {
    id: "rue",
    name: "Rue Delacroix",
    role: "hunter",
    traits: ["hothead", "charming"],
    backstory: "A drover who lost her herd and her patience in the same week.",
    generic: true,
    look: look({
      build: "lean",
      height: "average",
      age: 33,
      skin: "tan, weathered",
      hair: { style: "long", color: "red-brown, tied back with twine", facial: "none" },
      clothing: ["a drover's long brown duster", "a wide sweat-stained hat", "spurs, still on"],
      palette: ["duster brown", "cattle-brand red", "dust"],
      prop: { id: "stock-whip", desc: "a coiled stockwhip on her belt she touches when she is angry" },
      marks: ["a rope burn across the right palm", "a brand mark on her forearm: DL"],
      summary: "A lean woman in a long brown duster and a wide hat, a coiled whip on her hip and spurs on her boots.",
    }),
    complication: {
      text: "She wants to go back for the last of her herd. She has started to slow the train herself.",
      scene: "npc-rue-herd",
      afterDays: 4,
    },
    join: [
      { who: "npc:rue", text: "Point me at something that needs killing and I'm yours.", mood: "sly", gesture: "point" },
    ],
  },
  {
    id: "orin",
    name: "Orin Fell",
    role: "scout",
    traits: ["paranoid", "coward"],
    backstory: "Left alone in a burnt wagon with a ledger and a cough. He is sure someone is behind him.",
    maxHealth: 65,
    look: look({
      build: "gaunt",
      height: "average",
      age: 38,
      skin: "grey-pale, sweat-slick",
      hair: { style: "shaggy", color: "thinning brown, singed at one side", facial: "stubble" },
      clothing: ["a burnt clerk's waistcoat over a ragged shirt", "a scarf pulled up over the chin", "boots wrapped in sacking"],
      palette: ["ash grey", "scorched brown", "ledger green"],
      prop: { id: "burnt-ledger", desc: "a scorched account ledger tied shut with a strap he never lets go of" },
      marks: ["scorch marks on the left sleeve", "he looks over his shoulder every few seconds"],
      summary: "A gaunt, sweat-slick man in a burnt clerk's waistcoat, hugging a scorched ledger and glancing behind him.",
    }),
    complication: {
      text: "The ledger is the Company's payroll of the dead, and some names in it are wrong. Someone wants it back.",
      scene: "npc-orin-ledger",
      afterDays: 4,
    },
    join: [
      { who: "npc:orin", text: "Keep watching the road behind us. Please. Somebody has to.", mood: "afraid", gesture: "clutch" },
    ],
  },
  {
    id: "hollis",
    name: "Hollis Grey",
    role: "hunter",
    traits: ["kind", "stoic"],
    backstory: "A ferryman's son with a borrowed rifle and a way of standing very still.",
    generic: true,
    look: look({
      build: "lean",
      height: "tall",
      age: 24,
      skin: "brown, river-tanned",
      hair: { style: "short", color: "dark, damp-looking", facial: "none" },
      clothing: ["a ferryman's oilskin coat, dry only in patches", "waders cut down to boots", "a grey neck rag"],
      palette: ["river grey", "oilskin green", "rust"],
      prop: { id: "borrowed-rifle", desc: "a long-barrelled rifle with someone else's initials carved in the stock" },
      marks: ["rope calluses across both palms", "he stands so still that birds forget him"],
      summary: "A tall young man in a grey oilskin coat, standing perfectly still with a rifle that has someone else's initials on it.",
    }),
    complication: {
      text: "The rifle's real owner is looking for it, and for him.",
      scene: "npc-hollis-rifle",
      afterDays: 5,
    },
    join: [
      { who: "npc:hollis", text: "I don't say much. I do see everything.", mood: "calm", gesture: "none" },
    ],
  },
  {
    id: "nell",
    name: "Nell Ashby",
    role: "speaker",
    traits: ["paranoid", "coward"],
    backstory: "A postmistress who kept the last mail sacks and reads everything twice.",
    maxHealth: 70,
    generic: true,
    look: look({
      build: "slight",
      height: "short",
      age: 47,
      skin: "pale, ink-stained fingers",
      hair: { style: "bun", color: "iron grey, pinned tight", facial: "none" },
      clothing: ["a black postal jacket with brass buttons", "half-moon spectacles on a cord", "a heavy canvas mail sack across the chest"],
      palette: ["postal black", "brass", "envelope cream"],
      prop: { id: "mail-sack", desc: "a canvas mail sack stencilled MERIDIAN POST, full of letters nobody collected" },
      marks: ["ink stains up to the wrist", "she whispers addresses under her breath"],
      summary: "A short, tight-buttoned older woman in a black postal jacket, spectacles on a cord, a bulging mail sack across her chest.",
    }),
    complication: {
      text: "One of the letters in her sack is addressed to someone on the train, and she has not delivered it.",
      scene: "npc-nell-letter",
      afterDays: 4,
    },
    join: [
      { who: "npc:nell", text: "I have kept everyone's post. I can keep your secrets too.", mood: "sly", gesture: "clutch" },
    ],
  },
];

const BY_ID = new Map(NPCS.map((n) => [n.id, n]));

export function npcById(id: string): NpcDef | undefined {
  return BY_ID.get(id);
}

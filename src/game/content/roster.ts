import type { Role, Trait } from "../types.ts";

export interface MemberTemplate {
  id: string;
  name: string;
  role: Role;
  traits: Trait[];
  bio: string;
  maxHealth?: number;
  nerve?: number;
  /** Recruitable by scenes that offer "someone" rather than a named person. */
  generic?: boolean;
  /** Starting bond with other roster ids, if both are in the party. */
  ties?: Record<string, number>;
}

export interface Background {
  id: string;
  name: string;
  blurb: string;
  role: Role;
  traits: Trait[];
}

/** The wagon-master's past shapes their skills. */
export const BACKGROUNDS: Background[] = [
  {
    id: "surveyor",
    name: "Company surveyor",
    blurb: "You mapped the Road for the Meridian Company before it stopped paying you. Sharp eyes, steady nerves.",
    role: "scout",
    traits: ["stoic", "paranoid"],
  },
  {
    id: "nurse",
    name: "Field nurse",
    blurb: "You have closed more eyes than you can count. People tell you things.",
    role: "medic",
    traits: ["kind", "stoic"],
  },
  {
    id: "wheelwright",
    name: "Wheelwright",
    blurb: "You can fix any wagon that has ever been built and will not trust one that has not been checked twice.",
    role: "mechanic",
    traits: ["paranoid", "charming"],
  },
  {
    id: "sergeant",
    name: "Militia sergeant",
    blurb: "You kept order in the last town to fall. You are still not sure you did.",
    role: "guard",
    traits: ["veteran", "haunted"],
  },
];

export const ROSTER: MemberTemplate[] = [
  {
    id: "ines",
    name: "Ines Calloway",
    role: "medic",
    traits: ["kind", "sickly"],
    bio: "Company infirmary nurse. Counts pills before she counts people, and hates herself for it.",
    maxHealth: 80,
    ties: { odalys: 15, cutter: -10 },
  },
  {
    id: "dov",
    name: "Dov Reyes",
    role: "mechanic",
    traits: ["paranoid", "stoic"],
    bio: "A wheelwright's son. Trusts bolts more than faces.",
    ties: { gus: 10 },
  },
  {
    id: "odalys",
    name: "Sister Odalys",
    role: "speaker",
    traits: ["pious", "charming"],
    bio: "Left the Mission of Saint Ambrose before it went quiet. Will not say why.",
    ties: { cutter: -25, ines: 15, elspeth: -10 },
  },
  {
    id: "cutter",
    name: "Cutter Vance",
    role: "hunter",
    traits: ["hothead", "veteran"],
    bio: "Former toll guard. Gets things done, regrets them later.",
    ties: { odalys: -25, harlan: 20 },
  },
  {
    id: "wren",
    name: "Wren Achterberg",
    role: "scout",
    traits: ["haunted", "kind"],
    bio: "Says the Haze hums when it is close. Is right more often than anyone likes.",
    nerve: 65,
    ties: { pim: 60 },
  },
  {
    id: "pim",
    name: "Pim Achterberg",
    role: "hunter",
    traits: ["coward", "kind"],
    bio: "Fifteen. A slingshot, a squirrel-skin cap, and a sister who will not let go of his sleeve.",
    maxHealth: 70,
    ties: { wren: 60 },
  },
  {
    id: "harlan",
    name: "Harlan Boyd",
    role: "guard",
    traits: ["veteran", "greedy"],
    bio: "Sold his rifle twice. Still has it.",
    ties: { cutter: 20, marisol: -15 },
  },
  {
    id: "marisol",
    name: "Marisol Quint",
    role: "speaker",
    traits: ["charming", "greedy"],
    bio: "Company clerk. Knows every price, and every lie behind it.",
    ties: { harlan: -15, dov: 5 },
  },
  {
    id: "abel",
    name: "Abel Thorne",
    role: "hunter",
    traits: ["stoic", "paranoid"],
    bio: "Trapper. Talks to animals more than to people, and the animals have stopped answering.",
    ties: { elspeth: 10 },
  },
  {
    id: "priya",
    name: "Priya Nanda",
    role: "medic",
    traits: ["paranoid", "veteran"],
    bio: "Army surgeon. Has seen what walks out of the Haze and refuses to describe it.",
    ties: { ines: -10, gus: 5 },
  },
  {
    id: "gus",
    name: "Gus Ferreira",
    role: "mechanic",
    traits: ["hothead", "kind"],
    bio: "Big laugh, bigger temper. Fixed the Widow's mill for free and then broke the Foreman's jaw.",
    ties: { dov: 10, priya: 5 },
  },
  {
    id: "elspeth",
    name: "Elspeth Marrow",
    role: "scout",
    traits: ["paranoid", "pious"],
    bio: "A widow who keeps a ledger of everyone who has died and adds names as she goes.",
    ties: { abel: 10, odalys: -10 },
  },
];

/** Strangers who can join the train if you help them. Never offered twice. */
export const RECRUITS: MemberTemplate[] = [
  {
    id: "mattie",
    name: "Mattie Voss",
    role: "medic",
    traits: ["kind", "coward"],
    bio: "A country doctor's daughter, pulled from under a fallen roof beam.",
    maxHealth: 70,
  },
  {
    id: "juniper",
    name: "Juniper Cole",
    role: "scout",
    traits: ["charming", "haunted"],
    bio: "Eleven years old and unnervingly good at knowing when to be quiet.",
    maxHealth: 55,
    nerve: 45,
  },
  {
    id: "thaddeus",
    name: "Thaddeus Moreau",
    role: "guard",
    traits: ["stoic", "pious"],
    bio: "A deserter from the Company guard, and honest about it.",
  },
  {
    id: "birdie",
    name: "Birdie Nkemelu",
    role: "mechanic",
    traits: ["kind", "sickly"],
    bio: "A tinker with a mule and a limp. The mule is dead. The limp remains.",
    generic: true,
    maxHealth: 75,
  },
  {
    id: "ambrose",
    name: "Brother Ambrose",
    role: "speaker",
    traits: ["pious", "stoic"],
    bio: "The only monk from the mission who could still speak in full sentences.",
  },
  {
    id: "rue",
    name: "Rue Delacroix",
    role: "hunter",
    traits: ["hothead", "charming"],
    bio: "A drover who lost her herd and her patience in the same week.",
    generic: true,
  },
  {
    id: "orin",
    name: "Orin Fell",
    role: "scout",
    traits: ["paranoid", "coward"],
    bio: "Left alone in a burnt wagon with a ledger and a cough. He is sure someone is behind him.",
    maxHealth: 65,
  },
  {
    id: "hollis",
    name: "Hollis Grey",
    role: "hunter",
    traits: ["kind", "stoic"],
    bio: "A ferryman's son with a borrowed rifle and a way of standing very still.",
    generic: true,
  },
  {
    id: "nell",
    name: "Nell Ashby",
    role: "speaker",
    traits: ["paranoid", "coward"],
    bio: "A postmistress who kept the last mail sacks and reads everything twice.",
    maxHealth: 70,
    generic: true,
  },
];

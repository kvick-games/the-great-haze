import { NPCS } from "./npcs.ts";
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

/** People met on the road who can join the train. Never offered twice. Defined in npcs.ts. */
export const RECRUITS: MemberTemplate[] = NPCS.map((n) => ({
  id: n.id,
  name: n.name,
  role: n.role,
  traits: n.traits.slice(),
  bio: n.backstory,
  maxHealth: n.maxHealth,
  nerve: n.nerve,
  generic: n.generic,
}));

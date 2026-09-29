// What the crew sheet knows about a person, read off the sim state in one place.
//
// The sheet never touches GameState directly: it asks this adapter for a CrewProfile.
// Relationships and event history come from two small readers below (readTies and
// readHistory). Until the sim records them itself they are derived from what exists:
// pair bonds, trust, fate, and a chronicle the client keeps by watching the party
// change from one screen to the next.
//
// Living members' ties come from relationsOf (src/game/relationships.ts); their history merges
// Member.history with the client's own chronicle.

import type { GameState, Member, MemberView, Trait } from "../../../src/game/types.ts";
import { conditionsOf, memberView } from "../../../src/game/party.ts";
import { npcById } from "../../../src/game/content/npcs.ts";
import { TUNING } from "../../../src/game/tuning.ts";

import { relationsOf } from "../../../src/game/relationships.ts";
import type { RelationView } from "../../../src/game/relationships.ts";
export type { RelationView };

export interface HistoryEntry {
  day: number;
  text: string;
}

export interface ConditionInfo {
  label: string;
  blurb: string;
  tone: "bad" | "warn" | "haze";
}

export interface CrewProfile {
  id: string;
  name: string;
  role: string;
  isLeader: boolean;
  alive: boolean;
  fate?: string;
  bio: string;
  /** "Middle-aged, gaunt, wide hat": what you would notice first. */
  looks: string;
  marks: string[];
  traits: { name: string; blurb: string }[];
  health: number;
  maxHealth: number;
  nerve: number;
  trust: number;
  conditions: ConditionInfo[];
  ties: RelationView[];
  history: HistoryEntry[];
  view: MemberView;
}

export const TRAIT_INFO: Record<Trait, string> = {
  hothead: "Quick to anger and quick to swing. A brawler when a fight comes, but quarrels flare when their nerve slips.",
  kind: "Softens the room and befriends newcomers. Bad for suffering: grief and cruelty cost them more.",
  paranoid: "Reads threat into everything and is cold with strangers. Sometimes the suspicion is right.",
  greedy: "Counts the ledger twice. Good at a bargain, and the first to slip away when trust in you sinks.",
  stoic: "Takes fear in stride. Slow to lose nerve after bad nights and worse fights.",
  pious: "Steadied by prayer and ritual. Rests easier at night, and mourns harder.",
  coward: "Freezes or bolts when a fight turns. Afraid in a crisis, and less likely to land a blow.",
  veteran: "Has seen worse than this. Hits harder and holds together when the shooting starts.",
  charming: "Talks doors open. Helps in bargaining, in calming people, and in dealing with strangers.",
  sickly: "Thin and poorly by nature. Heals slower, and looks it.",
  haunted: "Feels the Haze before it comes and can forecast its advance. Frays more easily as nerve drops.",
};

const CONDITION_INFO: Record<string, ConditionInfo> = {
  dying: { label: "dying", tone: "bad", blurb: "Dies at the second nightfall unless treated. Physic and a healer can save them." },
  wounded: { label: "wounded", tone: "warn", blurb: "Hurt and slowed. Rest and a medic's care will mend it." },
  sick: { label: "sick", tone: "warn", blurb: "Fevered and weak. Heals slowly until it passes." },
  "fogsick I": { label: "fogsick I", tone: "haze", blurb: "Has breathed the Haze. Eyes have begun to catch the light." },
  "fogsick II": { label: "fogsick II", tone: "haze", blurb: "The Haze is in them. Pale, distant, and getting worse." },
  turning: { label: "turning", tone: "bad", blurb: "One more breath of it and they are lost to the Haze." },
  breaking: { label: "breaking", tone: "bad", blurb: "At the end of their nerve. Quarrels, panics and worse are close." },
  frayed: { label: "frayed", tone: "warn", blurb: "Nerves worn thin. Slower to see clearly, quicker to snap." },
};

export function conditionInfo(c: string): ConditionInfo {
  return CONDITION_INFO[c] ?? { label: c, blurb: "", tone: "warn" };
}

// ---------------------------------------------------------------- looks

const AGE_WORD = (age: number): string => (age < 14 ? "Child" : age < 30 ? "Young" : age < 48 ? "Grown" : age < 62 ? "Middle-aged" : "Elderly");

function lookLine(m: Member): { looks: string; marks: string[] } {
  const npc = m.recruited ? npcById(m.id) : undefined;
  if (npc) {
    const l = npc.look;
    const bits = [`${AGE_WORD(l.age)}`, l.build, l.clothing[0]].filter(Boolean);
    return { looks: bits.join(", "), marks: l.marks.slice() };
  }
  return { looks: "", marks: [] };
}

// ---------------------------------------------------------------- ties

function tieLabel(score: number): string {
  if (score >= 60) return "Devoted";
  if (score >= 30) return "Friends";
  if (score >= 10) return "Friendly";
  if (score > -10) return "Acquainted";
  if (score > -30) return "Strained";
  if (score > -60) return "Hostile";
  return "Sworn enemies";
}

function readTies(s: GameState, m: Member): RelationView[] {
  const out: RelationView[] = [];
  const lead = s.party.find((p) => p.isLeader);
  if (!m.isLeader && m.alive) {
    if (lead) {
      const label = m.trust >= 75 ? "Trusts you fully" : m.trust >= 50 ? "Trusts you" : m.trust >= 25 ? "Doubts you" : "Would leave you";
      out.push({ otherId: lead.id, otherName: `${lead.name} (you)`, kind: "trust", score: Math.round((m.trust - 50) * 2), label });
    }
    // The sim's own view of who they are to the others: only what the wagon-master knows.
    return [...out, ...relationsOf(s, m.id)];
  }
  for (const [key, score] of Object.entries(s.bonds)) {
    const [a, b] = key.split("|");
    if (a !== m.id && b !== m.id) continue;
    if (Math.abs(score) < 5) continue;
    const other = s.party.find((p) => p.id === (a === m.id ? b : a));
    if (!other) continue;
    // Their bond with the wagon-master is told by the trust line instead.
    if (!m.isLeader && m.alive && other.isLeader) continue;
    out.push({
      otherId: other.id,
      otherName: other.name,
      kind: other.alive ? "bond" : "lost",
      score: Math.round(score),
      label: other.alive ? tieLabel(score) : score >= 10 ? "Mourned" : "Gone",
    });
  }
  return out.sort((x, y) => (x.kind === "trust" ? -1 : y.kind === "trust" ? 1 : Math.abs(y.score) - Math.abs(x.score)));
}

// ---------------------------------------------------------------- history

/** What the client noticed happening to each person, keyed by the run's seed. */
export class Chronicle {
  private seen = new Map<string, { hp: number; nerve: number; cond: string[]; alive: boolean }>();
  private log = new Map<string, HistoryEntry[]>();
  private key = "";

  private storeKey(): string {
    return `haze.chronicle.${this.key}`;
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(this.storeKey());
      if (!raw) return;
      const d = JSON.parse(raw) as { log: Record<string, HistoryEntry[]>; seen: Record<string, { hp: number; nerve: number; cond: string[]; alive: boolean }> };
      this.log = new Map(Object.entries(d.log));
      this.seen = new Map(Object.entries(d.seen));
    } catch {
      /* private mode or a bad record: start empty */
    }
  }

  private save(): void {
    try {
      localStorage.setItem(this.storeKey(), JSON.stringify({ log: Object.fromEntries(this.log), seen: Object.fromEntries(this.seen) }));
    } catch {
      /* ignore */
    }
  }

  private note(id: string, day: number, text: string): void {
    const list = this.log.get(id) ?? [];
    if (list.some((e) => e.day === day && e.text === text)) return;
    list.push({ day, text });
    this.log.set(id, list.slice(-40));
  }

  /** Compare the party with what was seen last time and write down anything that changed. */
  observe(s: GameState): void {
    const key = `${s.seed}.${s.leaderName}`;
    if (key !== this.key) {
      this.key = key;
      this.seen = new Map();
      this.log = new Map();
      this.load();
    }
    let changed = false;
    for (const m of s.party) {
      const cond = conditionsOf(m);
      const prev = this.seen.get(m.id);
      const hp = Math.round(m.health);
      const nerve = Math.round(m.nerve);
      if (!prev) {
        if (m.recruited) this.note(m.id, s.day, "Joined the train on the road.");
        changed = true;
      } else {
        const t = (text: string) => {
          this.note(m.id, s.day, text);
          changed = true;
        };
        if (prev.alive && !m.alive) t(`Died: ${m.fate ?? "lost on the road"}.`);
        if (m.alive) {
          const added = cond.filter((c) => !prev.cond.includes(c));
          const gone = prev.cond.filter((c) => !cond.includes(c));
          for (const c of added) {
            if (c === "wounded") t("Was wounded.");
            else if (c === "sick") t("Fell sick.");
            else if (c === "dying") t("Lay dying.");
            else if (c === "breaking") t("Nerve broke.");
            else if (c === "frayed") t("Grew frayed.");
            else if (c.startsWith("fogsick")) t(`Took the Haze (${c}).`);
            else if (c === "turning") t("Began to turn.");
          }
          for (const c of gone) {
            if (c === "wounded") t("Wounds healed.");
            else if (c === "sick") t("Fever broke.");
            else if (c === "dying") t(m.alive ? "Pulled back from the brink." : "");
            else if (c === "breaking" || c === "frayed") t("Steadied.");
          }
          if (prev.hp - hp >= 20) t(`Took a bad hurt (${prev.hp - hp} health).`);
        }
      }
      const before = this.seen.get(m.id);
      if (!before || before.hp !== hp || before.nerve !== nerve || before.alive !== m.alive || before.cond.join() !== cond.join()) {
        this.seen.set(m.id, { hp, nerve, cond, alive: m.alive });
        changed = true;
      }
    }
    if (changed) this.save();
  }

  entries(id: string): HistoryEntry[] {
    return (this.log.get(id) ?? []).slice();
  }
}

function readHistory(m: Member, chronicle: Chronicle): HistoryEntry[] {
  // The sim's own record (relationships, deaths, wounds it saw) plus what the client noticed itself.
  const own = Array.isArray(m.history) ? m.history.slice() : [];
  const out = own.concat(chronicle.entries(m.id).filter((e) => !own.some((o) => o.day === e.day && o.text === e.text)));
  if (m.dying && m.dyingSince && !out.some((e) => /dying/i.test(e.text))) out.push({ day: m.dyingSince, text: "Lay dying." });
  return out.sort((x, y) => x.day - y.day);
}

// ---------------------------------------------------------------- profile

export function crewProfile(s: GameState, id: string, chronicle: Chronicle): CrewProfile | null {
  const m = s.party.find((p) => p.id === id);
  if (!m) return null;
  const view = memberView(m);
  const { looks, marks } = lookLine(m);
  const conds = m.alive ? conditionsOf(m) : [];
  return {
    id: m.id,
    name: m.name,
    role: m.role,
    isLeader: m.isLeader,
    alive: m.alive,
    fate: m.fate,
    bio: m.bio,
    looks,
    marks,
    traits: m.traits.map((t) => ({ name: t, blurb: TRAIT_INFO[t] ?? "" })),
    health: Math.round(m.health),
    maxHealth: m.maxHealth,
    nerve: Math.round(m.nerve),
    trust: Math.round(m.trust),
    conditions: conds.map(conditionInfo).map((c) => (c.label === "dying" && m.dyingSince ? { ...c, blurb: `${c.blurb} Since day ${m.dyingSince}.` } : c)),
    ties: readTies(s, m),
    history: readHistory(m, chronicle).sort((a, b) => b.day - a.day),
    view: m.alive ? view : { ...view, health: 0, conditions: [] },
  };
}

/** Everyone who has left the train: the dead and the lost. */
export function fallenViews(s: GameState): MemberView[] {
  return s.party.filter((m) => !m.alive).map((m) => ({ ...memberView(m), health: 0, conditions: [] }));
}

export function fateOf(s: GameState, id: string): string {
  return s.party.find((p) => p.id === id)?.fate ?? "lost on the road";
}

/** Nerve level where a member starts to fray, for the bar's marker. */
export const NERVE_LOW = TUNING.lowNerve;

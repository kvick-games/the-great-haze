// Spoken lines. Scene content writes `Line`s with a symbolic speaker; this module
// resolves them against the run (who is the observer? who is the stranger? is
// that NPC aboard yet?) into `SpokenLine`s a UI can stage: a real name, a mood
// and a gesture. Party lines reflect the speaker: a trait can replace the words
// (`alt`) and, when the author names no mood, colour the delivery.
//
// Resolution never touches the random stream unless a speaker is unbound, and
// the screen builder runs it on a throwaway generator, so building a screen is
// side-effect free.

import type { GameState, Gesture, Line, Member, Mood, SceneDef, SceneInstance, SpokenLine, Trait } from "./types.ts";
import type { Env } from "./effects.ts";
import { fillText, resolveWho } from "./effects.ts";
import { able, byId, firstName, hasTrait, living } from "./party.ts";
import { pickChecker } from "./checks.ts";
import { hashSeed } from "./rng.ts";
import { npcById } from "./content/npcs.ts";
import { sceneById } from "./content/scenes/index.ts";

export interface TalkCtx {
  def?: SceneDef;
  inst?: SceneInstance;
}

interface Resolved {
  id: string;
  name: string;
  kind: SpokenLine["kind"];
  traits: Trait[];
  member?: Member;
}

const STRANGER_ID = "stranger";

/** How a person sounds when the author did not say: fear, temper and calm show through. */
export function defaultMood(m: Member): Mood {
  if (m.dying) return "pleading";
  if (m.nerve < 25) return "afraid";
  if (hasTrait(m, "hothead") && m.nerve < 75) return "angry";
  if (hasTrait(m, "coward")) return "afraid";
  if (hasTrait(m, "paranoid")) return "cold";
  if (hasTrait(m, "greedy")) return "sly";
  if (hasTrait(m, "haunted") && m.nerve < 60) return "grieving";
  return "calm";
}

function asMember(m: Member | undefined): Resolved | undefined {
  return m ? { id: m.id, name: firstName(m), kind: "member", traits: m.traits, member: m } : undefined;
}

export function resolveSpeaker(env: Env, ctx: TalkCtx, who: Line["who"]): Resolved | undefined {
  const s = env.s;
  if (who === "stranger") {
    const name = ctx.def?.stranger?.name;
    return { id: STRANGER_ID, name: name ?? "The stranger", kind: "stranger", traits: [] };
  }
  if (who.startsWith("npc:")) {
    const id = who.slice(4);
    const def = npcById(id);
    const inParty = byId(s, id);
    if (inParty) return inParty.alive ? asMember(inParty) : undefined;
    if (!def) return undefined;
    return { id, name: def.name.split(" ")[0] === "Brother" ? def.name : def.name.split(" ")[0], kind: "npc", traits: def.traits };
  }
  if (who.startsWith("role:")) {
    const role = who.slice(5);
    const pool = living(s).filter((m) => m.role === role);
    const pick = pool.find((m) => !m.dying) ?? pool[0];
    return asMember(pick);
  }
  switch (who) {
    case "leader":
      return asMember(resolveWho(env, "leader")[0]);
    case "actor":
      return asMember(resolveWho(env, "actor")[0]);
    case "other":
      return asMember(resolveWho(env, "other")[0]);
    case "a":
      return asMember(resolveWho(env, "a")[0]);
    case "b":
      return asMember(resolveWho(env, "b")[0]);
    case "by":
      return asMember(byId(s, env.bind.by));
    case "observer": {
      const seen = byId(s, ctx.inst?.observer);
      if (seen?.alive) return asMember(seen);
      return asMember(pickChecker(s, "spot")?.member);
    }
  }
  return undefined;
}

/** Turn one authored line into a spoken one. Returns undefined if the speaker is absent or dead. */
export function sayLine(env: Env, ctx: TalkCtx, line: Line): SpokenLine | undefined {
  const who = resolveSpeaker(env, ctx, line.who);
  if (!who) return undefined;
  let text = line.text;
  if (line.vary?.length) {
    // Same scene, same day, same words: the pick comes from the run's seed, not its random stream.
    const pool = [line.text, ...line.vary];
    text = pool[(hashSeed(`${env.s.seed}:${env.s.day}:${ctx.def?.id ?? ""}:${line.who}:${line.text}`) >>> 0) % pool.length];
  }
  if (line.alt) {
    for (const t of who.traits) {
      const alt = line.alt[t];
      if (alt) {
        text = alt;
        break;
      }
    }
  }
  return {
    speaker: who.id,
    name: who.name,
    kind: who.kind,
    text: fillText(env, text),
    mood: line.mood ?? (who.member ? defaultMood(who.member) : "calm"),
    gesture: line.gesture ?? "none",
  };
}

export function sayLines(env: Env, ctx: TalkCtx, lines: Line[] | undefined): SpokenLine[] {
  const out: SpokenLine[] = [];
  for (const line of lines ?? []) {
    const said = sayLine(env, ctx, line);
    if (said) out.push(said);
  }
  return out;
}

// ---------------------------------------------------------------------------
// The observer's own words: what they say on noticing a tell, or on reading a face
// ---------------------------------------------------------------------------

export function tellLine(env: Env, ctx: TalkCtx, text: string, pointsTo: "genuine" | "trap" | "noise"): SpokenLine | undefined {
  return sayLine(env, ctx, {
    who: "observer",
    text,
    gesture: "point",
    mood: pointsTo === "trap" ? "cold" : pointsTo === "genuine" ? "grieving" : "afraid",
  });
}

export type Verdict = "genuine" | "trap" | "unsure";

const VERDICTS: Record<Verdict, { text: string; mood: Mood; gesture: Gesture; alt?: Partial<Record<Trait, string>> }[]> = {
  genuine: [
    { text: "No lie in it. Nobody fakes that kind of tired.", mood: "calm", gesture: "none" },
    { text: "I believe them. Look how little they're asking for.", mood: "grieving", gesture: "offer", alt: { paranoid: "I think it's real. I'd still watch the trees." } },
    { text: "That's honest. I'd stake a ration on it.", mood: "calm", gesture: "none", alt: { greedy: "It's real. Which is a shame for the ration." } },
  ],
  trap: [
    { text: "Something's off. The story has a hole in it.", mood: "cold", gesture: "point" },
    { text: "Too tidy. Too eager. I don't like any of it.", mood: "cold", gesture: "turn-away", alt: { kind: "I hate to say it. This is a lie." } },
    { text: "They're lying. I can't say how. I just know.", mood: "afraid", gesture: "point", alt: { veteran: "I've seen this play before. It's a lie." } },
  ],
  unsure: [
    { text: "Can't tell. It could go either way.", mood: "afraid", gesture: "shrug" },
    { text: "I want to believe it. That's not the same as knowing.", mood: "grieving", gesture: "shrug" },
    { text: "Nothing I can put a finger on. Nothing at all.", mood: "afraid", gesture: "shrug", alt: { coward: "I don't know. Can we just... decide?" } },
  ],
};

/** What the reader says. `pick` is a number in [0, 1) from the run's generator. */
export function verdictLine(env: Env, ctx: TalkCtx, verdict: Verdict, pick: number): SpokenLine | undefined {
  const pool = VERDICTS[verdict];
  const v = pool[Math.min(pool.length - 1, Math.floor(pick * pool.length))];
  return sayLine(env, ctx, { who: "by", text: v.text, mood: v.mood, gesture: v.gesture, alt: v.alt });
}

// ---------------------------------------------------------------------------
// Companion beats
// ---------------------------------------------------------------------------

/** Companions whose complication is due today: aboard for `afterDays`, not yet played. */
export function dueComplications(s: GameState): { id: string; actor: string }[] {
  const out: { id: string; actor: string }[] = [];
  for (const m of able(s)) {
    const def = m.recruited ? npcById(m.id) : undefined;
    if (!def) continue;
    const joined = s.flags[`joined:${m.id}`];
    if (joined === undefined) continue;
    if (s.day - joined < def.complication.afterDays) continue;
    if (s.used.includes(def.complication.scene)) continue;
    if (!sceneById(def.complication.scene)) continue;
    out.push({ id: def.complication.scene, actor: m.id });
  }
  return out;
}

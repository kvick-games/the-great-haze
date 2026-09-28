// The static content graph: every scene x option x outcome the game can produce,
// with what each outcome does to the people in it read straight off the effect
// data. It is what the offline (pre-baked) path enumerates, and it gives runtime
// beats the same template key as their pre-baked twin so a baked clip can be found.

import { ENEMIES } from "../game/content/enemies.ts";
import { SCENES } from "../game/content/scenes/index.ts";
import type { Amount } from "../game/rng.ts";
import type { Effect, Outcome, SceneDef, SceneKind, Who } from "../game/types.ts";

export type TruthKey = "genuine" | "trap" | "any";

/** What an outcome's effects do, in terms a story cares about. */
export interface EffectFacts {
  kills: string[];
  leaves: { who: string; cause: string }[];
  woundsOrHurts: string[];
  sick: string[];
  fog: string[];
  cures: string[];
  recruits: boolean;
  combat: string | null;
  followUps: string[];
  wagonLoss: boolean;
  ending: string | null;
}

export interface StaticBeat {
  /** `scene.<id>.intro`, `<scene>.<option>.<truth>.o<idx>`, or `combat.<enemy>.<stage>`. */
  templateKey: string;
  sceneId: string | null;
  sceneKind: SceneKind | "combat";
  title: string;
  optionId: string | null;
  optionLabel: string | null;
  truth: TruthKey | null;
  index: number;
  /** Raw text with {placeholders} intact. */
  text: string;
  facts: EffectFacts;
  /** Who takes part, as placeholders the baker fills from a stand-in cast. */
  cast: string[];
  /** Mutation kinds this outcome will cause, so the baker can size shots. */
  predicts: string[];
}

export interface StaticEdge {
  from: string;
  to: string;
  label: string;
}

export interface StaticGraph {
  beats: StaticBeat[];
  edges: StaticEdge[];
}

const magnitude = (a: Amount): number => (typeof a === "number" ? a : Math.max(Math.abs(a[0]), Math.abs(a[1])));
const low = (a: Amount): number => (typeof a === "number" ? a : Math.min(a[0], a[1]));

export function whoLabel(w: Who): string {
  if (typeof w === "string") return w;
  if ("first" in w) return w.first.map(whoLabel)[0] ?? "actor";
  if ("role" in w) return `role:${w.role}`;
  return `trait:${w.trait}`;
}

export function factsOf(effects: Effect[] | undefined): EffectFacts {
  const f: EffectFacts = { kills: [], leaves: [], woundsOrHurts: [], sick: [], fog: [], cures: [], recruits: false, combat: null, followUps: [], wagonLoss: false, ending: null };
  for (const e of effects ?? []) {
    switch (e.t) {
      case "kill":
        f.kills.push(whoLabel(e.who));
        break;
      case "leave":
        f.leaves.push({ who: whoLabel(e.who), cause: e.cause ?? "left the train" });
        break;
      case "hp":
        if (low(e.d) < 0 && magnitude(e.d) >= 1) f.woundsOrHurts.push(whoLabel(e.who));
        break;
      case "status":
        if (e.s === "wounded") f.woundsOrHurts.push(whoLabel(e.who));
        else if (e.s === "sick") f.sick.push(whoLabel(e.who));
        else f.fog.push(whoLabel(e.who));
        break;
      case "cure":
        f.cures.push(whoLabel(e.who));
        break;
      case "recruit":
        f.recruits = true;
        break;
      case "combat":
        f.combat = e.enemy;
        break;
      case "scene":
        f.followUps.push(e.id);
        break;
      case "wagons":
        if (e.d < 0) f.wagonLoss = true;
        break;
      case "end":
        f.ending = e.kind;
        break;
      default:
        break;
    }
  }
  return f;
}

/** Stand-ins for placeholder roles when a clip is baked without a real run. */
export const BAKE_CAST: Record<string, string> = {
  leader: "leader",
  actor: "cutter",
  other: "dov",
  a: "ines",
  b: "odalys",
  stranger: "archetype.stranger",
  recruit: "mattie",
};

function castOf(facts: EffectFacts, text: string, sceneKind: string): string[] {
  const out = new Set<string>(["leader"]);
  const mentions = (k: string) => text.includes(`{${k}}`);
  for (const k of ["actor", "other", "a", "b"]) if (mentions(k)) out.add(k);
  const sel = [...facts.kills, ...facts.leaves.map((l) => l.who), ...facts.woundsOrHurts, ...facts.sick, ...facts.fog, ...facts.cures];
  for (const w of sel) if (w === "actor" || w === "other" || w === "a" || w === "b") out.add(w);
  if (sel.some((w) => !["leader", "actor", "other", "a", "b", "all", "others"].includes(w))) out.add("actor");
  if (sceneKind === "stranger") out.add("stranger");
  if (facts.recruits) out.add("recruit");
  return [...out];
}

function predictKinds(f: EffectFacts): string[] {
  const k: string[] = [];
  if (f.kills.length) k.push("death");
  for (const l of f.leaves) k.push(/turned/i.test(l.cause) ? "turning" : "departure");
  if (f.woundsOrHurts.length) k.push("wound");
  if (f.fog.length) k.push("fog");
  if (f.sick.length) k.push("sick");
  if (f.cures.length) k.push("heal");
  if (f.recruits) k.push("join");
  if (f.wagonLoss) k.push("wagons");
  if (f.combat) k.push("combat");
  return [...new Set(k)];
}

/** Every outcome group that can apply to an option, tagged by which truth it answers. */
function groups(res: SceneDef["options"][number]["results"]): [TruthKey, Outcome[]][] {
  const out: [TruthKey, Outcome[]][] = [];
  for (const k of ["genuine", "trap", "any"] as const) {
    const g = res[k];
    if (g && g.length) out.push([k, g]);
  }
  return out;
}

export function enumerateStaticGraph(scenes: SceneDef[] = SCENES): StaticGraph {
  const beats: StaticBeat[] = [];
  const edges: StaticEdge[] = [];
  for (const sc of scenes) {
    const introText = sc.intro.join(" ");
    beats.push({
      templateKey: `scene.${sc.id}.intro`,
      sceneId: sc.id,
      sceneKind: sc.kind,
      title: sc.title,
      optionId: null,
      optionLabel: null,
      truth: null,
      index: 0,
      text: introText,
      facts: factsOf([]),
      cast: sc.kind === "stranger" ? ["leader", "stranger"] : ["leader"],
      predicts: [],
    });
    for (const opt of sc.options) {
      for (const [truth, list] of groups(opt.results)) {
        list.forEach((oc, index) => {
          const facts = factsOf(oc.fx);
          const key = `${sc.id}.${opt.id}.${truth}.o${index}`;
          beats.push({
            templateKey: key,
            sceneId: sc.id,
            sceneKind: sc.kind,
            title: sc.title,
            optionId: opt.id,
            optionLabel: opt.label,
            truth,
            index,
            text: oc.text,
            facts,
            cast: castOf(facts, oc.text, sc.kind),
            predicts: predictKinds(facts),
          });
          edges.push({ from: `scene.${sc.id}.intro`, to: key, label: opt.id });
          for (const next of facts.followUps) edges.push({ from: key, to: `scene.${next}.intro`, label: "then" });
          if (facts.combat) edges.push({ from: key, to: `combat.${facts.combat}.intro`, label: "combat" });
        });
      }
    }
  }
  for (const en of Object.values(ENEMIES)) {
    for (const stage of ["intro", "win", "fled"] as const) {
      const text = stage === "intro" ? en.intro : stage === "win" ? en.win : en.fled;
      beats.push({
        templateKey: `combat.${en.id}.${stage}`,
        sceneId: null,
        sceneKind: "combat",
        title: en.name,
        optionId: null,
        optionLabel: null,
        truth: null,
        index: 0,
        text,
        facts: factsOf([]),
        cast: ["leader", `enemy:${en.id}`],
        predicts: stage === "intro" ? ["combat"] : [],
      });
      if (stage !== "intro") edges.push({ from: `combat.${en.id}.intro`, to: `combat.${en.id}.${stage}`, label: stage });
    }
  }
  return { beats, edges };
}

// ---------------------------------------------------------------------------
// Matching a live outcome back to its static twin
// ---------------------------------------------------------------------------

const rxCache = new Map<string, RegExp>();

function textPattern(raw: string): RegExp {
  let rx = rxCache.get(raw);
  if (!rx) {
    const esc = raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\{[a-zA-Z]+\\\}/g, ".+?");
    rx = new RegExp(`^${esc}$`, "s");
    rxCache.set(raw, rx);
  }
  return rx;
}

/** Which outcome of an option produced this text? -1 when it cannot be told. */
export function matchOutcome(sceneId: string, optionId: string, truth: string, lines: string[]): number {
  const sc = SCENES.find((s) => s.id === sceneId);
  const opt = sc?.options.find((o) => o.id === optionId);
  if (!opt) return -1;
  const list = (truth === "genuine" || truth === "trap" ? opt.results[truth] : undefined) ?? opt.results.any ?? [];
  for (let i = 0; i < list.length; i++) {
    const rx = textPattern(list[i].text);
    if (lines.some((l) => rx.test(l))) return i;
  }
  return -1;
}

/** Which truth group applies? Mirrors the engine: a scene with no truth uses `any`. */
export function truthGroup(sceneId: string, optionId: string, truth: string): TruthKey {
  const opt = SCENES.find((s) => s.id === sceneId)?.options.find((o) => o.id === optionId);
  if (!opt) return "any";
  if ((truth === "genuine" || truth === "trap") && opt.results[truth]?.length) return truth;
  return "any";
}

// A story beat plus the world as of that beat becomes a shot request: the prompt, the
// reference images that keep the people consistent, and the numbers the video model
// needs. The cache key covers the beat's template and each participant's visual
// version, so an identical situation with identical-looking people is generated once.

import { BAKE_CAST } from "./catalog.ts";
import type { StaticBeat } from "./catalog.ts";
import { baseLook, characterSpecs, environmentSpecs, lookDescription, lookLabel, PROPS, slotKeyFor, visualText } from "./characters.ts";
import type { CharacterSpec } from "./characters.ts";
import { etherId, fnv1a, stableStringify } from "./datoms.ts";
import type { DatomLog } from "./datoms.ts";
import { DEFAULTS, FIELDS, LIMITS, MODELS, estimateUsd } from "./videoconfig.ts";
import type { Resolution, ShotMode } from "./videoconfig.ts";
import { lookFromLog, visualFromLog } from "./mutations.ts";
import type { Beat, BeatKind } from "./mutations.ts";

export interface ShotParticipant {
  key: string;
  name: string;
  datom_id: string;
  version: number;
  slot: string;
  label: string;
}

export interface ShotReference {
  datom_id: string;
  slot_key: string;
  character: string;
  label: string;
}

export interface ShotRequest {
  /** Specific: the template plus who is in it and how they look. Stable. */
  cacheKey: string;
  /** Generic: the template alone. Pre-baked clips are indexed by this. */
  templateKey: string;
  beatId: string;
  mode: ShotMode;
  service_id: string;
  endpoint: string;
  prompt: string;
  references: ShotReference[];
  participants: ShotParticipant[];
  /** Integer seconds, 5 to 15. Sent as the `duration` field. */
  duration: number;
  aspect_ratio: string;
  resolution: Resolution;
  seed: number | null;
  estimated_usd: number;
  /** Short on-screen caption for placeholders and debug. */
  title: string;
  summary: string;
}

export interface ShotOptions {
  specs?: CharacterSpec[];
  resolution?: Resolution;
  aspectRatio?: string;
  mode?: ShotMode;
  seed?: number | null;
  priceMultiplier?: number;
}

let cachedSpecs: CharacterSpec[] | null = null;
const defaultSpecs = (): CharacterSpec[] => (cachedSpecs ??= characterSpecs());

export const CAMERA: Record<BeatKind, string> = {
  death: "Slow push-in on the face, then a wide, still shot of the place where they fell; no music sting, just wind.",
  turning: "Static close-up on the eyes as the colour changes, then a wide shot as the others draw back.",
  departure: "Long lens from behind, a lone figure walking away toward the horizon while the train watches.",
  join: "Medium two-shot, the newcomer stepping into the torchlight beside the wagon-master.",
  muster: "Slow pan along the line of people waiting beside the wagons at dusk.",
  injury: "Handheld medium shot, the moment of the wound, then a close look at the aftermath.",
  haze: "Slow dolly toward a face lit red, fog creeping across the ground at knee height.",
  combat: "Handheld, fast but readable, muzzle flash and torchlight, cutting between the train and what comes out of the dark.",
  encounter: "Over-the-shoulder shot from the wagon-master, tension held on the stranger's face.",
  hardship: "Slow tracking shot along the caravan, thin faces, empty hands, canvas hanging loose.",
  camp: "Wide shot of the ring of torches around the wagons, then a slow push toward the fire.",
  road: "Side-on tracking shot of the whole caravan against a red-stained sky.",
  trade: "Medium shot across a counter in lantern light.",
  ending: "Slow crane up and away from the train.",
  quiet: "Slow tracking shot of the caravan.",
};

const DURATION: Record<string, number> = { "life-altering": 8, notable: 6, minor: 5, quiet: 5 };

export function clampDuration(n: number): number {
  return Math.max(LIMITS.minDuration, Math.min(LIMITS.maxDuration, Math.round(n)));
}

function envText(day: number, region: string): string {
  const key = day === 0 ? "cinder-ford" : `region.${region}`;
  return environmentSpecs().find((e) => e.key === key)?.description ?? "";
}

function propName(key: string): string {
  return PROPS[key]?.name.toLowerCase() ?? key;
}

interface Resolved {
  spec: CharacterSpec;
  version: number;
  slot: string;
  label: string;
  look: string;
}

/** Choose the reference slots. The current variant identifies the look; the base sheet keeps the face. */
function pickReferences(list: Resolved[]): ShotReference[] {
  const refs: ShotReference[] = [];
  const add = (r: Resolved, slot: string, label: string) => {
    if (refs.length >= LIMITS.maxReferenceImages) return;
    const datom_id = etherId("char", r.spec.key);
    if (refs.some((x) => x.datom_id === datom_id && x.slot_key === slot)) return;
    refs.push({ datom_id, slot_key: slot, character: r.spec.key, label });
  };
  for (const r of list) add(r, r.slot, r.version > 1 ? `${r.spec.name}, ${r.label}` : r.spec.name);
  // Variants alone can lose the face, so the base hero rides along for anyone drawn differently.
  for (const r of list) if (r.version > 1) add(r, "hero", `${r.spec.name}, base look`);
  for (const r of list.slice(0, 3)) add(r, "character_sheet", `${r.spec.name}, character sheet`);
  return refs;
}

function composePrompt(input: { title: string; kind: BeatKind; resolved: Resolved[]; refs: ShotReference[]; action: string; setting: string; notes: string[] }): string {
  const lines: string[] = [];
  lines.push("Cinematic dark frontier horror, 24 fps, filmic grain, torchlight and dusk under a sky stained red by the Haze.");
  for (const r of input.resolved) {
    const idx = input.refs.findIndex((x) => x.character === r.spec.key);
    const refNote = idx >= 0 ? ` (Image ${idx + 1})` : "";
    const change = r.look ? ` Right now: ${r.look}.` : "";
    lines.push(`${r.spec.name}${refNote}: ${visualText(r.spec.visual)}.${change}`);
  }
  if (input.setting) lines.push(`Setting: ${input.setting}`);
  lines.push(`What happens: ${input.action}`);
  if (input.notes.length) lines.push(`Show clearly: ${input.notes.join(" ")}`);
  lines.push(`Camera: ${CAMERA[input.kind]}`);
  lines.push("Keep every named person exactly as their reference images show. No text, captions or subtitles.");
  return lines.join("\n");
}

function build(args: {
  templateKey: string;
  beatId: string;
  kind: BeatKind;
  title: string;
  stakes: string;
  resolved: Resolved[];
  action: string;
  notes: string[];
  day: number;
  region: string;
  opts: ShotOptions;
}): ShotRequest {
  const { opts } = args;
  const mode = opts.mode ?? DEFAULTS.mode;
  const resolution = opts.resolution ?? DEFAULTS.resolution;
  const aspect = opts.aspectRatio ?? DEFAULTS.aspectRatio;
  const refs = mode === "reference" ? pickReferences(args.resolved) : [];
  const duration = clampDuration(DURATION[args.stakes] ?? 5);
  const prompt = composePrompt({ title: args.title, kind: args.kind, resolved: args.resolved, refs, action: args.action, setting: envText(args.day, args.region), notes: args.notes });
  const participants: ShotParticipant[] = args.resolved.map((r) => ({ key: r.spec.key, name: r.spec.name, datom_id: etherId("char", r.spec.key), version: r.version, slot: r.slot, label: r.label }));
  const route = MODELS[mode];
  const hashInput = stableStringify({ t: args.templateKey, p: participants.map((p) => `${p.key}@v${p.version}`), e: route.endpoint, r: resolution, d: duration, a: aspect, s: opts.seed ?? null });
  return {
    cacheKey: `${args.templateKey}#${fnv1a(hashInput)}`,
    templateKey: args.templateKey,
    beatId: args.beatId,
    mode,
    service_id: route.service_id,
    endpoint: route.endpoint,
    prompt,
    references: refs,
    participants,
    duration,
    aspect_ratio: aspect,
    resolution,
    seed: opts.seed ?? null,
    estimated_usd: estimateUsd(duration, resolution, opts.priceMultiplier),
    title: args.title,
    summary: args.action,
  };
}

/** A live beat, using each participant's look as of the beat's own tx. */
export function shotForBeat(beat: Beat, log: DatomLog, opts: ShotOptions = {}): ShotRequest {
  const specs = opts.specs ?? defaultSpecs();
  const resolved: Resolved[] = [];
  for (const key of beat.participants) {
    const spec = specs.find((s) => s.key === key);
    if (!spec) continue;
    const tx = beat.tx || undefined;
    const look = key.startsWith("archetype.") ? null : lookFromLog(log, key, tx);
    const vis = key.startsWith("archetype.") ? { version: 1, slot: "hero", label: "base" } : visualFromLog(log, key, tx);
    const base = spec.kit;
    resolved.push({ spec, version: vis.version, slot: vis.slot, label: vis.label, look: look ? lookDescription(look, propName, base) : "" });
  }
  const notes = beat.mutations.filter((m) => m.kind !== "look" && m.kind !== "region").map((m) => m.summary);
  const action = beat.sceneId && beat.text.length ? beat.text.join(" ") : notes.length ? notes.join(" ") : beat.text.length ? beat.text.join(" ") : beat.title;
  return build({ templateKey: beat.templateKey, beatId: beat.id, kind: beat.kind, title: beat.title, stakes: beat.stakes, resolved, action, notes, day: beat.day, region: beat.region, opts });
}

function kindForStatic(sb: StaticBeat): BeatKind {
  const p = sb.predicts;
  if (p.includes("death")) return "death";
  if (p.includes("turning")) return "turning";
  if (p.includes("departure")) return "departure";
  if (p.includes("join")) return "join";
  if (p.includes("wound")) return "injury";
  if (p.includes("fog")) return "haze";
  if (p.includes("combat") || sb.sceneKind === "combat") return "combat";
  if (sb.sceneKind === "haze") return "haze";
  if (sb.sceneKind === "hazard" || sb.sceneKind === "crisis") return "hardship";
  return "encounter";
}

function stakesForStatic(sb: StaticBeat): string {
  if (sb.predicts.some((k) => ["death", "turning", "departure", "join"].includes(k))) return "life-altering";
  if (sb.predicts.length || sb.sceneKind === "combat") return "notable";
  return sb.templateKey.endsWith(".intro") ? "quiet" : "minor";
}

export function fillCast(text: string, specs: CharacterSpec[]): string {
  return text.replace(/\{([a-z]+)\}/g, (_, k: string) => {
    const key = BAKE_CAST[k];
    if (!key) return "someone";
    if (k === "leader") return specs.find((s) => s.key === "leader")?.name ?? "the wagon-master";
    return specs.find((s) => s.key === key)?.name ?? "someone";
  });
}

/** A static (pre-bakeable) beat, drawn with a fixed stand-in cast so the clips are generic and reusable. */
export function shotForStatic(sb: StaticBeat, opts: ShotOptions = {}): ShotRequest {
  const specs = opts.specs ?? defaultSpecs();
  const resolved: Resolved[] = [];
  for (const c of sb.cast) {
    const key = c.startsWith("enemy:") ? `archetype.${c === "enemy:hollowed-pack" || c === "enemy:hollowed-single" ? "hollowed" : c.slice(6)}` : (BAKE_CAST[c] ?? c);
    const spec = specs.find((s) => s.key === key);
    if (!spec || resolved.some((r) => r.spec.key === spec.key)) continue;
    resolved.push({ spec, version: 1, slot: "hero", label: lookLabel(baseLook(spec.kit), spec.kit), look: "" });
  }
  void slotKeyFor;
  const kind = kindForStatic(sb);
  const action = `${fillCast(sb.text, specs)}`;
  const notes = sb.predicts.map((k) => `the ${k} outcome`);
  return build({ templateKey: sb.templateKey, beatId: sb.templateKey, kind, title: sb.title, stakes: stakesForStatic(sb), resolved, action, notes, day: 1, region: regionForScene(sb), opts });
}

function regionForScene(sb: StaticBeat): string {
  const table: Record<string, string> = { landmark: "flats", haze: "fen" };
  return table[sb.sceneKind] ?? "tallow";
}

// ---------------------------------------------------------------------------
// Request bodies
// ---------------------------------------------------------------------------

/** The fal request body. `urls` maps "datom_id:slot_key" to a hosted (or data:) image URL. */
export function toFalBody(req: ShotRequest, urls: Record<string, string> = {}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    [FIELDS.prompt]: req.prompt,
    [FIELDS.duration]: req.duration,
    [FIELDS.resolution]: req.resolution,
    [FIELDS.aspectRatio]: req.aspect_ratio,
    [FIELDS.promptExpansion]: DEFAULTS.promptExpansion,
    [FIELDS.safetyChecker]: DEFAULTS.safetyChecker,
  };
  if (req.seed !== null && req.seed >= 0) body[FIELDS.seed] = req.seed;
  if (req.mode === "reference") {
    body[FIELDS.referenceImages] = req.references.map((r) => urls[`${r.datom_id}:${r.slot_key}`]).filter((u): u is string => !!u);
  }
  return body;
}

/** The same shot as Hyperlab's ShotObjectV1, for the shot-compiler path (schema: GET /api/shot-compiler/schema). */
export interface ShotObjectV1 {
  id: string;
  title: string;
  duration_seconds: number;
  cast: string[];
  environment: string;
  action: string;
  camera: string;
  opening_state: string;
  ending_state: string;
  dialogue: string[];
  sound: string;
  continuity: string;
}

export interface ShotSceneV1 {
  id: string;
  revision: number;
  title: string;
  situation: string;
  bindings: Record<string, string>;
  shots: ShotObjectV1[];
}

export function toShotObject(req: ShotRequest, beat: Beat): ShotObjectV1 {
  const done = beat.mutations.filter((m) => m.kind !== "look" && m.kind !== "region").map((m) => m.summary);
  return {
    id: beat.id,
    title: beat.title,
    duration_seconds: req.duration,
    cast: req.participants.map((p) => p.key),
    environment: envText(beat.day, beat.region),
    action: req.summary,
    camera: CAMERA[beat.kind],
    opening_state: `Day ${beat.day}, ${beat.region}. ${req.participants.map((p) => `${p.name} (${p.label} v${p.version})`).join("; ")}.`,
    ending_state: done.length ? done.join(" ") : "The train carries on.",
    dialogue: [],
    sound: "Wind, the creak of wagons, torches guttering; no score.",
    continuity: req.participants.map((p) => `${p.name} keeps the ${p.slot} look`).join("; "),
  };
}

export function toShotScene(id: string, title: string, situation: string, reqs: { req: ShotRequest; beat: Beat }[]): ShotSceneV1 {
  const bindings: Record<string, string> = {};
  for (const { req } of reqs) for (const p of req.participants) bindings[p.key] = p.datom_id;
  return { id, revision: 1, title, situation, bindings, shots: reqs.map(({ req, beat }) => toShotObject(req, beat)) };
}

// Reference sheets: which still images each character needs so a video model can keep
// them consistent, per visual version. The first draft of each is a prompt for a
// text-to-image model; a person (or Hyperlab) approves the result and it becomes the
// slot's asset. Nothing here calls a network.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CHARACTER_SLOTS, etherId } from "../../src/story/datoms.ts";
import { characterSpecs, lookDescription, lookFromSignature, lookLabel, PROPS, slotKeyFor, visualText } from "../../src/story/characters.ts";
import type { CharacterSpec, CharacterSpecOptions } from "../../src/story/characters.ts";
import { ATTR, charEntity } from "../../src/story/mutations.ts";
import type { DatomLog, Json } from "../../src/story/datoms.ts";
import type { ShotReference } from "../../src/story/shots.ts";

export interface RefNeed {
  datom_id: string;
  character: string;
  name: string;
  version: number;
  slot_key: string;
  /** Path of the approved still, relative to the refs directory. */
  file: string;
  prompt: string;
  purpose: string;
  /** For a later look: just what differs from the base, as an image-edit instruction. */
  change?: string;
}

const BASE_SLOTS = ["hero", "front_view", "three_quarter", "character_sheet"] as const;

const SLOT_FRAMING: Record<string, string> = {
  hero: "three-quarter portrait, waist up, dramatic torchlight",
  front_view: "full body, facing the camera, neutral stance",
  three_quarter: "full body, three-quarter view",
  character_sheet: "character sheet: front, side and back views on one plain background",
};

const STYLE = "Grim frontier horror concept art, painterly, muted period costume, plain dark background, consistent face and build across every image of this character.";

export function refFile(datom_id: string, slot_key: string): string {
  return `${datom_id}/${slot_key.replace(/[\\/]/g, "__")}.png`;
}

function propName(k: string): string {
  return PROPS[k]?.name.toLowerCase() ?? k;
}

function needFor(spec: CharacterSpec, version: number, slot_key: string, look: ReturnType<typeof lookFromSignature> | null, purpose: string): RefNeed {
  const datom_id = etherId("char", spec.key);
  const change = look ? lookDescription(look, propName, spec.kit) : "";
  const framing = SLOT_FRAMING[slot_key] ?? "full body, three-quarter view";
  return {
    datom_id,
    character: spec.key,
    name: spec.name,
    version,
    slot_key,
    file: refFile(datom_id, slot_key),
    prompt: `${STYLE} ${spec.name}: ${visualText(spec.visual)}.${change ? ` This version: ${change}.` : ""} ${framing}.`,
    purpose,
    ...(change ? { change } : {}),
  };
}

/** The base sheet for each of these characters (v1), for pre-baking with a fixed cast. */
export function baseSheets(keys: string[], opts: CharacterSpecOptions = {}): RefNeed[] {
  const specs = characterSpecs(opts);
  const out: RefNeed[] = [];
  for (const key of keys) {
    const spec = specs.find((s) => s.key === key);
    if (!spec) continue;
    for (const slot of BASE_SLOTS) out.push(needFor(spec, 1, slot, null, "base sheet"));
  }
  return out;
}

/** Every look a run has needed, from its log: the base sheet plus one still per later version. */
export function runSheets(log: DatomLog, opts: CharacterSpecOptions = {}): RefNeed[] {
  const specs = characterSpecs(opts);
  const out: RefNeed[] = [];
  for (const e of log.entities()) {
    if (!e.startsWith("char:")) continue;
    const key = e.slice(5);
    const spec = specs.find((s) => s.key === key);
    if (!spec) continue;
    for (const slot of BASE_SLOTS) out.push(needFor(spec, 1, slot, null, "base sheet"));
    const sigs = log.get(charEntity(key), ATTR.sigs) as Json | undefined;
    if (!Array.isArray(sigs)) continue;
    sigs.forEach((sig, i) => {
      const version = i + 1;
      if (version === 1) return;
      const look = lookFromSignature(String(sig));
      const slot = slotKeyFor(lookLabel(look, spec.kit), version);
      out.push(needFor(spec, version, slot, look, `look v${version}`));
    });
  }
  return out;
}

export function slotsCovered(): readonly string[] {
  return CHARACTER_SLOTS;
}

/**
 * Read approved stills from disk as data: URIs, keyed "datom_id:slot_key". Anything missing
 * is simply absent, and the caller falls back to text-to-video. A refs directory is optional.
 */
export function loadReferenceUrls(refs: ShotReference[], dir: string, maxBytes = 6 * 1024 * 1024): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of refs) {
    for (const ext of ["png", "jpg", "jpeg", "webp"]) {
      const file = join(dir, refFile(r.datom_id, r.slot_key).replace(/\.png$/, `.${ext}`));
      if (!existsSync(file)) continue;
      const buf = readFileSync(file);
      if (buf.length > maxBytes) continue;
      const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      out[`${r.datom_id}:${r.slot_key}`] = `data:${mime};base64,${buf.toString("base64")}`;
      break;
    }
  }
  return out;
}

// Write an H3 manifest for a scenario, in the shape Hyperlab's apply_h3_manifest.ps1 reads:
//   project_id, graph_id, service_id, prompt_guide{service_id,guide_id,revision,fingerprint},
//   common{...params for every shot}, shots[{node_id,label,x,y,input_images[],reference_video,
//   ref_image_size,prompt_lines[],overrides{...}}].
// Recurring characters are stored as datom slot references (`references`), the source of truth;
// `input_images` is filled from them at export time once the slots have approved images.
// Placeholders ({{...}}) stand for ids that only exist after the project is registered.
//
//   node tools/video/h3-manifest.ts --scenario stranger-trap [--out artifacts/video/scenarios]

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SCENARIOS } from "./scenarios/defs.ts";
import { MAX_NAMED, buildScenario, selectRefs } from "./scenarios/build.ts";
import type { Scenario, Segment } from "./scenarios/build.ts";
import { CAMERA } from "../../src/story/shots.ts";
import type { ShotRequest } from "../../src/story/shots.ts";
import type { Beat, BeatKind } from "../../src/story/mutations.ts";
import { parseArgs } from "./args.ts";

export const H3 = {
  r2v: "comfy-workflows/MiniMax_H3_R2V",
  t2i: "comfy-workflows/MiniMax_H3_T2I",
  imageEdit: "comfy-workflows/qwen_image_2_1_image_edit",
  qwenT2i: "comfy-workflows/qwen_image_2_1_text_to_image",
  /** The worker the coordinator named; jobs are pinned to it at run time, not in the manifest. */
  workerId: "lucifer-comfy",
} as const;

/** Sized for a 12 GiB card (RTX 3080 Ti). Hyperlab overlays the Turbo profile on 12-16 GiB workers by itself. */
export const LUCIFER = { width: 864, height: 480, minSeconds: 5, maxSeconds: 8 } as const;

const SOUND: Partial<Record<BeatKind, string>> & { default: string } = {
  default: "wind over dry grass, creak of wagon wheels, the low pressure hum of the Haze",
  death: "wind, a fire ticking low, someone breathing hard and then not, the hum of the Haze",
  turning: "wind dropping away, a fire ticking, a wet breath, the hum of the Haze rising",
  combat: "gunshots, shouted orders, oxen bellowing, boots on gravel",
  camp: "crackle of a campfire, the murmur of tired people, distant fog-wind",
  haze: "a low, wrong hum, muffled footsteps, fabric brushing skin",
  join: "wheels, harness, a stranger's careful footsteps, wind",
  injury: "a sharp cry, hurried boots, cloth tearing, breath",
};

const MUSIC: Partial<Record<BeatKind, string>> & { default: string } = {
  default: "none",
  death: "none",
  turning: "a single held low string note",
  haze: "a slow, detuned drone",
  combat: "none",
};

export interface H3Shot {
  node_id: string;
  label: string;
  x: number;
  y: number;
  /** Datom slot references: the source of truth. */
  references: { datom_id: string; slot_key: string; label: string }[];
  /** Image paths or asset ids resolved from the references at export time, in reference order. */
  input_images: string[];
  reference_video: string;
  ref_image_size: string;
  prompt_lines: string[];
  overrides: { duration: number; seed: number };
  /** Filled in by Hyperlab after a job is accepted, never by us. */
  accepted_job_id?: string;
  /** Not read by Hyperlab's scripts: what this shot is for. */
  meta: { beat: string; kind: string; stakes: string; template_key: string; cache_key: string; mutations: string[] };
}

export interface H3Manifest {
  project_id: string;
  graph_id: string;
  service_id: string;
  prompt_guide: { service_id: string; guide_id: string; revision: string; fingerprint: string };
  common: Record<string, unknown>;
  shots: H3Shot[];
  /** Ignored by Hyperlab's scripts. */
  x_great_haze: { scenario: string; segment: string; execution_target_id: string; note: string };
}

/** Speech lines in the game's own words: text in straight or curly double quotes. */
export function dialogueOf(text: string[]): string[] {
  const out: string[] = [];
  for (const line of text) for (const m of line.matchAll(/["“]([^"”]{3,140})["”]/g)) out.push(m[1].trim());
  return out.slice(0, 2);
}

function without(quoted: string): string {
  return quoted.replace(/["“][^"”]*["”]/g, "").replace(/\s{2,}/g, " ").trim();
}

function field(prompt: string, prefix: string): string {
  const line = prompt.split("\n").find((l) => l.startsWith(prefix));
  return line ? line.slice(prefix.length).trim() : "";
}

/**
 * The shot prompt in the integrated_multimodal_description form the H3 guide asks for.
 * One shot per clip (5 to 8 seconds is one continuous shot). Named people carry their
 * reference image number so the model binds the face to the right slot.
 */
export function h3Prompt(req: ShotRequest, beat: Beat, refs = selectRefs(req)): string[] {
  const named = new Set(req.references.map((r) => r.character));
  const cast: string[] = [];
  for (const p of req.participants) {
    const line = req.prompt.split("\n").find((l) => l.startsWith(`${p.name} `) || l.startsWith(`${p.name}:`));
    if (!line) continue;
    const idx = refs.findIndex((r) => r.character === p.key);
    if (idx < 0 && (!named.has(p.key) || cast.length >= MAX_NAMED)) continue;
    const body = line.replace(/\s+/g, " ").replace(/^[^:]+(\(Image \d+\))?:/, "").trim();
    cast.push(`${p.name}${idx >= 0 ? ` (Image ${idx + 1})` : ""}:${body.startsWith(" ") ? "" : " "}${body}`);
  }
  const setting = field(req.prompt, "Setting:");
  const happens = without(field(req.prompt, "What happens:"))
    .split(/(?<=[.!?])\s+/)
    .filter((sent) => !/^(You cover \d+ miles|Stops and delays|The Haze advances|The gap is)/.test(sent))
    .join(" ");
  const show = field(req.prompt, "Show clearly:");
  const say = dialogueOf(beat.text);
  const speech = say.map((s) => `<d>[English] ${s}</d>`).join(" ");
  const shot = [CAMERA[beat.kind], setting, ...cast, happens, show && !happens.includes(show) ? `Show clearly: ${show}` : "", speech, "Keep every named person exactly as in their reference images."]
    .filter(Boolean)
    .join(" ");
  return ["integrated_multimodal_description:", `[Shot 1] ${shot}`, `overall_soundscape: ${SOUND[beat.kind] ?? SOUND.default}`, `non_diegetic_music: ${MUSIC[beat.kind] ?? MUSIC.default}`];
}

function seedFor(scenario: string, name: string, i: number): number {
  let h = 2166136261;
  for (const c of `${scenario}/${name}/${i}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h % 2_000_000_000;
}

export function buildManifest(sc: Scenario, seg: Segment): H3Manifest {
  const shots: H3Shot[] = seg.shots.map((req, i) => {
    const beat = seg.beats[i];
    const refs = selectRefs(req);
    const nodeId = `great-haze-${sc.def.id}-${seg.name}-${String(i + 1).padStart(2, "0")}`;
    return {
      node_id: nodeId,
      label: `${sc.def.title} / ${seg.name} ${i + 1}: ${beat.title}`,
      x: 80 + i * 360,
      y: seg.name === "main" ? 80 : 460,
      references: refs.map((r) => ({ datom_id: r.datom_id, slot_key: r.slot_key, label: r.label })),
      input_images: refs.map((r) => `{{slot:${r.datom_id}:${r.slot_key}}}`),
      reference_video: "",
      ref_image_size: "{{ref_image_size}}",
      prompt_lines: h3Prompt(req, beat, refs),
      overrides: { duration: Math.max(LUCIFER.minSeconds, Math.min(LUCIFER.maxSeconds, req.duration)), seed: seedFor(sc.def.id, seg.name, i) },
      meta: { beat: beat.id, kind: beat.kind, stakes: beat.stakes, template_key: req.templateKey, cache_key: req.cacheKey, mutations: beat.mutations.filter((m) => m.kind !== "look" && m.kind !== "region").map((m) => `${m.kind}:${m.subject}`) },
    };
  });
  return {
    project_id: "{{project_id}}",
    graph_id: "{{graph_id}}",
    service_id: H3.r2v,
    prompt_guide: { service_id: H3.r2v, guide_id: "{{guide_id}}", revision: "{{guide_revision}}", fingerprint: "{{guide_fingerprint}}" },
    common: { width: LUCIFER.width, height: LUCIFER.height, h3_turbo_enabled: true },
    shots,
    x_great_haze: {
      scenario: sc.def.id,
      segment: seg.name,
      execution_target_id: H3.workerId,
      note: "Fill the double-brace placeholders with tools/video/hyperlab-export.ts (resolve step). apply_h3_manifest.ps1 reads input_images; `references` keeps the datom slots as the source of truth.",
    },
  };
}

export function shotCount(sc: Scenario): number {
  return sc.main.shots.length + sc.fork.shots.length;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2), ["scenario", "out"]);
  const ids = args.values.get("scenario") ? [args.values.get("scenario") as string] : SCENARIOS.map((s) => s.id);
  const out = args.values.get("out") ?? "artifacts/video/scenarios";
  mkdirSync(out, { recursive: true });
  for (const id of ids) {
    const sc = buildScenario(id);
    for (const seg of [sc.main, sc.fork]) {
      const file = join(out, `${id}.${seg.name}.h3-manifest.json`);
      writeFileSync(file, JSON.stringify(buildManifest(sc, seg), null, 2));
      console.log(`${file}: ${seg.shots.length} shots`);
    }
  }
}

if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("tools/video/h3-manifest.ts")) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
}

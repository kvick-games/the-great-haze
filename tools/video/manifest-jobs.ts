// Turns an H3 manifest (see h3-manifest.ts) into a jobs.json for lucifer-run.ts. Each shot becomes one
// MiniMax_H3_R2V job whose input_image items are Ether datom slot references ({datom_id, slot_key,
// selector?}), not file paths: Hyperlab resolves the live slots at preflight and records a receipt.
// Slots come from the registry written by hyperlab-register.ts.
//
//   node tools/video/manifest-jobs.ts <manifest.json>... --registry <registry.json> --out <jobs.json> [--project the-great-haze]

import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "./args.ts";
import type { H3Manifest } from "./h3-manifest.ts";

interface Registry { datoms: Record<string, { datom_id: string }> }

/** "state_variants/wounded-v2" -> { slot_key: "state_variants", selector: { label: "wounded-v2" } }. */
export function slotItem(datomId: string, slotKey: string): Record<string, unknown> {
  const at = slotKey.indexOf("/");
  return at < 0 ? { datom_id: datomId, slot_key: slotKey, source: "ether" } : { datom_id: datomId, slot_key: slotKey.slice(0, at), selector: { label: slotKey.slice(at + 1) }, source: "ether" };
}

export function jobsFromManifest(m: H3Manifest, reg: Registry, project: string): { key: string; body: Record<string, unknown> }[] {
  return m.shots.map((shot) => ({
    key: shot.node_id,
    body: {
      capability: "image_to_video",
      service_id: m.service_id,
      project_id: project,
      auto_queue: false,
      tags: ["the-great-haze", m.x_great_haze.scenario, m.x_great_haze.segment],
      notes: `${shot.label} (beat ${shot.meta.beat}, ${shot.meta.kind}); H3 8-step turbo on.`,
      params: {
        ...m.common,
        ...shot.overrides,
        h3_turbo_enabled: true,
        ref_image_size: "match",
        input_image: shot.references.map((r) => {
          const rec = reg.datoms[r.datom_id];
          if (!rec) throw new Error(`${shot.node_id}: datom ${r.datom_id} is not registered`);
          return slotItem(rec.datom_id, r.slot_key);
        }),
        prompt: shot.prompt_lines.join("\n"),
      },
    },
  }));
}

if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("tools/video/manifest-jobs.ts")) {
  const args = parseArgs(process.argv.slice(2), ["registry", "out", "project"]);
  const reg = JSON.parse(readFileSync(args.values.get("registry") ?? "", "utf8")) as Registry;
  const out = args.values.get("out");
  if (!out || !args.rest.length) throw new Error("usage: manifest-jobs.ts <manifest.json>... --registry r.json --out jobs.json");
  const jobs = args.rest.flatMap((f) => jobsFromManifest(JSON.parse(readFileSync(f, "utf8")) as H3Manifest, reg, args.values.get("project") ?? "the-great-haze"));
  writeFileSync(out, JSON.stringify(jobs, null, 2));
  console.log(`${jobs.length} jobs -> ${out}`);
}

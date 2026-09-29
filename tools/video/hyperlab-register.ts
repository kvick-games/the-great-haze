// Registers the scenario's characters in a loopback Hyperlab and attaches the approved existing
// reference stills to their slots. It does NOT run the plan's text-to-image still jobs: the images
// already exist under artifacts/video/stills/<scenario>/<name>/ and are imported as assets.
//
//   node tools/video/hyperlab-register.ts --scenario stranger-trap [--project the-great-haze]
//        [--base-url http://127.0.0.1:8487] [--out artifacts/video/runs/stranger-trap]
//
// Per character: POST content/nodes, POST .../ether-datom/publish (both from the plan's node and
// publish steps), then POST content-browser/assign-media-slot per still. Files under
// <stills>/<name>/state_variants/<label>.png go to the many-slot `state_variants` with that label
// (append); the same for outfit_variants. Progress is saved to <out>/registry.json so a re-run
// only does what is missing. Nothing is generated and no job is created or queued.

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "./args.ts";

const LOOPBACK = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?\/?$/;

interface Registry {
  datoms: Record<string, { node_id: string; datom_id: string; slots: Record<string, string> }>;
}

async function api(base: string, method: string, path: string, body?: unknown): Promise<any> {
  const res = await fetch(base + path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

/** [slot_key, label, file] for every still of one character folder. */
export function stillsOf(dir: string): { slot: string; label: string; file: string }[] {
  const out: { slot: string; label: string; file: string }[] = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      for (const f of readdirSync(p).filter((x) => x.endsWith(".png")).sort()) out.push({ slot: name, label: f.replace(/\.png$/, ""), file: join(p, f) });
    } else if (name.endsWith(".png")) out.push({ slot: name.replace(/\.png$/, ""), label: name.replace(/\.png$/, ""), file: p });
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2), ["scenario", "project", "base-url", "out", "stills", "plan"], []);
  const scenario = args.values.get("scenario") ?? "stranger-trap";
  const project = args.values.get("project") ?? "the-great-haze";
  const base = (args.values.get("base-url") ?? "http://127.0.0.1:8487").replace(/\/$/, "");
  if (!LOOPBACK.test(base)) throw new Error("Hyperlab is loopback only");
  const out = args.values.get("out") ?? join("artifacts/video/runs", scenario);
  const stills = args.values.get("stills") ?? join("artifacts/video/stills", scenario);
  const planFile = args.values.get("plan") ?? join("artifacts/video/scenarios", `${scenario}.plan.json`);
  mkdirSync(out, { recursive: true });
  const regPath = join(out, "registry.json");
  const reg: Registry = existsSync(regPath) ? JSON.parse(readFileSync(regPath, "utf8")) : { datoms: {} };
  const save = () => writeFileSync(regPath, JSON.stringify(reg, null, 2));

  const plan = JSON.parse(readFileSync(planFile, "utf8")) as { steps: { id: string; body?: any }[] };
  for (const step of plan.steps.filter((s) => s.id.startsWith("node:"))) {
    const planId = step.id.slice("node:".length); // e.g. gh-char-odalys
    if (!reg.datoms[planId]) {
      const node = await api(base, "POST", `/api/projects/${project}/content/nodes`, step.body);
      const pub = await api(base, "POST", `/api/projects/${project}/content/nodes/${node.id}/ether-datom/publish`, {});
      const datomId = String(pub.datom_id ?? pub.id ?? pub.datom?.id);
      reg.datoms[planId] = { node_id: String(node.id), datom_id: datomId, slots: {} };
      save();
      console.log(`${planId}: node ${node.id} -> datom ${datomId}`);
    }
    const rec = reg.datoms[planId];
    const dir = join(stills, planId.replace(/^gh-char-/, ""));
    if (!existsSync(dir)) {
      console.log(`${planId}: no stills folder ${dir}, skipped`);
      continue;
    }
    // Only slots the datom schema already defines are used; undefined ones (three_quarter) are left unattached.
    const defined = new Set<string>(((await api(base, "GET", `/api/datoms/${rec.datom_id}/slots`)).definitions ?? []).map((d: any) => String(d.key)));
    for (const s of stillsOf(dir)) {
      if (!defined.has(s.slot)) {
        console.log(`${planId}: slot ${s.slot} is not defined by the character schema, ${s.label} left unattached`);
        continue;
      }
      const key = s.slot === s.label ? s.slot : `${s.slot}/${s.label}`;
      if (rec.slots[key]) continue;
      const many = s.slot !== s.label;
      const r = await api(base, "POST", `/api/projects/${project}/content-browser/assign-media-slot`, {
        path: resolve(s.file),
        media_kind: "image",
        datom_id: rec.datom_id,
        slot_key: s.slot,
        name: s.label,
        append: many,
      });
      rec.slots[key] = String(r.ether_asset?.id ?? "ok");
      save();
      console.log(`${planId}: ${key} attached`);
    }
  }
  console.log(`registry: ${Object.keys(reg.datoms).length} datoms -> ${regPath}`);
}

if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("tools/video/hyperlab-register.ts")) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
}

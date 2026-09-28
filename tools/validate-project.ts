// Validate the Dream Engine project manifests and every path they reference.
// The project has no build yet; this is the check AGENTS.md asks for.
//   npm run validate
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface Problem {
  file: string;
  message: string;
}

export function validateProject(root: string): Problem[] {
  const problems: Problem[] = [];
  const fail = (file: string, message: string) => problems.push({ file, message });
  const read = (file: string): any => {
    try {
      return JSON.parse(readFileSync(join(root, file), "utf8"));
    } catch (e) {
      fail(file, `cannot read or parse: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
  };

  const project = read("project.dtproject");
  const workspace = read("dreamengine.project.json");
  if (!project || !workspace) return problems;

  if (project.kind !== "dreamatron.project") fail("project.dtproject", `unexpected kind ${project.kind}`);
  if (workspace.id !== project.id) fail("dreamengine.project.json", "id does not match project.dtproject");

  const ids = new Set<string>();
  for (const asset of project.assets ?? []) {
    if (ids.has(asset.id)) fail("project.dtproject", `duplicate asset id ${asset.id}`);
    ids.add(asset.id);
    const path = asset.storage?.path;
    if (!path) continue;
    if (!existsSync(join(root, path))) {
      fail("project.dtproject", `asset ${asset.id} points at missing path ${path}`);
      continue;
    }
    if (asset.integrity) {
      const bytes = readFileSync(join(root, path));
      const sha = createHash("sha256").update(bytes).digest("hex");
      if (sha !== asset.integrity.sha256) fail("project.dtproject", `asset ${asset.id}: sha256 mismatch for ${path}`);
      if (bytes.length !== asset.integrity.size) fail("project.dtproject", `asset ${asset.id}: size mismatch for ${path}`);
    }
  }
  const app = project.applications?.dreamengine;
  for (const id of app?.asset_ids ?? []) if (!ids.has(id)) fail("project.dtproject", `dreamengine asset_ids references unknown asset ${id}`);
  if (app?.primary_asset_id && !ids.has(app.primary_asset_id)) fail("project.dtproject", "primary_asset_id is not a registered asset");
  if (app?.workspace?.path && !existsSync(join(root, app.workspace.path))) fail("project.dtproject", `workspace path missing: ${app.workspace.path}`);

  for (const key of ["startScene", "moduleEntry"] as const) {
    if (!workspace[key] || !existsSync(join(root, workspace[key]))) fail("dreamengine.project.json", `${key} missing: ${workspace[key]}`);
  }
  for (const dir of workspace.assetRoots ?? []) {
    const full = join(root, dir);
    if (!existsSync(full) || !statSync(full).isDirectory()) fail("dreamengine.project.json", `asset root missing: ${dir}`);
  }
  for (const scene of workspace.scenes ?? []) {
    if (!existsSync(join(root, scene.path))) fail("dreamengine.project.json", `scene ${scene.id} missing: ${scene.path}`);
    else {
      const doc = read(scene.path);
      if (doc && doc.id !== scene.id) fail(scene.path, `scene id ${doc.id} does not match registry id ${scene.id}`);
    }
  }
  for (const prefab of workspace.prefabs ?? []) {
    if (!existsSync(join(root, prefab.path ?? prefab))) fail("dreamengine.project.json", `prefab missing: ${prefab.path ?? prefab}`);
  }
  return problems;
}

const here = dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const problems = validateProject(join(here, ".."));
  if (problems.length) {
    for (const p of problems) console.error(`✗ ${p.file}: ${p.message}`);
    process.exit(1);
  }
  console.log("✓ project.dtproject and dreamengine.project.json are consistent; all referenced paths exist.");
}

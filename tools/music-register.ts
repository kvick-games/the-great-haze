// Register (or refresh) the soundtrack score in project.dtproject through the
// shared project-format transaction API. Run it after editing the score so its
// recorded size and sha256 match (npm run validate checks them).
//
//   node tools/music-register.ts          (PROJECT_FORMAT_DIR overrides the lookup)
//
// The score is a Waver-owned document; the kind, owner and media type match
// musicScoreRegistration() in DreamEngine's @dreamatron/dreamengine-music.

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

export const SCORE_ASSET_ID = "score:waver:the-great-haze";
export const SCORE_PATH = "assets/music/the-great-haze.dtscore.json";

function findProjectFormat(): string {
  const env = process.env.PROJECT_FORMAT_DIR;
  const candidates: string[] = env ? [resolve(env)] : [];
  let dir = root;
  for (let i = 0; i < 8; i++) {
    candidates.push(join(dir, "Apps", "Shared", "project-format"));
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  for (const c of candidates) if (existsSync(join(c, "dist/index.js"))) return join(c, "dist/index.js");
  throw new Error("Shared/project-format not found (build it, or set PROJECT_FORMAT_DIR)");
}

const pf = (await import(pathToFileURL(findProjectFormat()).href)) as {
  registerManagedAsset: (
    project: string,
    actor: string,
    source: string,
    options: { kind: string; name?: string; assetId?: string; owner?: string; role?: string; mediaType?: string; appId?: string },
  ) => { asset: { id: string; integrity?: { sha256: string; size: number } } };
};

const { asset } = pf.registerManagedAsset(join(root, "project.dtproject"), "waver", join(root, SCORE_PATH), {
  kind: "document.waver.music-score",
  name: "The Great Haze soundtrack score",
  assetId: SCORE_ASSET_ID,
  owner: "waver",
  role: "source",
  mediaType: "application/json",
  appId: "waver",
});
console.log(`registered ${asset.id} (${asset.integrity?.size} bytes, sha256 ${asset.integrity?.sha256.slice(0, 12)}...)`);

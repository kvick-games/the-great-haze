// Where the adaptive music runtime comes from when bundling the web client.
//
// The client is a standalone esbuild bundle, not a DreamEngine workspace, so it
// does not install engine packages. `@dreamatron/dreamengine-music/host` is
// resolved from a DreamEngine checkout instead: DREAMENGINE_DIR if set, or the
// nearest `Apps/DT_DreamEngine` above this repository (the ecosystem layout).
// The host imports the shared audio-engine music module by relative path from
// there. When no checkout has the music package, the bundle uses a silent stub
// and the game plays without music.

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const HOST = "packages/music/src/host.ts";

export function findMusicHost(): string | null {
  const env = process.env.DREAMENGINE_DIR;
  if (env) {
    const p = resolve(env, HOST);
    return existsSync(p) ? p : null;
  }
  let dir = root;
  for (let i = 0; i < 8; i++) {
    const p = join(dir, "Apps", "DT_DreamEngine", HOST);
    if (existsSync(p)) return p;
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}

/** The shared audio-engine music module next to that checkout (tools only: offline rendering). */
export function findMusicModule(): string | null {
  const host = findMusicHost();
  if (!host) return null;
  const p = resolve(dirname(host), "../../../../Shared/audio-engine/src/music/index.ts");
  return existsSync(p) ? p : null;
}

export function musicEnginePlugin(onResolved?: (path: string | null) => void): Plugin {
  const host = findMusicHost();
  const module = findMusicModule();
  onResolved?.(host);
  return {
    name: "dreamengine-music",
    setup(b) {
      b.onResolve({ filter: /^@dreamatron\/dreamengine-music\/host$/ }, () =>
        host ? { path: host } : { path: join(root, "web/src/music/stub.ts") },
      );
      b.onResolve({ filter: /^@dreamatron\/audio-engine\/music$/ }, () =>
        module ? { path: module } : { errors: [{ text: "no audio-engine music module found; set DREAMENGINE_DIR" }] },
      );
    },
  };
}

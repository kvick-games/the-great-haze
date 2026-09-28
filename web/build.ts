// Bundle the browser client and the simulation core into a single HTML file.
//
//   npm run web:build                 dist/the-great-haze.html (full document)
//                                     dist/the-great-haze.artifact.html (body fragment)
//   npm run web:build -- --inline     bundle Three.js too, for fully offline use
//
// By default Three.js is loaded from jsDelivr at the exact installed version.

import { build } from "esbuild";
import type { Plugin } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const inline = process.argv.includes("--inline");
const threeVersion = (JSON.parse(readFileSync(join(root, "node_modules/three/package.json"), "utf8")) as { version: string }).version;
export const THREE_URL = `https://cdn.jsdelivr.net/npm/three@${threeVersion}/build/three.module.js`;

const threeFromCdn: Plugin = {
  name: "three-from-cdn",
  setup(b) {
    b.onResolve({ filter: /^three$/ }, () => ({ path: THREE_URL, external: true }));
  },
};

const result = await build({
  entryPoints: [join(here, "src/main.ts")],
  bundle: true,
  format: "esm",
  target: "es2022",
  minify: true,
  write: false,
  legalComments: "none",
  plugins: inline ? [] : [threeFromCdn],
  define: { __THREE_URL__: JSON.stringify(THREE_URL) },
});
const js = result.outputFiles[0].text;
if (js.toLowerCase().includes("</script")) throw new Error("bundle contains a closing script tag");

const template = readFileSync(join(here, "index.html"), "utf8");
const fragment = template.replace("/*APP*/", () => js);
const full = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
</head>
<body>
${fragment}
</body>
</html>
`;
mkdirSync(join(root, "dist"), { recursive: true });
writeFileSync(join(root, "dist/the-great-haze.html"), full);
writeFileSync(join(root, "dist/the-great-haze.artifact.html"), fragment);
console.log(`built dist/the-great-haze.html (${Math.round(full.length / 1024)} KB, three ${inline ? "inlined" : `from ${THREE_URL}`})`);

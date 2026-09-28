// Play the built 3D client in headless Chromium through its real UI.
//   node tools/web-play.mjs <outDir> [maxSteps] [seedClicks]
// Saves a screenshot the first time each kind of screen appears and prints
// console errors. Used by the smoke test and for visual review.
import { chromium } from "playwright-core";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = process.argv[2] ?? "/tmp/haze-play";
const maxSteps = Number(process.argv[3] ?? 400);
const width = Number(process.env.W ?? 1280);
const height = Number(process.env.H ?? 720);
mkdirSync(outDir, { recursive: true });

// CHROME_PATH points at a local Chrome/Chromium; otherwise Playwright's own browser is used.
const exe = [process.env.CHROME_PATH, "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find((p) => p && existsSync(p));
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width, height } });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message + "\n" + (e.stack ?? "").split("\n").slice(0, 4).join("\n")));
page.on("console", (m) => {
  if (m.type() === "error") errors.push("console: " + m.text());
});
await page.route(/https:\/\/cdn\.jsdelivr\.net\/npm\/three@[^/]+\/(.*)/, (route) => {
  const rel = route.request().url().replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/three@[^/]+\//, "");
  route.fulfill({ status: 200, contentType: "application/javascript", body: readFileSync(join(root, "node_modules/three", rel)) });
});
await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ status: 200, contentType: "text/css", body: "" }));
await page.goto("file://" + join(root, "dist/the-great-haze.html") + "#fast");
await page.waitForFunction(() => window.__haze?.booted === true, null, { timeout: 30000 });
await page.waitForTimeout(1500);
const shot = async (name) => page.screenshot({ path: join(outDir, `${name}.png`) });
await shot("00-title");

const idle = async () => {
  await page.waitForFunction(() => !document.getElementById("ui").classList.contains("is-busy"), null, { timeout: 120000 });
  await page.waitForTimeout(250);
};
const kind = async () => page.evaluate(() => {
  const c = document.querySelector(".card");
  const m = c && /kind-(\w+)/.exec(c.className);
  return m ? m[1] : null;
});

await page.click("form.begin button[type=submit]");
await idle();
await shot("01-muster");
for (let i = 0; i < 4; i++) {
  await page.locator(".pick:not(.on):not([disabled])").first().click();
  await page.waitForTimeout(120);
}
await page.waitForTimeout(600);
await shot("02-muster-picked");
await page.locator(".opt.primary").click();
await idle();
const buy = async (item, n, times) => {
  for (let i = 0; i < times; i++) await page.getByRole("button", { name: `Buy ${n} ${item}`, exact: true }).click();
};
await buy("Rations", 10, 11);
await buy("Pitch torches", 10, 1);
await buy("Pitch torches", 5, 1);
await buy("Powder & shot", 10, 2);
await buy("Physic", 1, 4);
await buy("Spare parts", 1, 1);
await page.waitForTimeout(500);
await shot("03-store");
await page.locator(".opt.primary").click();
await idle();

const seen = new Map();
const firstShot = async (k, extra = "") => {
  const key = k + extra;
  const n = seen.get(key) ?? 0;
  seen.set(key, n + 1);
  if (n < (k === "scene" || k === "combat" ? 3 : 1)) await shot(`${String(seen.size).padStart(2, "0")}-${key}-${n}`);
};
let steps = 0;
let result = "incomplete";
while (steps++ < maxSteps) {
  await idle();
  const k = await kind();
  if (!k) {
    await page.waitForTimeout(500);
    continue;
  }
  const title = await page.textContent(".card h2");
  await firstShot(k, k === "result" && /Nightfall/.test(title ?? "") ? "-night" : "");
  if (k === "ending") {
    result = title ?? "ending";
    break;
  }
  let btn;
  if (k === "plan") btn = page.locator(".opt.primary");
  else if (k === "store") btn = page.locator(".opt.primary");
  else btn = page.locator(".opts .opt:not([disabled]):not(.look)").first();
  await btn.click();
}
const kinds = [...seen.keys()].map((k) => k.replace(/-.*/, ""));
console.log(`steps ${steps}, result: ${result}, screens seen: ${[...new Set(kinds)].join(", ")}`);
console.log(errors.length ? errors.slice(0, 20).join("\n") : "no errors");
await browser.close();
// The smoke check: no page errors, and the run got past the first day into the road loop.
const reached = ["plan", "result"].every((k) => kinds.includes(k));
if (errors.length || !reached) process.exitCode = 1;

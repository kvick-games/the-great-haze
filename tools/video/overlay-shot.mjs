// Play the built client in headless Chromium with video on, and screenshot the clip overlay
// the first time it appears. Also opens the debug panel and screenshots it.
//   node tools/video/overlay-shot.mjs <outDir> "<hash>" [maxSteps]
// e.g. "#fast&videoSlow&video=mock&videoMin=minor" or "#fast&videoSlow&video=realtime@http://127.0.0.1:8787"
// Needs `npm run web:build`. For realtime, start `npm run video:server -- --mock` first.
import { chromium } from "playwright-core";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const outDir = process.argv[2] ?? "artifacts/video-shots";
const hash = process.argv[3] ?? "#fast&videoSlow&video=mock&videoMin=minor";
const maxSteps = Number(process.argv[4] ?? 150);
mkdirSync(outDir, { recursive: true });

const exe = [process.env.CHROME_PATH, "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find((p) => p && existsSync(p));
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: Number(process.env.W ?? 960), height: Number(process.env.H ?? 540) } });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push("console: " + m.text());
});
await page.route(/https:\/\/cdn\.jsdelivr\.net\/npm\/three@[^/]+\/(.*)/, (route) => {
  const rel = route.request().url().replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/three@[^/]+\//, "");
  route.fulfill({ status: 200, contentType: "application/javascript", body: readFileSync(join(root, "node_modules/three", rel)) });
});
await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ status: 200, contentType: "text/css", body: "" }));
const target = process.env.PAGE_URL ?? "file://" + join(root, "dist/the-great-haze.html");
await page.goto(target + hash);
await page.waitForFunction(() => window.__haze?.booted === true, null, { timeout: 30000 });
await page.waitForTimeout(1200);

let overlay = false;
const watcher = page
  .waitForSelector(".hz-video.on", { timeout: 15 * 60 * 1000 })
  .then(async () => {
    await page.waitForTimeout(1400);
    await page.screenshot({ path: join(outDir, "overlay.png") });
    overlay = true;
  })
  .catch(() => {});

const idle = async () => {
  await page.waitForFunction(() => !document.getElementById("ui").classList.contains("is-busy"), null, { timeout: 180000 });
  await page.waitForTimeout(250);
};
const kind = async () =>
  page.evaluate(() => {
    const c = document.querySelector(".card");
    const m = c && /kind-(\w+)/.exec(c.className);
    return m ? m[1] : null;
  });

await page.click("form.begin button[type=submit]");
await idle();
for (let i = 0; i < 4; i++) {
  await page.locator(".pick:not(.on):not([disabled])").first().click();
  await page.waitForTimeout(120);
}
await page.locator(".opt.primary").click();
await idle();
for (let i = 0; i < 11; i++) await page.getByRole("button", { name: "Buy 10 Rations", exact: true }).click();
await page.getByRole("button", { name: "Buy 10 Pitch torches", exact: true }).click();
await page.locator(".opt.primary").click();
await idle();

let steps = 0;
while (steps++ < maxSteps && !overlay) {
  await idle();
  const k = await kind();
  if (!k) {
    await page.waitForTimeout(500);
    continue;
  }
  if (k === "ending") break;
  const btn = k === "plan" || k === "store" ? page.locator(".opt.primary") : page.locator(".opts .opt:not([disabled]):not(.look)").first();
  await btn.click();
}
await watcher;
if (overlay) {
  await idle();
  await page.keyboard.press("Backquote");
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(outDir, "debug-panel.png") });
}
console.log(overlay ? `overlay captured after ${steps} steps` : "no overlay appeared");
console.log(errors.length ? errors.slice(0, 10).join("\n") : "no errors");
await browser.close();
if (errors.length || !overlay) process.exitCode = 1;

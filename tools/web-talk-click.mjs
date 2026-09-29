// Checks that a plain mouse click on the 3D view advances in-world dialogue.
//   node tools/web-talk-click.mjs [maxSteps]
// Plays the built client at normal speed until a conversation starts, then clicks
// the middle of the view a few times and requires the spoken line to change.
// Exits non-zero if clicks do nothing (a full-screen overlay eating them, say).
import { chromium } from "playwright-core";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const maxSteps = Number(process.argv[2] ?? 80);
const exe = [process.env.CHROME_PATH, "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find((p) => p && existsSync(p));
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.route(/https:\/\/cdn\.jsdelivr\.net\/npm\/three@[^/]+\/(.*)/, (route) => {
  const rel = route.request().url().replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/three@[^/]+\//, "");
  route.fulfill({ status: 200, contentType: "application/javascript", body: readFileSync(join(root, "node_modules/three", rel)) });
});
await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ status: 200, contentType: "text/css", body: "" }));
await page.goto("file://" + join(root, "dist/the-great-haze.html"));
await page.waitForFunction(() => window.__haze?.booted === true, null, { timeout: 30000 });

const talking = () => page.evaluate(() => document.getElementById("ui").classList.contains("is-talk"));
const busy = () => page.evaluate(() => document.getElementById("ui").classList.contains("is-busy"));
const line = () => page.evaluate(() => window.__haze.director.conv.active ? [...document.querySelectorAll(".speech-layer .bubble")].map((b) => b.textContent).join("|") : null);

await page.click("form.begin button[type=submit]");
await page.waitForFunction(() => !document.getElementById("ui").classList.contains("is-busy"), null, { timeout: 120000 });
for (let i = 0; i < 4; i++) {
  await page.locator(".pick:not(.on):not([disabled])").first().click();
  await page.waitForTimeout(150);
}
await page.waitForTimeout(600);
await page.locator(".opt.primary").click();
await page.waitForFunction(() => !document.getElementById("ui").classList.contains("is-busy"), null, { timeout: 120000 });
for (let i = 0; i < 10; i++) await page.getByRole("button", { name: "Buy 10 Rations", exact: true }).click();
await page.getByRole("button", { name: "Buy 10 Pitch torches", exact: true }).click();
await page.locator(".opt.primary").click();

let advanced = 0;
let tried = 0;
for (let step = 0; step < maxSteps * 20 && tried < 4; step++) {
  if (await talking()) {
    const before = await line();
    if (!before) { await page.waitForTimeout(200); continue; }
    const hit = await page.evaluate(() => { const e = document.elementFromPoint(innerWidth / 2, innerHeight / 2); return e ? `${e.tagName}.${e.className}` : "none"; });
    // Two clicks: the first may only finish the typewriter reveal.
    await page.mouse.click(640, 360);
    await page.waitForTimeout(150);
    await page.mouse.click(640, 360);
    await page.waitForTimeout(500);
    const after = await line();
    tried++;
    if (after !== before) advanced++;
    console.log(`click on ${hit}: ${after !== before ? "advanced" : "STUCK"} (${before.slice(0, 50)})`);
    continue;
  }
  if (await busy()) { await page.waitForTimeout(200); continue; }
  const opt = page.locator(".opts .opt:not([disabled]):not(.look)").first();
  if (await opt.count()) await opt.click().catch(() => {});
  else await page.waitForTimeout(300);
}
await browser.close();
console.log(tried ? `${advanced}/${tried} clicks advanced the conversation` : "no conversation reached");
process.exit(tried && advanced === tried ? 0 : 1);

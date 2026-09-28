// Render one situation of the 3D client for visual review.
//   node tools/web-scene.mjs out.png [setup.js] [waitMs]
// setup.js runs in the page after boot (window.__haze is available).
import { chromium } from "playwright-core";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const [out, setupFile, wait = "4000"] = process.argv.slice(2);
const setup = setupFile ? readFileSync(setupFile, "utf8") : "";
const exe = ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find(existsSync);
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: Number(process.env.W ?? 1280), height: Number(process.env.H ?? 720) } });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => m.type() === "error" && errors.push("console: " + m.text()));
await page.route(/https:\/\/cdn\.jsdelivr\.net\/npm\/three@[^/]+\/(.*)/, (route) => {
  const rel = route.request().url().replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/three@[^/]+\//, "");
  route.fulfill({ status: 200, contentType: "application/javascript", body: readFileSync(join(root, "node_modules/three", rel)) });
});
await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ status: 200, contentType: "text/css", body: "" }));
await page.goto("file://" + join(root, "dist/the-great-haze.html") + "#fast");
await page.waitForFunction(() => window.__haze?.booted === true, null, { timeout: 30000 });
if (setup) await page.evaluate(setup);
await page.waitForTimeout(Number(wait));
await page.screenshot({ path: out });
console.log(errors.length ? errors.join("\n") : "no errors");
await browser.close();

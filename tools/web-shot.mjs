// Dev helper: render the built page in headless Chromium and save screenshots.
//   node tools/web-shot.mjs out.png "?miles=20&gap=58" [width] [height] [waitMs]
import { chromium } from "playwright-core";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const [out, query = "", w = "1280", h = "720", wait = "2500"] = process.argv.slice(2);
const exe = ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find(existsSync);
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(m.type() + ": " + m.text()); });
await page.route(/https:\/\/cdn\.jsdelivr\.net\/npm\/three@[^/]+\/(.*)/, (route) => {
  const rel = route.request().url().replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/three@[^/]+\//, "");
  route.fulfill({ status: 200, contentType: "application/javascript", body: readFileSync(join(root, "node_modules/three", rel)) });
});
await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ status: 200, contentType: "text/css", body: "" }));
await page.goto("file://" + join(root, "dist/the-great-haze.html") + query);
await page.waitForTimeout(Number(wait));
await page.screenshot({ path: out });
console.log(errors.length ? errors.slice(0, 12).join("\n") : "no errors");
await browser.close();

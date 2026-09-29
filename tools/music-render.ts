// Offline proof of the soundtrack, for when nobody can listen.
//
//   node tools/music-render.ts            (DREAMENGINE_DIR selects the engine checkout)
//
// In headless Chromium, with an OfflineAudioContext:
// - renders every score section to artifacts/music/<section>.wav and checks levels
//   (no clipping, not too quiet, no long silences);
// - renders the Haze closing in over the trail and checks the dread rises;
// - drives the game's own cue mapping (web/src/music/cues.ts) through a scripted
//   run, renders it, and writes which sections, themes and stingers played to
//   artifacts/music/report.txt;
// - loads the built game (dist/the-great-haze.html) and checks the music host
//   runs inert under automation with no errors.
// artifacts/ is gitignored: never commit the WAVs.

import { build } from "esbuild";
import { chromium } from "playwright-core";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { musicEnginePlugin } from "./music-engine.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const out = join(root, "artifacts/music");
mkdirSync(out, { recursive: true });

// The page script: everything runs in the browser, where Web Audio lives.
const entry = `
import { parseMusicScore, renderMusicOffline, simulateMusic, measureLevels, encodeWav16 } from "@dreamatron/audio-engine/music";
import raw from "../../../assets/music/the-great-haze.dtscore.json";
import { musicCues } from "./cues.ts";
import { SCENES } from "../../../src/game/content/scenes/index.ts";

const score = parseMusicScore(raw);

function b64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

async function render(opts) {
  const r = await renderMusicOffline(score, { sampleRate: 44100, ...opts });
  const ch = [r.buffer.getChannelData(0), r.buffer.getChannelData(1)];
  const levels = measureLevels(ch, 44100, 0.5);
  const windows = opts.windows ? opts.windows.map(([a, b]) => measureLevels(ch, 44100, a, b)) : [];
  return { wav: b64(encodeWav16(ch, 44100)), levels, windows, markers: r.markers, noteCount: r.noteCount };
}

const REPRESENTATIVE = {
  title: { states: { scene: "title" }, params: {} },
  muster: { states: { scene: "muster" }, params: {} },
  town: { states: { scene: "town" }, params: {} },
  camp: { states: { scene: "camp", focus: "juniper" }, params: { night: 1, haze: 0.2 } },
  scene: { states: { scene: "scene", scenario: "stranger", focus: "mattie" }, params: { danger: 0.5, haze: 0.2 } },
  fork: { states: { scene: "fork" }, params: { haze: 0.2 } },
  landmark: { states: { scene: "landmark" }, params: {} },
  combat: { states: { scene: "combat" }, params: { intensity: 0.9, danger: 0.8 } },
  grief: { states: { mourning: "yes", focus: "hollis" }, params: {} },
  romance: { states: { scene: "scene", scenario: "tender", focus: "mattie" }, params: { haze: 0.2 } },
  betrayal: { states: { scene: "scene", scenario: "betrayal", focus: "rue" }, params: { danger: 0.3, haze: 0.2 } },
  "ending-victory": { states: { scene: "ending", ending: "victory" }, params: {} },
  "ending-loss": { states: { scene: "ending", ending: "loss" }, params: {} },
};

window.sections = () => Object.keys(score.sections);

window.renderSection = async (id, seconds) => {
  const rep = REPRESENTATIVE[id] ?? { states: { scene: "trail", region: id.replace("trail-", "") }, params: { intensity: 0.6, haze: 0.2 } };
  return render({ seconds, start: { section: id, states: rep.states, params: rep.params } });
};

// The Haze closing in: haze rises 0 to 1 over 50 s. The same run with haze held
// at 0 shares every other note (same seed), so the difference is the dread alone.
window.renderHazeRising = async () => {
  const start = { section: "trail-tallow", states: { scene: "trail", region: "tallow" }, params: { haze: 0, intensity: 0.5 } };
  const cues = [];
  for (let i = 0; i <= 10; i++) cues.push({ at: i * 5, params: { haze: i / 10 } });
  const rising = await renderMusicOffline(score, { sampleRate: 44100, seconds: 56, start, cues });
  const calm = await renderMusicOffline(score, { sampleRate: 44100, seconds: 56, start });
  const ch = [rising.buffer.getChannelData(0), rising.buffer.getChannelData(1)];
  const diff = ch.map((c, i) => {
    const other = calm.buffer.getChannelData(i);
    const d = new Float32Array(c.length);
    for (let j = 0; j < c.length; j++) d[j] = c[j] - other[j];
    return d;
  });
  const dread = [[2, 14], [22, 34], [42, 54]].map(([a, b]) => measureLevels(diff, 44100, a, b));
  return { wav: b64(encodeWav16(ch, 44100)), levels: measureLevels(ch, 44100, 0.5), windows: dread, markers: rising.markers, noteCount: rising.noteCount };
};

// A scripted run through the game's own mapping, from title to ending.
function sceneId(kind) { return SCENES.find((s) => s.kind === kind)?.id ?? "unknown"; }
const party = [
  { id: "leader", alive: true, health: 10, maxHealth: 10 },
  { id: "mattie", alive: true, health: 8, maxHealth: 8 },
  { id: "juniper", alive: true, health: 6, maxHealth: 6 },
  { id: "hollis", alive: true, health: 9, maxHealth: 9 },
];
const sceneP = (kind, actor) => ({ kind: "scene", scene: { id: kind === "landmark" ? "saint-ambrose" : sceneId(kind), truth: "none", tells: [], looks: 0, actor } });
const STEPS = [
  { t: 0, label: "Title screen", view: { state: null, screenKind: null } },
  { t: 14, label: "Muster: choosing the party", kind: "setup", pending: { kind: "setup", offered: [], picked: [] } },
  { t: 30, label: "Cinder Ford store", kind: "store", pending: { kind: "store", storeId: "cinder-ford" } },
  { t: 44, label: "On the road, Tallow", kind: "plan", busy: true, moving: 1, region: "tallow", gap: 60 },
  { t: 66, label: "A stranger, Mattie watching", kind: "scene", pending: sceneP("stranger", "mattie"), region: "tallow", gap: 55 },
  { t: 84, label: "Rolling on, the Haze gains", kind: "plan", busy: true, moving: 1, region: "fen", gap: 30, zone: "near" },
  { t: 104, label: "The fork", kind: "fork", pending: { kind: "fork", node: "n1" }, region: "fen", gap: 26 },
  { t: 118, label: "Night camp (Juniper's night)", kind: "plan", night: 1, camp: 1, region: "fen", gap: 24, day: 1 },
  { t: 138, label: "Combat", kind: "combat", pending: { kind: "combat", combat: { enemy: "shade", hp: 8, maxHp: 10, round: 1, stagger: 0, log: [] } }, region: "fen", gap: 22 },
  { t: 152, label: "Hollis dies", kind: "result", pending: { kind: "result", title: "", lines: [], notes: [] }, region: "fen", gap: 22, dead: "hollis", stinger: "death", mourning: true },
  { t: 186, label: "Pines, the Haze close", kind: "plan", busy: true, moving: 1, region: "pines", gap: 12, zone: "close", stinger: "haze" },
  { t: 204, label: "Landmark: Saint Ambrose", kind: "scene", pending: sceneP("landmark"), region: "pines", gap: 14 },
  { t: 222, label: "The Threshold, the Haze upon them", kind: "plan", busy: true, moving: 1, region: "threshold", gap: 4, zone: "upon", stinger: "haze" },
  { t: 244, label: "Ending: consumed", kind: "ending", pending: { kind: "ending" }, region: "threshold", gap: 0, ending: "consumed" },
];
const RUN_SECONDS = 266;

function stepView(step, previous) {
  if (step.view) return { ...step.view, regionId: null, zone: null, night: 0, camp: 0, moving: 0, busy: false, mourning: false, previous };
  const p = party.map((m) => ({ ...m, alive: m.alive && m.id !== step.dead }));
  if (step.dead) party.find((m) => m.id === step.dead).alive = false;
  return {
    state: { day: step.day ?? 0, gap: step.gap ?? 60, pending: step.pending ?? { kind: "plan" }, party: p, ending: step.ending ? { kind: step.ending, headline: "", lines: [], score: 0 } : null },
    screenKind: step.kind, regionId: step.region ?? "tallow", zone: step.zone ?? "far",
    night: step.night ?? 0, camp: step.camp ?? 0, moving: step.moving ?? 0, busy: !!step.busy,
    mourning: !!step.mourning, mournFor: step.mourning ? step.dead ?? null : null, previous,
  };
}

function scriptCues() {
  let previous = null;
  const cues = [];
  const lines = [];
  for (const step of STEPS) {
    const { states, params } = musicCues(stepView(step, previous));
    previous = states.scene;
    const cue = { at: step.t, states, params };
    if (step.stinger) cue.stinger = step.stinger;
    cues.push(cue);
    if (step.mourning) cues.push({ at: step.t + 30, states: { mourning: "no" } });
    lines.push({ t: step.t, label: step.label, states, params, stinger: step.stinger ?? null });
  }
  return { cues, lines };
}

window.scriptedRun = async () => {
  const { cues, lines } = scriptCues();
  const sim = simulateMusic(score, { seconds: RUN_SECONDS, cues });
  const r = await render({ seconds: RUN_SECONDS, cues });
  return { ...r, steps: lines, markers: sim.markers };
};

window.scoreInfo = () => ({
  sections: Object.fromEntries(Object.entries(score.sections).map(([k, s]) => [k, { label: s.label, bpm: s.bpm, key: s.key.root + " " + s.key.scale }])),
  motifs: Object.fromEntries(Object.entries(score.motifs).map(([k, m]) => [k, m.label])),
});
`;

const bundle = await build({
  stdin: { contents: entry, resolveDir: join(root, "web/src/music"), sourcefile: "music-render-entry.js", loader: "js" },
  bundle: true,
  format: "iife",
  target: "es2022",
  write: false,
  plugins: [musicEnginePlugin()],
});
const js = bundle.outputFiles[0].text;

const exe = [process.env.CHROME_PATH, "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find((p) => p && existsSync(p));
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage();
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.setContent("<!doctype html><html><body></body></html>");
await page.addScriptTag({ content: js });

type Levels = { peakDb: number; rmsDb: number; silentFraction: number; longestSilence: number; clippedSamples: number };
type Marker = { type: string; time: number; section?: string; from?: string | null; quantize?: string; stinger?: string; motifs?: string[]; layers?: string[] };
type Rendered = { wav: string; levels: Levels; windows: Levels[]; markers: Marker[]; noteCount: number };

const failures: string[] = [];
/** The score's master limiter ceiling (mix.ceilingDb): no render may peak above it. */
const CEILING_DB = -3;
const fmt = (l: Levels) =>
  `peak ${l.peakDb.toFixed(1)} dBFS, rms ${l.rmsDb.toFixed(1)} dBFS, silent ${(l.silentFraction * 100).toFixed(0)}%, longest silence ${l.longestSilence.toFixed(1)} s, clipped ${l.clippedSamples}`;
function check(name: string, l: Levels): string {
  const bad: string[] = [];
  if (l.clippedSamples > 0) bad.push("clipping");
  if (l.peakDb > CEILING_DB + 0.05) bad.push(`peak over ${CEILING_DB} dBFS`);
  if (l.rmsDb < -40) bad.push("too quiet");
  if (l.longestSilence > 4) bad.push("long silence");
  if (l.silentFraction > 0.35) bad.push("mostly silent");
  if (bad.length) failures.push(`${name}: ${bad.join(", ")}`);
  return bad.length ? `FAIL (${bad.join(", ")})` : "ok";
}
function saveWav(name: string, r: Rendered): string {
  const path = join(out, `${name}.wav`);
  writeFileSync(path, Buffer.from(r.wav, "base64"));
  return path;
}

const report: string[] = [];
const info = (await page.evaluate("scoreInfo()")) as { sections: Record<string, { label: string; bpm: number; key: string }>; motifs: Record<string, string> };
report.push("The Great Haze: adaptive score verification", "");
report.push("Sections", "");

const sections = (await page.evaluate("sections()")) as string[];
for (const id of sections) {
  const s = info.sections[id];
  const secs = Math.min(36, Math.max(20, (8 * 4 * 60) / s.bpm + 2));
  const r = (await page.evaluate(`renderSection(${JSON.stringify(id)}, ${secs})`)) as Rendered;
  const path = saveWav(id, r);
  const motifs = new Set<string>();
  for (const m of r.markers) if (m.type === "bar") for (const x of m.motifs ?? []) motifs.add(x);
  const line = `${id.padEnd(16)} ${s.label} (${s.key}, ${s.bpm} bpm): ${check(id, r.levels)}; ${fmt(r.levels)}; ${r.noteCount} notes; themes: ${[...motifs].join(", ") || "none"}`;
  report.push(line);
  console.log(line);
  void path;
}

report.push("", "The Haze closing in (trail-tallow, haze 0 to 1 over 50 s)", "");
{
  const r = (await page.evaluate("renderHazeRising()")) as Rendered;
  saveWav("haze-rising", r);
  const [early, mid, late] = r.windows;
  const rises = late.rmsDb > mid.rmsDb + 3 && mid.rmsDb > early.rmsDb && late.rmsDb > -40;
  if (!rises) failures.push(`haze-rising: dread layer rms ${early.rmsDb.toFixed(1)} / ${mid.rmsDb.toFixed(1)} / ${late.rmsDb.toFixed(1)} dBFS does not rise`);
  const layers = new Map<number, string[]>();
  for (const m of r.markers) if (m.type === "bar") layers.set(Math.round(m.time), m.layers ?? []);
  const first = [...layers.values()][0] ?? [];
  const last = [...layers.values()].pop() ?? [];
  const db = (l: Levels) => (l.rmsDb > -120 ? `${l.rmsDb.toFixed(1)} dBFS` : "silent");
  const line = `${check("haze-rising", r.levels)}; dread layers alone: ${db(early)} at 2-14 s, ${db(mid)} at 22-34 s, ${db(late)} at 42-54 s: ${rises ? "the dread rises" : "FAIL: no rise"}`;
  report.push(line, `  first bar layers: ${first.join(", ")}`, `  last bar layers:  ${last.join(", ")}`);
  console.log(line);
}

report.push("", "Scripted run through the game's cue mapping", "");
{
  const r = (await page.evaluate("scriptedRun()")) as Rendered & {
    steps: { t: number; label: string; states: Record<string, string>; params: Record<string, number>; stinger: string | null }[];
  };
  saveWav("scripted-run", r);
  report.push(`levels: ${check("scripted-run", r.levels)}; ${fmt(r.levels)}`, "");
  const bars = r.markers.filter((m) => m.type === "bar");
  for (const [i, step] of r.steps.entries()) {
    const end = r.steps[i + 1]?.t ?? Infinity;
    const st = step.states;
    const p = step.params;
    report.push(
      `t=${String(step.t).padStart(3)}s  ${step.label}`,
      `        states: scene=${st.scene} region=${st.region} scenario=${st.scenario} focus=${st.focus} ending=${st.ending} mourning=${st.mourning}`,
      `        params: haze=${p.haze.toFixed(2)} danger=${p.danger.toFixed(2)} intensity=${p.intensity.toFixed(2)} night=${p.night.toFixed(2)}${step.stinger ? `   stinger: ${step.stinger}` : ""}`,
    );
    for (const m of r.markers)
      if (m.time >= step.t && m.time < end && m.type === "section") report.push(`        ${m.time.toFixed(1)}s  section ${m.from ?? "(start)"} -> ${m.section} (${m.quantize})`);
    for (const m of r.markers) if (m.time >= step.t && m.time < end && m.type === "stinger") report.push(`        ${m.time.toFixed(1)}s  stinger ${m.stinger}`);
    const themes = new Set<string>();
    for (const b of bars) if (b.time >= step.t && b.time < end) for (const x of b.motifs ?? []) themes.add(x);
    report.push(`        themes heard: ${[...themes].map((t) => info.motifs[t] ?? t).join("; ") || "none"}`);
  }
  const sectionsSeen = new Set(r.markers.filter((m) => m.type === "section").map((m) => m.section));
  const themesSeen = new Set(bars.flatMap((b) => b.motifs ?? []));
  const trailCount = bars.filter((b) => (b.motifs ?? []).includes("trail")).length;
  report.push("", `sections visited: ${[...sectionsSeen].join(", ")}`, `themes heard: ${[...themesSeen].join(", ")}`, `bars carrying the main trail theme: ${trailCount} of ${bars.length}`);
  for (const need of ["title", "muster", "town", "trail-tallow", "scene", "trail-fen", "fork", "camp", "combat", "grief", "trail-pines", "landmark", "trail-threshold", "ending-loss"])
    if (!sectionsSeen.has(need)) failures.push(`scripted run never reached ${need}`);
  for (const need of ["trail", "haze", "mattie", "juniper", "stranger", "grief"]) if (!themesSeen.has(need)) failures.push(`scripted run never played the ${need} theme`);
  console.log(`scripted run: ${[...sectionsSeen].join(" > ")}`);
}

// The built game under automation: the host must run inert, without errors.
const dist = join(root, "dist/the-great-haze.html");
if (existsSync(dist)) {
  const game = await browser.newPage();
  const gameErrors: string[] = [];
  game.on("pageerror", (e) => gameErrors.push(String(e)));
  await game.route(/https:\/\/cdn\.jsdelivr\.net\/npm\/three@[^/]+\/(.*)/, (route) => {
    const rel = route.request().url().replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/three@[^/]+\//, "");
    void route.fulfill({ status: 200, contentType: "application/javascript", body: readFileSync(join(root, "node_modules/three", rel)) });
  });
  await game.route(/fonts\.(googleapis|gstatic)\.com/, (route) => void route.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await game.goto(pathToFileURL(dist).href + "#fast");
  await game.waitForFunction("window.__haze && window.__haze.booted", null, { timeout: 60000 });
  await game.waitForTimeout(1000);
  type Status = { inert: boolean; section: string | null; audible: boolean; states: Record<string, string> };
  const status = async () => (await game.evaluate("window.__haze.music ? window.__haze.music.status() : null")) as Status | null;
  const idle = () => game.waitForFunction("!document.getElementById('ui').classList.contains('is-busy')", null, { timeout: 120000 });
  // Sections change on bar lines of the inert clock, so wait for them rather than a fixed time.
  const section = (id: string) => game.waitForFunction(`window.__haze.music.status().section === ${JSON.stringify(id)}`, null, { timeout: 15000 }).catch(() => undefined);
  const atTitle = await status();
  await game.click("form.begin button[type=submit]");
  await idle();
  await section("muster");
  const atMuster = await status();
  for (let i = 0; i < 4; i++) {
    await game.locator(".pick:not(.on):not([disabled])").first().click();
    await game.waitForTimeout(120);
  }
  await game.locator(".opt.primary").click();
  await idle();
  await section("town");
  const atStore = await status();
  const control = await game.evaluate("!!document.querySelector('.tools .music-ctl')");
  if (control) await game.click(".music-ctl button");
  const stored = (await game.evaluate("localStorage.getItem('the-great-haze.music')")) as string | null;
  const line = [
    `built game (#fast, automated): music inert=${atTitle?.inert} audible=${atTitle?.audible}`,
    `  title screen: scene=${atTitle?.states.scene} section=${atTitle?.section}`,
    `  after Begin:  scene=${atMuster?.states.scene} section=${atMuster?.section}`,
    `  at the store: scene=${atStore?.states.scene} section=${atStore?.section}`,
    `  music control in the HUD tools: ${control}; after one click localStorage holds ${stored}`,
    `  page errors: ${gameErrors.length}`,
  ].join("\n");
  report.push("", line);
  console.log(line);
  if (!atTitle || !atTitle.inert || atTitle.audible) failures.push("built game: music host should be present and inert under automation");
  if (atTitle?.section !== "title" || atMuster?.section !== "muster" || atStore?.section !== "town")
    failures.push(`built game: expected title, muster, town; got ${atTitle?.section}, ${atMuster?.section}, ${atStore?.section}`);
  if (!control || !stored || !stored.includes('"muted":true')) failures.push("built game: music control missing or not persisted");
  if (gameErrors.length) failures.push(`built game page errors: ${gameErrors.join(" | ")}`);
  await game.close();
}

await browser.close();
if (errors.length) failures.push(`render page errors: ${errors.join(" | ")}`);
report.push("", failures.length ? `FAILURES:\n${failures.map((f) => `  - ${f}`).join("\n")}` : "All checks passed.");
writeFileSync(join(out, "report.txt"), report.join("\n") + "\n");
console.log(`\nwrote ${join(out, "report.txt")} and ${sections.length + 2} WAVs in ${out}`);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

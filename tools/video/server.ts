// The realtime proxy. The browser sends a ShotRequest; this server holds the key, spends
// the budget, and hands back a clip URL. The page never sees FAL_KEY.
//
//   node tools/video/server.ts --mock                 no key, no spend: placeholder clips
//   FAL_KEY=... node tools/video/server.ts --max-usd 5   live
//
//   POST /shot        body = ShotRequest  ->  { id, status, url?, placeholder? }
//   GET  /shot/:id    ->  { id, status: queued|running|done|error, url?, placeholder?, error? }
//   GET  /clip/:file  the generated clips
//   GET  /health      mode and budget
//   GET  /            the built game (dist/the-great-haze.html), so the page shares this origin
//
// Only localhost origins get CORS, the server binds 127.0.0.1, request size and shape are
// checked, and the price is recomputed here rather than trusted from the page.

import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, normalize, sep } from "node:path";
import { fnv1a } from "../../src/story/datoms.ts";
import type { ShotRequest } from "../../src/story/shots.ts";
import { LIMITS, MODELS, estimateUsd } from "../../src/story/videoconfig.ts";
import type { Resolution } from "../../src/story/videoconfig.ts";
import { generate, haveKey, redact } from "./fal.ts";
import { liveCall } from "./request.ts";
import { num, parseArgs } from "./args.ts";

export interface ServerOptions {
  port: number;
  host: string;
  mock: boolean;
  maxUsd: number;
  outDir: string;
  refsDir: string;
  distFile: string;
  /** Milliseconds a mock job stays "running" so clients exercise polling. */
  mockDelayMs: number;
  priceMultiplier: number;
  log: (line: string) => void;
}

type JobStatus = "queued" | "running" | "done" | "error";

interface Job {
  id: string;
  cacheKey: string;
  status: JobStatus;
  file?: string;
  placeholder?: { title: string; summary: string; duration: number };
  error?: string;
  readyAt?: number;
  usd: number;
}

const ORIGIN_OK = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
const MAX_BODY = 64 * 1024;

export function jobId(cacheKey: string): string {
  return "shot-" + fnv1a(cacheKey) + fnv1a(cacheKey.split("").reverse().join(""));
}

/** Shape-check an untrusted ShotRequest. Returns a message if it is bad. */
export function checkRequest(b: unknown): string | null {
  if (!b || typeof b !== "object") return "body must be an object";
  const r = b as Partial<ShotRequest>;
  if (typeof r.cacheKey !== "string" || r.cacheKey.length < 3 || r.cacheKey.length > 300) return "bad cacheKey";
  if (typeof r.prompt !== "string" || r.prompt.length < 3 || r.prompt.length > 8000) return "bad prompt";
  const endpoints = Object.values(MODELS).map((m) => m.endpoint);
  if (typeof r.endpoint !== "string" || !endpoints.includes(r.endpoint)) return "endpoint not allowed";
  if (!Number.isInteger(r.duration) || (r.duration as number) < LIMITS.minDuration || (r.duration as number) > LIMITS.maxDuration) return "duration must be an integer of 5 to 15";
  if (!["480P", "768P", "1080P"].includes(String(r.resolution))) return "bad resolution";
  if (typeof r.aspect_ratio !== "string" || !LIMITS.aspectRatios.includes(r.aspect_ratio)) return "bad aspect_ratio";
  if (!Array.isArray(r.references) || r.references.length > LIMITS.maxReferenceImages) return "too many references";
  for (const ref of r.references) {
    if (!ref || typeof ref.datom_id !== "string" || typeof ref.slot_key !== "string" || !/^[\w.-]+$/.test(ref.datom_id) || !/^[\w./-]+$/.test(ref.slot_key)) return "bad reference";
  }
  return null;
}

function haveFfmpeg(): boolean {
  try {
    return spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0;
  } catch {
    return false;
  }
}

/** A short solid-colour clip so the mock path exercises real video playback. Null without an encoder. */
export function makePlaceholderClip(dir: string): string | null {
  const file = join(dir, "placeholder.webm");
  if (existsSync(file)) return "placeholder.webm";
  if (!haveFfmpeg()) return null;
  mkdirSync(dir, { recursive: true });
  const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=0x3a0d14:s=640x360:d=2:r=24", "-vf", "fade=in:0:12,fade=out:36:12", "-c:v", "libvpx", "-b:v", "150k", "-pix_fmt", "yuv420p", file], { stdio: "ignore" });
  return r.status === 0 && existsSync(file) ? "placeholder.webm" : null;
}

export function startServer(o: ServerOptions): Promise<{ server: Server; close: () => Promise<void>; jobs: Map<string, Job>; spent: () => number }> {
  const clipsDir = join(o.outDir, "clips");
  mkdirSync(clipsDir, { recursive: true });
  const jobs = new Map<string, Job>();
  let spent = 0;
  const placeholderFile = o.mock ? makePlaceholderClip(clipsDir) : null;

  // Finished live clips survive a restart: the index maps id -> file.
  const indexPath = join(o.outDir, "cache-index.json");
  if (!o.mock && existsSync(indexPath)) {
    try {
      const idx = JSON.parse(readFileSync(indexPath, "utf8")) as Record<string, { cacheKey: string; file: string }>;
      for (const [id, v] of Object.entries(idx)) if (existsSync(join(clipsDir, v.file))) jobs.set(id, { id, cacheKey: v.cacheKey, status: "done", file: v.file, usd: 0 });
    } catch {
      /* start empty */
    }
  }
  const saveIndex = () => {
    if (o.mock) return;
    const idx: Record<string, { cacheKey: string; file: string }> = {};
    for (const j of jobs.values()) if (j.status === "done" && j.file) idx[j.id] = { cacheKey: j.cacheKey, file: j.file };
    writeFileSync(indexPath, JSON.stringify(idx, null, 2));
  };

  const cors = (req: IncomingMessage, res: ServerResponse): boolean => {
    const origin = req.headers.origin;
    if (origin) {
      if (!ORIGIN_OK.test(origin)) return false;
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    }
    return true;
  };
  const send = (res: ServerResponse, code: number, body: unknown) => {
    res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify(body));
  };
  const view = (j: Job) => {
    if (j.status === "running" && j.readyAt !== undefined && Date.now() >= j.readyAt) j.status = "done";
    return { id: j.id, status: j.status, url: j.file ? `/clip/${j.file}` : undefined, placeholder: j.status === "done" && !j.file ? j.placeholder : undefined, error: j.error };
  };
  const readBody = (req: IncomingMessage): Promise<string> =>
    new Promise((resolve, reject) => {
      let n = 0;
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => {
        n += c.length;
        if (n > MAX_BODY) {
          reject(new Error("body too large"));
          req.destroy();
          return;
        }
        chunks.push(c);
      });
      req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      req.on("error", reject);
    });

  const runLive = async (job: Job, req: ShotRequest) => {
    job.status = "running";
    try {
      const call = liveCall(req, o.refsDir);
      const result = await generate(call.endpoint, call.body);
      const dl = await fetch(result.videoUrl);
      if (!dl.ok) throw new Error(`download failed: HTTP ${dl.status}`);
      const file = `${job.id}.mp4`;
      writeFileSync(join(clipsDir, file), Buffer.from(await dl.arrayBuffer()));
      job.file = file;
      job.status = "done";
      saveIndex();
      o.log(`done ${job.id} (${req.templateKey})`);
    } catch (e) {
      spent -= job.usd;
      job.usd = 0;
      job.status = "error";
      job.error = redact(e instanceof Error ? e.message : String(e)).slice(0, 300);
      o.log(`error ${job.id}: ${job.error}`);
    }
  };

  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    if (!cors(req, res)) return send(res, 403, { error: "origin not allowed" });
    const url = new URL(req.url ?? "/", "http://localhost");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      return res.end();
    }
    if (req.method === "GET" && url.pathname === "/health") return send(res, 200, { ok: true, mode: o.mock ? "mock" : "live", budgetUsd: o.maxUsd, spentUsd: Math.round(spent * 10000) / 10000, hasKey: o.mock ? false : haveKey() });
    if (req.method === "GET" && url.pathname === "/") {
      if (!existsSync(o.distFile)) return send(res, 404, { error: "run npm run web:build first" });
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(readFileSync(o.distFile));
    }
    if (req.method === "POST" && url.pathname === "/shot") {
      let body: unknown;
      try {
        body = JSON.parse(await readBody(req));
      } catch {
        return send(res, 400, { error: "bad json" });
      }
      const bad = checkRequest(body);
      if (bad) return send(res, 400, { error: bad });
      const r = body as ShotRequest;
      const id = jobId(r.cacheKey);
      const known = jobs.get(id);
      if (known && known.status !== "error") return send(res, 200, view(known));
      const usd = estimateUsd(r.duration, r.resolution as Resolution, o.priceMultiplier);
      if (!o.mock) {
        if (!haveKey()) return send(res, 503, { error: "server has no FAL_KEY; use --mock" });
        if (spent + usd > o.maxUsd) return send(res, 402, { error: "budget exhausted", budgetUsd: o.maxUsd, spentUsd: spent });
      }
      const job: Job = { id, cacheKey: r.cacheKey, status: "queued", usd: o.mock ? 0 : usd };
      jobs.set(id, job);
      if (o.mock) {
        job.status = "running";
        job.readyAt = Date.now() + o.mockDelayMs;
        job.placeholder = { title: r.title ?? "", summary: r.summary ?? "", duration: 4 };
        if (placeholderFile) job.file = placeholderFile;
        o.log(`mock ${id} ${r.templateKey}`);
      } else {
        spent += usd;
        o.log(`queued ${id} ${r.templateKey} ($${usd})`);
        void runLive(job, r);
      }
      return send(res, 202, view(job));
    }
    const m = /^\/shot\/([\w-]+)$/.exec(url.pathname);
    if (req.method === "GET" && m) {
      const job = jobs.get(m[1]);
      return job ? send(res, 200, view(job)) : send(res, 404, { error: "unknown shot" });
    }
    const c = /^\/clip\/([\w.-]+)$/.exec(url.pathname);
    if (req.method === "GET" && c) {
      const file = normalize(join(clipsDir, c[1]));
      if (!file.startsWith(clipsDir + sep) || !existsSync(file)) return send(res, 404, { error: "no such clip" });
      res.writeHead(200, { "Content-Type": file.endsWith(".webm") ? "video/webm" : "video/mp4", "Cache-Control": "max-age=3600" });
      return res.end(readFileSync(file));
    }
    return send(res, 404, { error: "not found" });
  };

  const server = createServer((req, res) => {
    handle(req, res).catch((e) => {
      o.log(`error: ${redact(e instanceof Error ? e.message : String(e))}`);
      if (!res.headersSent) send(res, 500, { error: "server error" });
      else res.end();
    });
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(o.port, o.host, () => resolve({ server, close: () => new Promise((r) => server.close(() => r())), jobs, spent: () => spent }));
  });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2), ["port", "max-usd", "out", "refs", "dist", "mock-delay"]);
  const mock = args.flags.has("mock");
  if (!mock && !haveKey()) console.error("FAL_KEY is not set: live requests will be refused. Use --mock to try the pipeline for free.");
  const opts: ServerOptions = {
    port: num(args, "port", 8787),
    host: "127.0.0.1",
    mock,
    maxUsd: num(args, "max-usd", 5),
    outDir: args.values.get("out") ?? "artifacts/video",
    refsDir: args.values.get("refs") ?? "assets/video-refs",
    distFile: args.values.get("dist") ?? "dist/the-great-haze.html",
    mockDelayMs: num(args, "mock-delay", 800),
    priceMultiplier: Number(process.env.FAL_PRICE_MULT ?? 1),
    log: (l) => console.log(l),
  };
  const s = await startServer(opts);
  const addr = s.server.address();
  const port = typeof addr === "object" && addr ? addr.port : opts.port;
  console.log(`video server on http://127.0.0.1:${port} (${mock ? "MOCK: no spending" : `LIVE, budget $${opts.maxUsd}`})`);
  console.log(`open http://127.0.0.1:${port}/#video=realtime to play the built game against it`);
}

if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("tools/video/server.ts")) {
  main().catch((e) => {
    console.error(redact(e instanceof Error ? e.message : String(e)));
    process.exit(1);
  });
}

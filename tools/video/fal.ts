// A small fetch-based client for fal's queue API. The only thing that ever holds the
// key is this module, read from the environment at call time: it is never written to
// disk, logged, or handed to the browser. Endpoint ids, field names and prices live in
// src/story/videoconfig.ts (re-exported here as FAL_CONFIG) so there is one place to fix.

import { DEFAULTS, FIELDS, LIMITS, MODELS, PRICE_PER_SECOND_USD } from "../../src/story/videoconfig.ts";

export const FAL_CONFIG = {
  queueBase: "https://queue.fal.run",
  authScheme: "Key",
  keyEnv: "FAL_KEY",
  models: MODELS,
  fields: FIELDS,
  limits: LIMITS,
  defaults: DEFAULTS,
  pricePerSecondUsd: PRICE_PER_SECOND_USD,
  /** ms between status polls, and the longest a single job may take. */
  pollMs: 4000,
  timeoutMs: 15 * 60 * 1000,
};

export type Fetch = typeof fetch;

export function haveKey(env: NodeJS.ProcessEnv = process.env): boolean {
  return !!env[FAL_CONFIG.keyEnv];
}

function keyFrom(env: NodeJS.ProcessEnv): string {
  const k = env[FAL_CONFIG.keyEnv];
  if (!k) throw new Error(`${FAL_CONFIG.keyEnv} is not set. Live generation needs it in the environment (never on the command line or in a file).`);
  return k;
}

/** Remove the key from anything that might be logged. */
export function redact(text: string, env: NodeJS.ProcessEnv = process.env): string {
  const k = env[FAL_CONFIG.keyEnv];
  return k ? text.split(k).join("[redacted]") : text;
}

export interface QueueTicket {
  request_id: string;
  status_url: string;
  response_url: string;
}

export interface FalResult {
  requestId: string;
  videoUrl: string;
  raw: unknown;
}

function assertFalUrl(u: string): void {
  const host = new URL(u).hostname;
  if (host !== "fal.run" && !host.endsWith(".fal.run") && !host.endsWith(".fal.ai")) throw new Error(`Refusing to send the key to ${host}`);
}

export async function submit(endpoint: string, body: Record<string, unknown>, opts: { fetch?: Fetch; env?: NodeJS.ProcessEnv } = {}): Promise<QueueTicket> {
  const env = opts.env ?? process.env;
  const f = opts.fetch ?? fetch;
  const res = await f(`${FAL_CONFIG.queueBase}/${endpoint}`, {
    method: "POST",
    headers: { Authorization: `${FAL_CONFIG.authScheme} ${keyFrom(env)}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(redact(`fal submit failed: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`, env));
  const json = (await res.json()) as QueueTicket;
  if (!json.request_id || !json.status_url || !json.response_url) throw new Error("fal submit returned no ticket");
  return json;
}

export async function waitForResult(ticket: QueueTicket, opts: { fetch?: Fetch; env?: NodeJS.ProcessEnv; sleep?: (ms: number) => Promise<void>; now?: () => number } = {}): Promise<FalResult> {
  const env = opts.env ?? process.env;
  const f = opts.fetch ?? fetch;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = opts.now ?? Date.now;
  assertFalUrl(ticket.status_url);
  assertFalUrl(ticket.response_url);
  const headers = { Authorization: `${FAL_CONFIG.authScheme} ${keyFrom(env)}` };
  const started = now();
  for (;;) {
    const s = await f(ticket.status_url, { headers });
    if (!s.ok) throw new Error(redact(`fal status failed: HTTP ${s.status}`, env));
    const st = (await s.json()) as { status?: string };
    if (st.status === "COMPLETED") break;
    if (st.status === "FAILED" || st.status === "CANCELLED") throw new Error(`fal job ${ticket.request_id} ${st.status}`);
    if (now() - started > FAL_CONFIG.timeoutMs) throw new Error(`fal job ${ticket.request_id} timed out`);
    await sleep(FAL_CONFIG.pollMs);
  }
  const r = await f(ticket.response_url, { headers });
  if (!r.ok) throw new Error(redact(`fal result failed: HTTP ${r.status}`, env));
  const raw = (await r.json()) as { video?: { url?: string } };
  const url = raw.video?.url;
  if (!url) throw new Error("fal result had no video.url");
  return { requestId: ticket.request_id, videoUrl: url, raw };
}

export async function generate(endpoint: string, body: Record<string, unknown>, opts: Parameters<typeof waitForResult>[1] = {}): Promise<FalResult> {
  const ticket = await submit(endpoint, body, opts);
  return waitForResult(ticket, opts);
}

// From a ShotRequest to the fal call that would run it, with reference stills read from
// disk. A reference route needs at least one image; with none on disk the request falls
// back to text-to-video (the prompt already names and describes every person).

import { toFalBody } from "../../src/story/shots.ts";
import type { ShotRequest } from "../../src/story/shots.ts";
import { MODELS } from "../../src/story/videoconfig.ts";
import { loadReferenceUrls } from "./refs.ts";

export interface LiveCall {
  endpoint: string;
  body: Record<string, unknown>;
  mode: ShotRequest["mode"];
  referencesUsed: number;
  referencesMissing: number;
}

export function liveCall(req: ShotRequest, refsDir: string): LiveCall {
  const urls = req.mode === "reference" ? loadReferenceUrls(req.references, refsDir) : {};
  const used = Object.keys(urls).length;
  const missing = req.mode === "reference" ? req.references.length - used : 0;
  if (req.mode === "reference" && used === 0) {
    const text: ShotRequest = { ...req, mode: "text", endpoint: MODELS.text.endpoint, service_id: MODELS.text.service_id, references: [] };
    return { endpoint: text.endpoint, body: toFalBody(text), mode: "text", referencesUsed: 0, referencesMissing: missing };
  }
  return { endpoint: req.endpoint, body: toFalBody(req, urls), mode: req.mode, referencesUsed: used, referencesMissing: missing };
}

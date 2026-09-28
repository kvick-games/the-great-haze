// Everything that names a fal / Hyperlab video endpoint, a request field, or a price.
// One place, so a change in the upstream API is a one-file fix. Values come from
// Hyperlab's fal executor (Rebuild/src/hyperlab_genesis/executors/fal_ai.py) and
// were not re-checked against fal's live docs: see docs/video-pipeline.md.

export type Resolution = "480P" | "768P" | "1080P";
export type ShotMode = "reference" | "image" | "text";

export interface ModelRoute {
  /** Hyperlab service id used with POST /api/jobs/from_capability. */
  service_id: string;
  /** fal queue endpoint, POSTed to https://queue.fal.run/<endpoint>. */
  endpoint: string;
}

export const MODELS: Record<ShotMode, ModelRoute> = {
  reference: { service_id: "fal_ai/minimax_h3_max_reference_to_video", endpoint: "minimax/h3-max/reference-to-video" },
  image: { service_id: "fal_ai/minimax_h3_max_image_to_video", endpoint: "minimax/h3-max/image-to-video" },
  text: { service_id: "fal_ai/minimax_h3_max_text_to_video", endpoint: "minimax/h3-max/text-to-video" },
};

/** Request field names, by role. */
export const FIELDS = {
  prompt: "prompt",
  /** Integer seconds, 5 to 15. */
  duration: "duration",
  resolution: "resolution",
  aspectRatio: "aspect_ratio",
  seed: "seed",
  promptExpansion: "prompt_expansion_mode",
  safetyChecker: "enable_safety_checker",
  referenceImages: "reference_image_urls",
  referenceVideos: "reference_video_urls",
  referenceAudio: "reference_audio_urls",
  imageUrl: "image_url",
  endImageUrl: "end_image_url",
} as const;

export const LIMITS = {
  minDuration: 5,
  maxDuration: 15,
  /** Reference images per request (12 total across images, videos and audio). */
  maxReferenceImages: 9,
  resolutions: { text: ["480P", "768P"], reference: ["480P", "768P", "1080P"] } as Record<string, Resolution[]>,
  aspectRatios: ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"] as string[],
} as const;

/**
 * US dollars per second of output. Hyperlab's executor uses 0.04 at 768P and 0.025 at 480P;
 * public price pages have suggested up to about 0.08. The 1080P figure is a placeholder guess.
 * Override at run time with FAL_PRICE_MULT (a multiplier) rather than editing code.
 */
export const PRICE_PER_SECOND_USD: Record<Resolution, number> = { "480P": 0.025, "768P": 0.04, "1080P": 0.08 };

export const DEFAULTS = {
  mode: "reference" as ShotMode,
  resolution: "768P" as Resolution,
  aspectRatio: "16:9",
  promptExpansion: "disabled",
  safetyChecker: true,
  /** Hyperlab capability name for a direct job. Not confirmed: check GET /api/routes?q=from_capability. */
  capability: "reference_to_video",
};

export function pricePerSecond(resolution: Resolution, multiplier = 1): number {
  return PRICE_PER_SECOND_USD[resolution] * multiplier;
}

export function estimateUsd(durationSeconds: number, resolution: Resolution, multiplier = 1): number {
  return Math.round(durationSeconds * pricePerSecond(resolution, multiplier) * 10000) / 10000;
}

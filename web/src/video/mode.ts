// How the page asks for video. Off unless the URL says otherwise:
//   #video=mock                       placeholder clips generated in the page, no server
//   #video=baked@<manifest url>       pre-baked clips (default manifest: baked.json next to the page)
//   #video=realtime@<server url>      the local proxy (default: this page's origin, else http://127.0.0.1:8787)
// Extra knobs: videoMin=minor|notable|life-altering (smallest beat worth a clip), videoWait=<ms>.
// They can sit in the hash or the query string, joined with & (for example #fast&video=mock).

export type VideoModeName = "off" | "baked" | "realtime" | "mock";

export interface VideoMode {
  name: VideoModeName;
  /** Manifest URL (baked) or server origin (realtime). */
  url: string;
  /** Smallest stakes that get a clip. */
  minStakes: "minor" | "notable" | "life-altering";
  /** How long to hold the game after the 3D scene for a clip that is not ready yet. */
  maxWaitMs: number;
}

const DEFAULT_WAIT: Record<VideoModeName, number> = { off: 0, mock: 0, baked: 1500, realtime: 8000 };

interface Loc {
  hash: string;
  search: string;
  origin: string;
  protocol: string;
}
const here = (): Loc | undefined => (globalThis as { location?: Loc }).location;

export function parseVideoMode(hash: string = here()?.hash ?? "", search: string = here()?.search ?? ""): VideoMode {
  const text = `${hash.replace(/^#/, "")}&${search.replace(/^\?/, "")}`;
  const get = (k: string): string | undefined => {
    const m = new RegExp(`(?:^|[&;])${k}=([^&;]+)`).exec(text);
    return m ? decodeURIComponent(m[1]) : undefined;
  };
  const raw = get("video");
  const [kind, ...rest] = (raw ?? "off").split("@");
  const arg = rest.join("@");
  let name: VideoModeName = "off";
  let url = "";
  if (kind === "mock") name = "mock";
  else if (kind === "baked") {
    name = "baked";
    url = arg || "baked.json";
  } else if (kind === "realtime") {
    name = "realtime";
    const loc = here();
    const origin = loc && /^https?:/.test(loc.protocol) ? loc.origin : "http://127.0.0.1:8787";
    url = (arg || origin).replace(/\/$/, "");
  }
  const min = get("videoMin");
  const wait = Number(get("videoWait"));
  return {
    name,
    url,
    minStakes: min === "minor" || min === "life-altering" ? min : "notable",
    maxWaitMs: Number.isFinite(wait) && get("videoWait") !== undefined ? wait : DEFAULT_WAIT[name],
  };
}

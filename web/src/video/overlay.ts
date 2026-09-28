// The clip overlay: a letterboxed layer over the whole game that plays one clip and
// then gets out of the way. Click, Space, Escape or the Skip button end it at once;
// a timer ends it regardless, so a stalled or broken clip can never hold the game.

export type ClipSource = { kind: "video"; url: string } | { kind: "card"; title: string; summary: string; duration: number };

const STYLE = `
.hz-video { position: fixed; inset: 0; z-index: 90; background: #000; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.35s; cursor: pointer; }
.hz-video.on { opacity: 1; }
.hz-video .frame { position: relative; width: 100%; max-height: 100%; aspect-ratio: 16 / 9; background: #06080d; }
.hz-video video, .hz-video canvas { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
.hz-video .cap { position: absolute; left: 0; right: 0; bottom: 4%; text-align: center; font-family: "Special Elite", "Courier New", monospace; font-size: clamp(12px, 2vw, 18px); color: #ebe2d1; text-shadow: 0 1px 6px #000; letter-spacing: 0.04em; pointer-events: none; }
.hz-video .skip { position: absolute; right: 14px; top: 12px; font: inherit; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #ebe2d1; background: rgba(8,10,16,0.7); border: 1px solid rgba(235,226,209,0.3); padding: 5px 10px; cursor: pointer; }
.hz-video .tag { position: absolute; left: 14px; top: 12px; font-family: "Courier New", monospace; font-size: 11px; color: #aaa293; letter-spacing: 0.1em; text-transform: uppercase; pointer-events: none; }
`;

let styled = false;
function ensureStyle(): void {
  if (styled) return;
  styled = true;
  const s = document.createElement("style");
  s.textContent = STYLE;
  document.head.appendChild(s);
}

/** Wrap text onto a canvas in at most `lines` lines. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, lines: number): string[] {
  const words = text.split(/\s+/);
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width > width && cur) {
      out.push(cur);
      cur = w;
      if (out.length === lines - 1) break;
    } else cur = t;
  }
  if (out.length < lines && cur) out.push(cur);
  if (words.join(" ").length > out.join(" ").length + 2) out[out.length - 1] = out[out.length - 1].replace(/\s*\S*$/, "") + "...";
  return out;
}

/** Play one clip. Resolves when it ends, is skipped, or fails; never rejects and never hangs. */
export function playClip(source: ClipSource, caption: string, tag: string, opts: { fast?: boolean } = {}): Promise<"ended" | "skipped" | "failed"> {
  ensureStyle();
  return new Promise((resolve) => {
    const root = document.createElement("div");
    root.className = "hz-video";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "Cutaway clip. Press Escape to skip.");
    const frame = document.createElement("div");
    frame.className = "frame";
    const cap = document.createElement("div");
    cap.className = "cap";
    cap.textContent = caption;
    const skip = document.createElement("button");
    skip.className = "skip";
    skip.textContent = "Skip";
    const tagEl = document.createElement("div");
    tagEl.className = "tag";
    tagEl.textContent = tag;
    let done = false;
    let stop: () => void = () => {};
    const finish = (why: "ended" | "skipped" | "failed") => {
      if (done) return;
      done = true;
      window.removeEventListener("keydown", onKey, true);
      clearTimeout(timer);
      stop();
      root.classList.remove("on");
      setTimeout(() => root.remove(), opts.fast ? 0 : 380);
      resolve(why);
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape" || ev.key === " " || ev.key === "Enter") {
        ev.preventDefault();
        ev.stopPropagation();
        finish("skipped");
      }
    };
    window.addEventListener("keydown", onKey, true);
    root.addEventListener("click", () => finish("skipped"));
    skip.addEventListener("click", (ev) => {
      ev.stopPropagation();
      finish("skipped");
    });

    let maxMs = 20000;
    if (source.kind === "video") {
      const v = document.createElement("video");
      v.src = source.url;
      v.muted = true;
      v.playsInline = true;
      v.autoplay = true;
      v.preload = "auto";
      v.addEventListener("ended", () => finish("ended"));
      v.addEventListener("error", () => finish("failed"));
      v.addEventListener("loadedmetadata", () => {
        maxMs = Math.min(40000, (v.duration || 8) * 1000 + 3000);
        clearTimeout(timer);
        timer = window.setTimeout(() => finish("ended"), maxMs);
      });
      frame.appendChild(v);
      void v.play().catch(() => finish("failed"));
      stop = () => {
        v.pause();
        v.removeAttribute("src");
        v.load();
      };
    } else {
      const c = document.createElement("canvas");
      c.width = 960;
      c.height = 540;
      frame.appendChild(c);
      const ctx = c.getContext("2d");
      maxMs = source.duration * 1000 * (opts.fast ? 0.15 : 1);
      const t0 = performance.now();
      let raf = 0;
      const draw = (now: number) => {
        if (!ctx || done) return;
        const t = (now - t0) / 1000;
        const g = ctx.createRadialGradient(480, 270, 60, 480, 270, 520);
        const pulse = 0.5 + 0.5 * Math.sin(t * 1.4);
        g.addColorStop(0, `rgb(${70 + pulse * 30},${14 + pulse * 6},${20 + pulse * 6})`);
        g.addColorStop(1, "#050307");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 960, 540);
        ctx.fillStyle = "rgba(235,226,209,0.06)";
        for (let i = 0; i < 40; i++) ctx.fillRect(((i * 97 + t * 40) % 960), (i * 53) % 540, 2, 2);
        ctx.textAlign = "center";
        ctx.fillStyle = "#ebe2d1";
        ctx.font = "34px 'IM Fell English SC', Georgia, serif";
        ctx.fillText(source.title, 480, 220);
        ctx.font = "17px 'Special Elite', 'Courier New', monospace";
        ctx.fillStyle = "#c9c0ae";
        wrap(ctx, source.summary, 760, 4).forEach((l, i) => ctx.fillText(l, 480, 270 + i * 26));
        ctx.font = "12px 'Courier New', monospace";
        ctx.fillStyle = "#8b8474";
        ctx.fillText("PLACEHOLDER CLIP", 480, 490);
        raf = requestAnimationFrame(draw);
      };
      raf = requestAnimationFrame(draw);
      stop = () => cancelAnimationFrame(raf);
    }
    let timer = window.setTimeout(() => finish("ended"), maxMs);

    frame.append(cap, tagEl, skip);
    root.appendChild(frame);
    document.body.appendChild(root);
    requestAnimationFrame(() => root.classList.add("on"));
  });
}

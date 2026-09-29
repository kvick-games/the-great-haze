// The music control in the HUD tool row: a Music button that mutes and
// unmutes, and a volume slider beside it. The HUD rebuilds its tools on every
// screen, so the control is one element re-attached after the Sound button
// whenever it goes missing. The choice is kept in localStorage.

import type { GameMusic } from "./controller.ts";

const KEY = "the-great-haze.music";

interface Saved {
  volume: number;
  muted: boolean;
}

function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const v = JSON.parse(raw) as Partial<Saved>;
      return { volume: typeof v.volume === "number" ? Math.max(0, Math.min(1, v.volume)) : 0.7, muted: v.muted === true };
    }
  } catch {
    /* storage may be unavailable */
  }
  return { volume: 0.7, muted: false };
}

function save(v: Saved): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* storage may be unavailable */
  }
}

const CSS = `
.music-ctl { display: inline-flex; align-items: center; gap: 4px; }
.music-ctl .tool.off { text-decoration: line-through; opacity: 0.7; }
.music-ctl input[type=range] { width: 64px; height: 28px; margin: 0; accent-color: var(--ember, #c8643c); background: transparent; }
@media (max-width: 640px) { .music-ctl input[type=range] { display: none; } }
`;

export function mountMusicControl(root: HTMLElement, music: GameMusic): () => void {
  const saved = load();
  music.setVolume(saved.volume);
  music.setMuted(saved.muted);

  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  const wrap = document.createElement("span");
  wrap.className = "music-ctl";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "tool text";
  btn.textContent = "Music";
  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = "0";
  slider.max = "100";
  slider.step = "5";
  slider.title = "Music volume";
  slider.setAttribute("aria-label", "Music volume");
  wrap.append(btn, slider);

  const show = () => {
    btn.classList.toggle("off", saved.muted);
    btn.title = saved.muted ? "Music off: click to play" : "Music on: click to mute";
    btn.setAttribute("aria-pressed", String(!saved.muted));
    slider.value = String(Math.round(saved.volume * 100));
  };
  show();
  btn.addEventListener("click", () => {
    saved.muted = !saved.muted;
    music.setMuted(saved.muted);
    if (!saved.muted) music.wake();
    save(saved);
    show();
  });
  slider.addEventListener("input", () => {
    saved.volume = Number(slider.value) / 100;
    music.setVolume(saved.volume);
    if (saved.muted && saved.volume > 0) {
      saved.muted = false;
      music.setMuted(false);
    }
    save(saved);
    show();
  });

  const attach = () => {
    if (wrap.isConnected && wrap.parentElement?.closest(".tools")) return;
    const sound = root.querySelector<HTMLElement>(".tools button[title='Sound']");
    if (sound) sound.after(wrap);
    else root.querySelector(".tools")?.appendChild(wrap);
  };
  const obs = new MutationObserver(attach);
  obs.observe(root, { childList: true, subtree: true });
  attach();
  return () => {
    obs.disconnect();
    wrap.remove();
    style.remove();
  };
}

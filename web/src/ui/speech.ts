// Speech captions, the roll readout and "you notice" markers. All three are
// small HTML elements pinned to a point in the 3D view: the director projects
// a head position to the screen every frame and hands the pixels to place().
// Placement clamps each element inside the view (clear of the HUD and the
// letterbox) so a speaker at the edge of the frame is still readable.

import type { CheckResult, Mood, SpeakerKind } from "../../../src/game/types.ts";
import { add, h } from "./dom.ts";

export interface BubbleLine {
  name: string;
  kind: SpeakerKind;
  mood: Mood;
  text: string;
}

export interface Insets {
  top: number;
  bottom: number;
  /** Left margin; also the right margin unless `right` says otherwise. */
  side: number;
  right?: number;
}

/** Keep a box of size (w, h), centred on x and sitting above y, fully inside the view. */
function pin(el: HTMLElement, x: number, y: number, W: number, H: number, inset: Insets, below = false): { left: number; top: number; w: number } {
  const w = el.offsetWidth;
  const hh = el.offsetHeight;
  let left = x - w / 2;
  left = Math.max(inset.side, Math.min(W - (inset.right ?? inset.side) - w, left));
  let top = below ? y + 18 : y - hh - 16;
  if (top < inset.top) top = below ? top : y + 26;
  top = Math.max(inset.top, Math.min(H - inset.bottom - hh, top));
  el.style.left = `${Math.round(left)}px`;
  el.style.top = `${Math.round(top)}px`;
  return { left, top, w };
}

const KIND_LABEL: Record<string, string> = {
  persuade: "Persuade",
  calm: "Calm",
  haggle: "Haggle",
  "talk-down": "Talk down",
  spot: "Spot",
  "see-lie": "Read them",
};

export function checkLabel(kind: string): string {
  return KIND_LABEL[kind] ?? kind;
}

export class Speech {
  private layer: HTMLElement;
  private bubble: HTMLElement;
  private nameEl: HTMLElement;
  private textEl: HTMLElement;
  private dots: HTMLElement;
  private hint: HTMLElement;
  private rollEl: HTMLElement;
  private rollDie: HTMLElement;
  private rollHead: HTMLElement;
  private rollSum: HTMLElement;
  private rollVerdict: HTMLElement;
  private noticeEl: HTMLElement;
  private full = "";
  private shown = 0;
  private cps = 60;
  /** Where the bubble's tail should point, in px from its left edge (set by place). */
  constructor(root: HTMLElement) {
    this.layer = add(root, h("div", "speech-layer")).lastChild as HTMLElement;
    this.layer.setAttribute("aria-hidden", "true");
    this.bubble = h("div", "bubble");
    this.nameEl = h("div", "b-name");
    this.textEl = h("div", "b-text");
    this.dots = h("div", "b-dots");
    this.hint = h("div", "b-hint", "tap to go on");
    add(this.bubble, this.nameEl, this.textEl, add(h("div", "b-foot"), this.dots, this.hint));
    this.rollEl = h("div", "rollcard");
    this.rollHead = h("div", "r-head");
    this.rollDie = h("div", "r-die", "20");
    this.rollSum = h("div", "r-sum");
    this.rollVerdict = h("div", "r-verdict");
    add(this.rollEl, this.rollHead, add(h("div", "r-body"), this.rollDie, this.rollSum), this.rollVerdict);
    this.noticeEl = h("div", "notice-pin");
    this.noticeEl.append(h("i"), document.createTextNode("You notice"));
    add(this.layer, this.bubble, this.rollEl, this.noticeEl);
  }

  // ------------------------------------------------------------ bubble

  showLine(line: BubbleLine, index: number, total: number, instant: boolean): void {
    const b = this.bubble;
    b.className = `bubble on k-${line.kind} m-${line.mood}`;
    this.nameEl.textContent = line.name;
    this.full = line.text;
    this.shown = instant ? line.text.length : 0;
    this.textEl.textContent = instant ? line.text : "";
    this.dots.replaceChildren();
    for (let i = 0; i < total; i++) this.dots.appendChild(h("i", i === index ? "on" : i < index ? "done" : ""));
    this.hint.textContent = index === total - 1 ? "tap to choose" : "tap to go on";
    this.hint.style.opacity = instant ? "1" : "0";
    // Reserve the finished size so the box does not grow while the words appear.
    this.textEl.style.minHeight = "";
    if (!instant) {
      this.textEl.textContent = line.text;
      this.textEl.style.minHeight = `${this.textEl.offsetHeight}px`;
      this.textEl.textContent = "";
    }
  }

  /** Reveal words over time. Returns true while still revealing. */
  reveal(dt: number): boolean {
    if (this.shown >= this.full.length) return false;
    this.shown = Math.min(this.full.length, this.shown + dt * this.cps);
    this.textEl.textContent = this.full.slice(0, Math.floor(this.shown));
    if (this.shown >= this.full.length) {
      this.textEl.textContent = this.full;
      this.hint.style.opacity = "1";
      return false;
    }
    return true;
  }

  finishReveal(): boolean {
    if (this.shown >= this.full.length) return false;
    this.shown = this.full.length;
    this.textEl.textContent = this.full;
    this.hint.style.opacity = "1";
    return true;
  }

  hideLine(): void {
    this.bubble.classList.remove("on");
  }

  placeLine(x: number, y: number, W: number, H: number, inset: Insets): void {
    const p = pin(this.bubble, x, y, W, H, inset);
    // The tail points at the speaker whatever the clamping did to the box.
    const tail = Math.max(18, Math.min(p.w - 18, x - p.left));
    this.bubble.style.setProperty("--tail", `${Math.round(tail)}px`);
    this.bubble.classList.toggle("flip", p.top > y);
  }

  // ------------------------------------------------------------ roll readout

  /** Start a roll over the roller's head; settle() finishes it. */
  startRoll(c: CheckResult): void {
    const e = this.rollEl;
    e.className = "rollcard on rolling";
    this.rollHead.textContent = `${c.byName} · ${checkLabel(c.kind)} · ${c.target}`;
    this.rollSum.textContent = "";
    this.rollVerdict.textContent = "";
    this.rollDie.textContent = "";
  }

  tumble(n: number): void {
    this.rollDie.textContent = String(n);
  }

  settle(c: CheckResult): void {
    const e = this.rollEl;
    e.classList.remove("rolling");
    e.classList.add(c.success ? "win" : "lose");
    const nat = c.roll === 20 ? " nat 20" : c.roll === 1 ? " nat 1" : "";
    this.rollDie.textContent = String(c.roll);
    const sign = c.bonus >= 0 ? "+" : "−";
    this.rollSum.textContent = `${sign} ${Math.abs(c.bonus)} = ${c.roll + c.bonus}  vs  ${c.dc}`;
    this.rollVerdict.textContent = (c.success ? "Success" : "Failure") + nat;
    e.title = c.reason;
  }

  hideRoll(): void {
    this.rollEl.classList.remove("on");
  }

  placeRoll(x: number, y: number, W: number, H: number, inset: Insets): void {
    pin(this.rollEl, x, y, W, H, inset);
  }

  // ------------------------------------------------------------ notice marker

  showNotice(on: boolean, label = "You notice"): void {
    if (this.noticeEl.lastChild) this.noticeEl.lastChild.textContent = label;
    this.noticeEl.classList.toggle("on", on);
  }

  placeNotice(x: number, y: number, W: number, H: number, inset: Insets, visible: boolean): void {
    this.noticeEl.style.opacity = visible ? "" : "0";
    pin(this.noticeEl, x, y, W, H, inset);
  }

  get noticeOn(): boolean {
    return this.noticeEl.classList.contains("on");
  }
}

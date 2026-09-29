// The crew sheet: one person's portrait, condition, traits, ties and history.
// A side panel on wide screens, a bottom sheet on narrow ones. Escape, the close
// button or a click outside closes it, and focus returns to whatever opened it.

import type { GameState, MemberView } from "../../../src/game/types.ts";
import { add, h } from "./dom.ts";
import { Chronicle, crewProfile } from "./crew-info.ts";
import type { CrewProfile } from "./crew-info.ts";
import type { PortraitSpec } from "./portraits.ts";

export interface CrewDeps {
  state(): GameState | null;
  portrait(spec: PortraitSpec): string | null;
}

export function portraitSpec(v: MemberView, alive: boolean): PortraitSpec {
  return { id: v.id, role: v.role, isLeader: v.isLeader, traits: v.traits, look: v.look, health: v.health, nerve: v.nerve, conditions: v.conditions, alive };
}

/** A framed portrait, or the person's initial where the renderer is not available. */
export function portraitEl(deps: CrewDeps, v: MemberView, alive: boolean, cls = ""): HTMLElement {
  const box = h("span", `portrait ${cls}${alive ? "" : " fallen"}`);
  box.setAttribute("aria-hidden", "true");
  const url = deps.portrait(portraitSpec(v, alive));
  if (url) {
    const img = h("img");
    img.src = url;
    img.alt = "";
    img.draggable = false;
    box.appendChild(img);
  } else {
    box.appendChild(h("span", "initial", v.name.replace(/^(Sister|Brother)\s+/, "").charAt(0)));
  }
  if (!alive) box.appendChild(h("span", "cross"));
  return box;
}

function bar(label: string, v: number, max: number, cls: string, note = ""): HTMLElement {
  const b = h("div", `cs-bar ${cls}`);
  const i = h("i");
  i.style.width = `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
  add(b, h("span", "l", label), add(h("div", "tr"), i), h("span", "n", note || v));
  return b;
}

const hpClass = (v: number) => (v > 60 ? "good" : v > 30 ? "warn" : "bad");
const nerveClass = (v: number) => (v > 55 ? "calm" : v > 30 ? "warn" : "bad");
const trustClass = (v: number) => (v > 55 ? "good" : v > 30 ? "warn" : "bad");

export class CrewSheet {
  readonly chronicle = new Chronicle();
  private layer: HTMLElement;
  private sheet: HTMLElement;
  private openId: string | null = null;
  private opener: HTMLElement | null = null;
  private onClose: (() => void) | null = null;

  private deps: CrewDeps;

  constructor(root: HTMLElement, deps: CrewDeps) {
    this.deps = deps;
    this.layer = add(root, h("div", "crew-layer")).lastChild as HTMLElement;
    this.layer.hidden = true;
    const scrim = h("div", "crew-scrim");
    scrim.addEventListener("pointerdown", () => this.close());
    this.sheet = h("section", "crew-sheet");
    this.sheet.setAttribute("role", "dialog");
    this.sheet.setAttribute("aria-modal", "true");
    this.sheet.tabIndex = -1;
    add(this.layer, scrim, this.sheet);
    this.sheet.addEventListener("keydown", (ev) => {
      if (ev.key !== "Tab") return;
      // Keep Tab inside the dialog.
      const items = [...this.sheet.querySelectorAll<HTMLElement>("button, [tabindex='0']")].filter((e) => !e.hasAttribute("disabled"));
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const at = document.activeElement;
      if (ev.shiftKey && (at === first || at === this.sheet)) {
        ev.preventDefault();
        last.focus();
      } else if (!ev.shiftKey && at === last) {
        ev.preventDefault();
        first.focus();
      }
    });
  }

  get isOpen(): boolean {
    return this.openId !== null;
  }

  get current(): string | null {
    return this.openId;
  }

  /** Called whenever the sheet closes, however it was closed. */
  onClosed(fn: () => void): void {
    this.onClose = fn;
  }

  open(id: string, opener?: HTMLElement | null): boolean {
    const s = this.deps.state();
    if (!s) return false;
    this.chronicle.observe(s);
    const p = crewProfile(s, id, this.chronicle);
    if (!p) return false;
    if (!this.openId) this.opener = opener ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    this.openId = id;
    this.fill(p);
    this.layer.hidden = false;
    this.sheet.scrollTop = 0;
    (this.sheet.querySelector(".crew-close") as HTMLElement | null)?.focus({ preventScroll: true });
    return true;
  }

  /** Redraw in place after the game moves on (keeps the scroll position). */
  refresh(): void {
    if (!this.openId) return;
    const s = this.deps.state();
    const p = s ? crewProfile(s, this.openId, this.chronicle) : null;
    if (!p) {
      this.close();
      return;
    }
    const top = this.sheet.scrollTop;
    const hadFocus = this.sheet.contains(document.activeElement);
    this.fill(p);
    this.sheet.scrollTop = top;
    if (hadFocus) (this.sheet.querySelector(".crew-close") as HTMLElement | null)?.focus({ preventScroll: true });
  }

  close(): void {
    if (!this.openId) return;
    this.openId = null;
    this.layer.hidden = true;
    const was = this.opener;
    this.opener = null;
    // The party list is redrawn as the game moves, so the opener may be a stale node.
    const back = was?.isConnected ? was : was?.dataset.id ? document.querySelector<HTMLElement>(`.member[data-id="${CSS.escape(was.dataset.id)}"]`) : null;
    back?.focus({ preventScroll: true });
    this.onClose?.();
  }

  private fill(p: CrewProfile): void {
    const sh = this.sheet;
    sh.replaceChildren();
    sh.classList.toggle("is-fallen", !p.alive);
    sh.setAttribute("aria-labelledby", "crew-name");

    const close = h("button", "crew-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Close");
    close.title = "Close (Esc)";
    close.addEventListener("click", () => this.close());

    const head = h("header", "crew-head");
    const roleLine = `${p.isLeader ? "Wagon-master · " : ""}${p.role}`;
    const id = add(h("div", "crew-id"), h("div", "kicker", roleLine));
    const name = h("h2", "", p.name);
    name.id = "crew-name";
    id.appendChild(name);
    if (!p.alive) id.appendChild(h("div", "crew-fate", `Gone: ${p.fate ?? "lost on the road"}`));
    else if (p.looks) id.appendChild(h("p", "crew-looks", p.looks));
    if (p.bio) id.appendChild(h("p", "crew-bio", p.bio));
    add(head, portraitEl(this.deps, p.view, p.alive, "lg"), id);

    const body = h("div", "crew-body");

    // Condition
    const cond = h("section", "cs-sec");
    cond.appendChild(h("h3", "", "Condition"));
    if (p.alive) {
      add(cond, bar("Health", p.health, p.maxHealth, hpClass((p.health / p.maxHealth) * 100), `${p.health}/${p.maxHealth}`), bar("Nerve", p.nerve, 100, nerveClass(p.nerve)));
      if (!p.isLeader) cond.appendChild(bar("Trust in you", p.trust, 100, trustClass(p.trust)));
      if (p.conditions.length) {
        const list = h("ul", "cs-conds");
        for (const c of p.conditions) {
          const li = h("li", c.tone);
          add(li, h("b", "", c.label), h("span", "", c.blurb));
          list.appendChild(li);
        }
        cond.appendChild(list);
      } else {
        cond.appendChild(h("p", "cs-none", "Hale, and holding together."));
      }
    } else {
      cond.appendChild(h("p", "cs-none", `They are gone. ${p.fate ? `It was ${p.fate}.` : ""}`));
    }
    if (p.marks.length) cond.appendChild(h("p", "cs-marks", `Marks: ${p.marks.join("; ")}.`));

    // Traits
    const tr = h("section", "cs-sec");
    tr.appendChild(h("h3", "", "Traits"));
    const dl = h("dl", "cs-traits");
    for (const t of p.traits) add(dl, add(h("div"), h("dt", "", t.name), h("dd", "", t.blurb)));
    tr.appendChild(dl);

    // Ties
    const ties = h("section", "cs-sec");
    ties.appendChild(h("h3", "", "Ties"));
    if (p.ties.length) {
      const ul = h("ul", "cs-ties");
      for (const t of p.ties) {
        const li = h("li", `${t.score >= 10 ? "pos" : t.score <= -10 ? "neg" : "flat"}${t.kind === "lost" ? " lost" : ""}`);
        const meter = h("span", "meter");
        const fill = h("i");
        const pct = Math.min(50, Math.abs(t.score) / 2);
        fill.style.width = `${pct}%`;
        if (t.score >= 0) fill.style.left = "50%";
        else fill.style.right = "50%";
        meter.appendChild(fill);
        add(li, h("span", "who", t.otherName), h("span", "lab", t.label), meter);
        ul.appendChild(li);
      }
      ties.appendChild(ul);
    } else {
      ties.appendChild(h("p", "cs-none", "No known ties."));
    }

    // History
    const hist = h("section", "cs-sec");
    hist.appendChild(h("h3", "", "History"));
    if (p.history.length) {
      const ol = h("ol", "cs-history");
      for (const e of p.history) add(ol, add(h("li"), h("span", "d", `Day ${e.day}`), h("span", "t", e.text)));
      hist.appendChild(ol);
    } else {
      hist.appendChild(h("p", "cs-none", "Nothing recorded yet."));
    }

    add(body, cond, tr, ties, hist);
    add(sh, close, head, body);
  }
}

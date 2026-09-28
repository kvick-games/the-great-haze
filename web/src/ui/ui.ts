// The HTML layer over the 3D view: HUD, party dock, decision cards, cinematic
// letterbox and captions, and the title screen. It knows nothing about three.js;
// the director tells it what to show and it reports what the player chose.

import type { Hud, MemberView, ResourceId, Screen, ScreenOption } from "../../../src/game/types.ts";
import { RESOURCE_IDS } from "../../../src/game/types.ts";
import { BACKGROUNDS } from "../../../src/game/content/roster.ts";
import { DIFFICULTY, PACES, RATIONS, TUNING } from "../../../src/game/tuning.ts";
import { LANDMARKS } from "../../../src/game/world.ts";
import { ICONS, add, h, svg } from "./dom.ts";

export interface UIHandlers {
  choose(id: string): void;
  trade(item: ResourceId, qty: number): void;
  start(opts: { leaderName: string; background: string; difficulty: "normal" | "dire" }): void;
  resume(): void;
  abandon(): void;
  skip(): void;
  focusMember(id: string | null): void;
  hoverMember(id: string | null): void;
  toggleSound(): boolean;
  toggleQuality(): string;
}

const RES_LABEL: Record<ResourceId, string> = {
  rations: "Food",
  torches: "Torches",
  ammo: "Shot",
  medicine: "Physic",
  spares: "Spares",
  veils: "Veils",
  rockets: "Rockets",
};

const KICKER: Partial<Record<Screen["kind"], string>> = {
  scene: "On the road",
  result: "What it cost",
  combat: "Combat",
  arrival: "Landmark",
  store: "Market",
  plan: "Morning",
  setup: "Cinder Ford, the last night",
};

export class UI {
  root: HTMLElement;
  private hud: HTMLElement;
  private party: HTMLElement;
  private card: HTMLElement;
  private cine: HTMLElement;
  private caption: HTMLElement;
  private toastEl: HTMLElement;
  private title: HTMLElement | null = null;
  private tooltip: HTMLElement;
  private handlers: UIHandlers;
  private hot: string[] = [];
  private busy = false;
  private confirmAbandon = false;
  private soundOn = false;
  kickerOverride: string | null = null;

  constructor(root: HTMLElement, handlers: UIHandlers) {
    this.root = root;
    this.handlers = handlers;
    this.hud = add(root, h("header", "hud")).lastChild as HTMLElement;
    this.party = add(root, h("aside", "party")).lastChild as HTMLElement;
    this.card = add(root, h("section", "card")).lastChild as HTMLElement;
    this.card.setAttribute("aria-live", "polite");
    this.cine = add(root, h("div", "cine")).lastChild as HTMLElement;
    const skip = h("button", "skip", "Skip ▸▸");
    skip.type = "button";
    skip.addEventListener("click", () => handlers.skip());
    add(this.cine, h("div", "bar top"), h("div", "bar bottom"), skip);
    this.caption = add(root, h("div", "caption")).lastChild as HTMLElement;
    this.toastEl = add(root, h("div", "toast")).lastChild as HTMLElement;
    this.tooltip = add(root, h("div", "tip")).lastChild as HTMLElement;
    document.addEventListener("keydown", (ev) => {
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      const t = (ev.target as HTMLElement | null)?.tagName;
      if (t === "INPUT" || t === "TEXTAREA") return;
      if (this.busy && (ev.key === " " || ev.key === "Enter" || ev.key === "Escape")) {
        ev.preventDefault();
        handlers.skip();
        return;
      }
      if (!this.busy && /^[1-9]$/.test(ev.key) && this.hot[Number(ev.key)]) {
        ev.preventDefault();
        handlers.choose(this.hot[Number(ev.key)]);
      }
    });
  }

  // ---------------------------------------------------------------- state

  setBusy(on: boolean): void {
    this.busy = on;
    this.root.classList.toggle("is-busy", on);
  }

  say(text: string, sub = ""): void {
    this.caption.replaceChildren();
    if (text) add(this.caption, h("div", "cap-main", text), sub ? h("div", "cap-sub", sub) : null);
    this.caption.classList.toggle("on", !!text);
  }

  toast(msg: string): void {
    this.toastEl.textContent = msg;
    this.toastEl.classList.remove("on");
    void this.toastEl.offsetWidth;
    this.toastEl.classList.add("on");
  }

  tip(text: string | null, x = 0, y = 0): void {
    if (!text) {
      this.tooltip.classList.remove("on");
      return;
    }
    this.tooltip.textContent = text;
    this.tooltip.style.left = `${x}px`;
    this.tooltip.style.top = `${y}px`;
    this.tooltip.classList.add("on");
  }

  /** Centre of the screen area not covered by the card and party dock, as offsets from centre. */
  freeCenter(): { fx: number; fy: number } {
    const W = window.innerWidth;
    const H = window.innerHeight;
    if (this.busy || this.root.classList.contains("at-title") || !this.card.firstChild) return { fx: 0, fy: 0 };
    const card = this.card.getBoundingClientRect();
    const party = this.party.firstChild ? this.party.getBoundingClientRect() : null;
    const hudH = this.hud.getBoundingClientRect().height * 0.8;
    if (card.width > W * 0.8) {
      // Bottom sheet: the free area is between the HUD and the card (or the party strip).
      const bottom = party && party.top < card.top ? party.top : card.top;
      const cy = (hudH + bottom) / 2;
      return { fx: 0, fy: Math.max(-0.35, Math.min(0.35, (cy - H / 2) / H)) };
    }
    const left = party ? party.right : 0;
    const cx = (left + card.left) / 2;
    return { fx: Math.max(-0.3, Math.min(0.3, (cx - W / 2) / W)), fy: 0.03 };
  }

  // ---------------------------------------------------------------- title

  showTitle(saved: { day: number; miles: number } | null): void {
    this.root.classList.add("at-title");
    this.hud.replaceChildren();
    this.party.replaceChildren();
    this.card.replaceChildren();
    this.title?.remove();
    const t = h("div", "title");
    const left = h("div", "title-words");
    const h1 = h("h1");
    h1.innerHTML = "The Great <span>Haze</span>";
    add(left, h1, h("p", "tag", "The sky is bleeding, and something is walking behind you."), h("p", "tagsub", "840 miles to the Blue Reach. Buy what you can afford, choose who comes, and never stop for anything you cannot afford to lose."));
    const form = h("form", "panel begin");
    form.setAttribute("autocomplete", "off");
    const nameL = h("label", "f", "Wagon-master");
    nameL.htmlFor = "leader-name";
    const name = h("input");
    name.type = "text";
    name.id = "leader-name";
    name.value = "Marlowe Crane";
    name.maxLength = 28;
    add(nameL, name);
    const choices = (legend: string, key: string, items: { id: string; name: string; blurb: string }[], def: string) => {
      const fs = h("fieldset", "choices");
      add(fs, h("legend", "", legend));
      for (const it of items) {
        const lab = h("label", "choice");
        const inp = h("input");
        inp.type = "radio";
        inp.name = key;
        inp.value = it.id;
        inp.id = `${key}-${it.id}`;
        inp.checked = it.id === def;
        const body = h("span");
        add(body, h("b", "", it.name), h("small", "", it.blurb));
        add(fs, add(lab, inp, body));
      }
      return fs;
    };
    const go = this.button("Muster the train", "", true);
    go.type = "submit";
    add(
      form,
      nameL,
      choices("Your past", "background", BACKGROUNDS.map((b) => ({ id: b.id, name: b.name, blurb: b.blurb })), "surveyor"),
      choices("The road", "difficulty", Object.entries(DIFFICULTY).map(([id, d]) => ({ id, name: d.name, blurb: d.blurb })), "normal"),
    );
    if (saved) {
      const cont = this.button(`Continue: day ${saved.day}, mile ${saved.miles}`, "Your last train is still on the road.");
      cont.addEventListener("click", () => this.handlers.resume());
      add(form, cont);
    }
    add(form, go);
    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const bg = form.querySelector<HTMLInputElement>('input[name="background"]:checked')?.value ?? "surveyor";
      const df = (form.querySelector<HTMLInputElement>('input[name="difficulty"]:checked')?.value ?? "normal") as "normal" | "dire";
      this.handlers.start({ leaderName: name.value.trim() || "The Wagon-Master", background: bg, difficulty: df });
    });
    add(t, left, form);
    add(t, h("p", "foot", "Drag to look around. Keys 1–9 choose; Space skips a cinematic. Runs save in this browser."));
    this.title = t;
    this.root.appendChild(t);
  }

  hideTitle(): void {
    this.root.classList.remove("at-title");
    this.title?.remove();
    this.title = null;
  }

  // ---------------------------------------------------------------- main render

  render(s: Screen): void {
    this.hot = [];
    this.renderHud(s.hud, s.kind);
    this.renderParty(s.hud.party, s.kind);
    this.renderCard(s);
  }

  refreshHud(s: Screen): void {
    this.renderHud(s.hud, s.kind);
    this.renderParty(s.hud.party, s.kind);
  }

  private renderHud(hud: Hud, kind: Screen["kind"]): void {
    this.hud.replaceChildren();
    if (kind === "setup") return;
    const where = h("div", "where");
    add(where, h("div", "day", `Day ${hud.day}`), h("div", "region", hud.region));
    const gauge = h("div", "gauge");
    const total = TUNING.totalMiles;
    const head = h("div", "gauge-head");
    const zone = h("span", `zone zone-${hud.zone}`, hud.zone.toUpperCase());
    add(head, h("span", "gap", `Haze ${Math.round(hud.gap)} mi behind`), zone, h("span", "rate", `~${hud.hazeToday} mi/day`));
    const track = h("div", "track");
    const pct = (m: number) => `${Math.max(0, Math.min(100, (m / total) * 100))}%`;
    const band = h("div", "band");
    band.style.width = pct(Math.max(0, hud.miles - hud.gap));
    add(track, h("div", "line"), band);
    for (const lm of LANDMARKS) {
      const m = h("div", `mark${lm.mile <= hud.miles ? " passed" : ""}${lm.id === "the-gate" ? " reach" : ""}`);
      m.style.left = pct(lm.mile);
      m.title = `${lm.name} (mile ${lm.mile})`;
      track.appendChild(m);
    }
    const wagon = svg(ICONS.wagons, "wagon");
    wagon.style.left = pct(hud.miles);
    add(track, wagon);
    add(gauge, head, track, h("div", "gauge-foot", `mile ${hud.miles} of ${total}`));
    const res = h("div", "res");
    const mouths = Math.max(1, hud.party.length);
    const perDay = Math.max(1, Math.ceil(mouths * RATIONS[hud.rations].perHead));
    const foodDays = hud.res.rations / perDay;
    for (const id of RESOURCE_IDS) {
      const v = hud.res[id];
      let cls = "";
      if (id === "rations") cls = foodDays < 3 ? "crit" : foodDays < 7 ? "low" : "";
      if (id === "torches" && hud.gap < TUNING.torchGap) cls = v < 3 ? "crit" : v < 6 ? "low" : "";
      const chip = h("div", `chip ${cls}`);
      chip.title = id === "rations" ? `${RES_LABEL[id]}: about ${foodDays.toFixed(1)} days at ${RATIONS[hud.rations].name.toLowerCase()} rations` : RES_LABEL[id];
      add(chip, svg(ICONS[id]), h("b", "", v));
      res.appendChild(chip);
    }
    const scrip = h("div", "chip");
    scrip.title = "Company scrip";
    add(scrip, svg(ICONS.scrip), h("b", "", hud.scrip));
    const wag = h("div", `chip ${hud.condition < 40 ? "low" : ""}`);
    wag.title = `${hud.wagons} wagons, ${hud.condition}% sound. Cargo ${hud.cargoUsed} of ${hud.cargoCap}.`;
    add(wag, svg(ICONS.wagons), h("b", "", `${hud.wagons}·${hud.condition}%`));
    add(res, scrip, wag);
    const tools = h("div", "tools");
    const snd = h("button", "tool");
    snd.type = "button";
    snd.title = "Sound";
    snd.appendChild(svg(this.soundOn ? ICONS.sound : ICONS.mute));
    snd.addEventListener("click", () => {
      this.soundOn = this.handlers.toggleSound();
      snd.replaceChildren(svg(this.soundOn ? ICONS.sound : ICONS.mute));
    });
    const q = h("button", "tool");
    q.type = "button";
    q.title = "Graphics quality";
    q.appendChild(svg(ICONS.camera));
    q.addEventListener("click", () => this.toast(`Graphics: ${this.handlers.toggleQuality()}`));
    const ab = h("button", "tool text abandon", this.confirmAbandon ? "Abandon? Yes" : "Abandon");
    ab.type = "button";
    ab.addEventListener("click", () => {
      if (this.confirmAbandon) {
        this.confirmAbandon = false;
        this.handlers.abandon();
      } else {
        this.confirmAbandon = true;
        ab.textContent = "Abandon? Yes";
        setTimeout(() => {
          this.confirmAbandon = false;
          ab.textContent = "Abandon";
        }, 4000);
      }
    });
    add(tools, snd, q, ab);
    add(this.hud, where, gauge, res, tools);
  }

  setSound(on: boolean): void {
    this.soundOn = on;
  }

  private renderParty(members: MemberView[], kind: Screen["kind"]): void {
    this.party.replaceChildren();
    if (kind === "setup" || kind === "ending") return;
    add(this.party, h("div", "party-head", `The train · ${members.length}`));
    for (const m of members) {
      const tile = h("button", "member");
      tile.type = "button";
      if (m.conditions.some((c) => c === "dying" || c === "turning" || c === "breaking")) tile.classList.add("bad");
      const name = h("div", "m-name", m.name);
      const meta = h("div", "m-meta", `${m.isLeader ? "wagon-master · " : ""}${m.role} · ${m.traits.join(", ")}`);
      const bars = h("div", "m-bars");
      const bar = (label: string, v: number, cls: string) => {
        const b = h("div", `m-bar ${cls}`);
        const i = h("i");
        i.style.width = `${Math.max(0, Math.min(100, v))}%`;
        add(b, h("span", "", label), add(h("div", "tr"), i), h("span", "n", v));
        return b;
      };
      add(bars, bar("HP", m.health, m.health > 60 ? "good" : m.health > 30 ? "warn" : "bad"), bar("Nerve", m.nerve, m.nerve > 55 ? "calm" : m.nerve > 30 ? "warn" : "bad"));
      add(tile, name, meta, bars);
      if (m.conditions.length) {
        const chips = h("div", "m-cond");
        for (const c of m.conditions) chips.appendChild(h("span", /dying|breaking/.test(c) ? "bad" : /fog|turn/.test(c) ? "haze" : "warn", c));
        tile.appendChild(chips);
      }
      tile.addEventListener("click", () => this.handlers.focusMember(m.id));
      tile.addEventListener("mouseenter", () => this.handlers.hoverMember(m.id));
      tile.addEventListener("mouseleave", () => this.handlers.hoverMember(null));
      this.party.appendChild(tile);
    }
  }

  // ---------------------------------------------------------------- cards

  private button(label: string, hint = "", primary = false, opt?: ScreenOption, n?: number, milesPerHour = 1.6): HTMLButtonElement {
    const b = h("button", `opt${primary ? " primary" : ""}${opt?.id === "look" ? " look" : ""}`);
    b.type = "button";
    const body = h("span", "body");
    add(body, h("span", "lab", label));
    if (hint) add(body, h("span", "hint", hint));
    const cost = h("span", "cost");
    if (opt?.hours && !opt.disabled) {
      cost.textContent = `${opt.hours}h`;
      const mi = Math.round(opt.hours * milesPerHour);
      if (mi >= 1) cost.appendChild(h("em", "", `≈ ${mi} mi`));
    }
    add(b, h("span", "n", n ? String(n) : ""), body, cost);
    return b;
  }

  private options(opts: ScreenOption[], mph: number, start = 0): HTMLElement {
    const box = h("div", "opts");
    opts.forEach((o, i) => {
      const n = start + i + 1;
      const primary = o.id === "continue" || o.id === "depart" || o.id === "go" || o.id === "confirm";
      const b = this.button(o.label, o.disabled ?? o.hint ?? "", primary, o, n <= 9 ? n : undefined, mph);
      b.disabled = !!o.disabled;
      if (!o.disabled && n <= 9) this.hot[n] = o.id;
      b.addEventListener("click", () => this.handlers.choose(o.id));
      box.appendChild(b);
    });
    return box;
  }

  private lines(lines: string[]): HTMLElement {
    const box = h("div", "lines");
    for (const l of lines) if (l) box.appendChild(h("p", /^["“]/.test(l) ? "quote" : "", l));
    return box;
  }

  /** Spoken lines as a plain transcript: speaker name and words. The 3D staging comes later. */
  private talk(s: Screen): HTMLElement | null {
    if (!s.talk.length && !s.check) return null;
    const box = h("div", "talk");
    for (const l of s.talk) {
      const p = h("p", `${l.kind} ${l.mood}`);
      add(p, h("span", "who", l.name), document.createTextNode(l.text));
      box.appendChild(p);
    }
    if (s.check) {
      const c = s.check;
      const sign = c.bonus >= 0 ? "+" : "−";
      const r = h("div", `roll${c.success ? "" : " fail"}`);
      add(r, document.createTextNode(`${c.byName} · ${c.kind} · rolled ${c.roll} ${sign} ${Math.abs(c.bonus)} against ${c.dc}: `), h("b", "", c.success ? "success" : "failure"));
      r.title = c.reason;
      box.appendChild(r);
    }
    return box;
  }

  private notes(notes: string[]): HTMLElement | null {
    if (!notes.length) return null;
    const box = h("div", "ledger");
    for (const n of notes) {
      const cls = /^Time:/.test(n) ? "t" : /^\+/.test(n) || /gain|joins|closes|recovers|eases|will live|fever breaks/.test(n) ? "g" : /^-|dying|dead|gone|wounded|falls sick|worse|left behind|No room|Haze gains|taken/.test(n) ? "b" : "n";
      box.appendChild(h("div", cls, n));
    }
    return box;
  }

  private renderCard(s: Screen): void {
    const c = this.card;
    c.replaceChildren();
    c.className = `card kind-${s.kind}`;
    const mph = s.hud ? 1.75 * (0.55 + 0.45 * (s.hud.condition / 100)) : 1.6;
    add(c, h("p", "kicker", this.kickerOverride ?? KICKER[s.kind] ?? ""), h("h2", "", s.title));
    this.kickerOverride = null;
    switch (s.kind) {
      case "setup": {
        add(c, this.lines(s.lines));
        const grid = h("div", "picks");
        let picked = 0;
        s.options.forEach((o) => {
          if (o.id === "confirm") return;
          const on = o.label.startsWith("[x]");
          if (on) picked++;
          const [nm, meta] = o.label.replace(/^\[.\]\s*/, "").split(" — ");
          const b = h("button", `pick${on ? " on" : ""}`);
          b.type = "button";
          b.disabled = !!o.disabled;
          add(b, h("span", "pn", nm), h("span", "pm", meta ?? ""), h("span", "pb", o.hint ?? ""));
          b.addEventListener("click", () => this.handlers.choose(o.id));
          b.addEventListener("mouseenter", () => this.handlers.hoverMember(o.id.slice(5)));
          b.addEventListener("mouseleave", () => this.handlers.hoverMember(null));
          grid.appendChild(b);
        });
        add(c, grid, h("p", "count", `${picked} of 4 chosen. You can also click the people by the fire.`));
        add(c, this.options(s.options.filter((o) => o.id === "confirm"), mph));
        break;
      }
      case "store": {
        add(c, this.lines(s.lines));
        const n = this.notes(s.notes);
        if (n) c.appendChild(n);
        const wrap = h("div", "shop-wrap");
        const t = h("table", "shop");
        const hr = add(h("tr"), h("th", "", "Item"), h("th", "", "Price"), h("th", "", "Have"), h("th", "", ""));
        add(t, add(h("thead"), hr));
        const tb = h("tbody");
        const free = s.hud.cargoCap - s.hud.cargoUsed;
        for (const l of s.store!.lines) {
          const tr = h("tr");
          const first = h("td");
          add(first, add(h("span", "item"), svg(ICONS[l.id]), document.createTextNode(l.name)), h("span", "blurb", l.blurb));
          const step = h("td", "step");
          const can = (k: number) => s.hud.scrip >= l.price * k && l.stock >= k && free >= l.weight * k - 1e-9;
          for (const [q, ok] of [
            [-5, l.owned >= 5],
            [-1, l.owned >= 1],
            [1, can(1)],
            [5, can(5)],
            [10, can(10)],
          ] as [number, boolean][]) {
            const b = h("button", "", `${q > 0 ? "+" : "−"}${Math.abs(q)}`);
            b.type = "button";
            b.disabled = !ok;
            b.setAttribute("aria-label", `${q > 0 ? "Buy" : "Sell"} ${Math.abs(q)} ${l.name}`);
            b.addEventListener("click", () => this.handlers.trade(l.id, q));
            step.appendChild(b);
          }
          add(tr, first, h("td", "num", `${l.price}${l.sellPrice !== l.price ? `/${l.sellPrice}` : ""}`), h("td", "num", l.owned), step);
          tb.appendChild(tr);
        }
        add(t, tb);
        add(c, add(wrap, t));
        const foodDays = s.hud.res.rations / Math.max(1, Math.ceil(s.hud.party.length * RATIONS[s.hud.rations].perHead));
        add(c, h("div", "shop-foot", `Scrip ${s.hud.scrip} · Hold ${s.hud.cargoUsed}/${s.hud.cargoCap} · Food lasts ~${foodDays.toFixed(1)} days`));
        add(c, this.options(s.options, mph));
        break;
      }
      case "plan": {
        add(c, this.lines(s.lines));
        const talk = this.talk(s);
        if (talk) c.appendChild(talk);
        const n = this.notes(s.notes);
        if (n) c.appendChild(n);
        const seg = (label: string, defs: Record<string, { name: string; blurb: string }>, current: string, prefix: string, sub: (id: string) => string) => {
          const g = h("div", "group");
          add(g, h("span", "glab", label));
          const row = h("div", "seg");
          for (const id of Object.keys(defs)) {
            const b = h("button", id === current ? "on" : "");
            b.type = "button";
            add(b, h("span", "sn", defs[id].name), h("span", "sd", sub(id)));
            b.addEventListener("click", () => {
              if (id !== current) this.handlers.choose(prefix + id);
            });
            row.appendChild(b);
          }
          add(g, row, h("p", "seg-hint", defs[current].blurb));
          return g;
        };
        add(c, seg("Pace", PACES, s.hud.pace, "pace:", (id) => (PACES[id as keyof typeof PACES].hours ? `${PACES[id as keyof typeof PACES].hours}h` : "rest")));
        add(c, seg("Rations", RATIONS, s.hud.rations, "rations:", (id) => `${RATIONS[id as keyof typeof RATIONS].perHead}/head`));
        const acts = s.options.filter((o) => !/^(go|pace:|rations:)/.test(o.id));
        if (acts.length) {
          add(c, h("span", "glab", "Before you move"));
          const grid = h("div", "acts");
          for (const o of acts) {
            const b = this.button(o.label, o.disabled ?? o.hint ?? "", false, o, undefined, mph);
            b.disabled = !!o.disabled;
            b.addEventListener("click", () => this.handlers.choose(o.id));
            grid.appendChild(b);
          }
          add(c, grid);
        }
        add(c, this.options(s.options.filter((o) => o.id === "go"), mph));
        break;
      }
      case "combat": {
        add(c, this.lines(s.lines.slice(0, -1)));
        add(c, h("div", "threat", s.lines[s.lines.length - 1]));
        const n = this.notes(s.observations);
        if (n) c.appendChild(n);
        add(c, this.options(s.options, mph));
        break;
      }
      case "ending": {
        const e = s.ending!;
        const epi = h("div", "epi");
        for (const l of e.lines) epi.appendChild(l ? h("p", / — /.test(l) ? "fate" : "", l) : h("div", "sp"));
        add(c, epi, add(h("div", "score"), h("small", "", "Score"), document.createTextNode(String(e.score))));
        const again = this.button("Begin another train", "", true);
        again.addEventListener("click", () => this.handlers.abandon());
        add(c, add(h("div", "opts"), again));
        break;
      }
      default: {
        add(c, this.lines(s.lines));
        const talk = this.talk(s);
        if (talk) c.appendChild(talk);
        if (s.observations.length) {
          const box = h("div", "notice");
          add(box, h("div", "lab", "You notice"));
          for (const o of s.observations) box.appendChild(h("p", "", o));
          c.appendChild(box);
        }
        const n = this.notes(s.notes);
        if (n) c.appendChild(n);
        add(c, this.options(s.options, mph));
      }
    }
    c.scrollTop = 0;
  }
}

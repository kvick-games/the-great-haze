// The parchment map. Draws `hud().map` as an SVG: roads in ink, the road
// travelled heavy, a belief proven wrong struck through in red, and country
// nobody has described faded to a whisper. Coordinates are the game's 0..1 map
// space, fitted to the nodes so a short road still fills the sheet.

import type { MapEdgeView, MapHud, MapNodeView } from "../../../src/game/map-types.ts";
import { add, h } from "./dom.ts";

const NS = "http://www.w3.org/2000/svg";
const VW = 1000;
const VH = 560;

function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, cls?: string, text?: string): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (cls) e.setAttribute("class", cls);
  if (text !== undefined) e.textContent = text;
  return e;
}

type Pt = [number, number];

/** A smooth path through the points (Catmull-Rom converted to cubic segments). */
function smooth(pts: Pt[]): string {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 9, p1[1] + (p2[1] - p0[1]) / 9];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 9, p2[1] - (p3[1] - p1[1]) / 9];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

export interface MapHandle {
  el: HTMLElement;
  /** Emphasise one road (by edge id), or none. */
  highlight(edgeId: string | null): void;
}

export interface MapOptions {
  /** Smaller type and no legend: for the fork card. */
  compact?: boolean;
}

export function renderMap(map: MapHud, opts: MapOptions = {}): MapHandle {
  const wrap = h("div", `parchment${opts.compact ? " compact" : ""}`);
  const nodes = new Map<string, MapNodeView>(map.nodes.map((n) => [n.id, n]));

  // Fit the drawing to what there is to draw, with a margin for labels.
  let minX = 1, maxX = 0, minY = 1, maxY = 0;
  const grow = (x: number, y: number) => {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  };
  for (const n of map.nodes) grow(n.x, n.y);
  for (const e of map.edges) for (const v of e.via) grow(v[0], v[1]);
  const padX = 92, padY = 74;
  const sx = (VW - padX * 2) / Math.max(0.2, maxX - minX);
  const sy = (VH - padY * 2) / Math.max(0.15, maxY - minY);
  const k = Math.min(sx, sy * 1.45);
  const ox = (VW - (maxX - minX) * k) / 2 - minX * k;
  const oy = (VH - (maxY - minY) * k * 0.9) / 2 - minY * k * 0.9;
  const P = (x: number, y: number): Pt => [x * k + ox, y * k * 0.9 + oy];

  const svg = s("svg", { viewBox: `0 0 ${VW} ${VH}`, role: "img", preserveAspectRatio: "xMidYMid meet" }, "map-svg");
  svg.setAttribute("aria-label", "Map of the road");

  // Parchment stains and a torn margin.
  const defs = s("defs");
  const grad = s("radialGradient", { id: "pg", cx: "50%", cy: "48%", r: "75%" });
  add(grad, s("stop", { offset: "0", "stop-color": "#e8d7ae" }), s("stop", { offset: "0.7", "stop-color": "#d5bf8b" }), s("stop", { offset: "1", "stop-color": "#a88a55" }));
  const filt = s("filter", { id: "pf", x: "-5%", y: "-5%", width: "110%", height: "110%" });
  add(filt, s("feTurbulence", { type: "fractalNoise", baseFrequency: "0.9", numOctaves: "2", seed: "3", result: "n" }), s("feColorMatrix", { in: "n", type: "matrix", values: "0 0 0 0 0.3  0 0 0 0 0.2  0 0 0 0 0.08  0 0 0 0.16 0" }));
  add(defs, grad, filt);
  svg.appendChild(defs);
  svg.appendChild(s("rect", { x: 0, y: 0, width: VW, height: VH, fill: "url(#pg)" }));
  svg.appendChild(s("rect", { x: 0, y: 0, width: VW, height: VH, filter: "url(#pf)", opacity: "0.7" }));
  svg.appendChild(s("rect", { x: 10, y: 10, width: VW - 20, height: VH - 20, fill: "none", stroke: "#6b4d24", "stroke-width": 2, opacity: "0.45" }));

  const roads = s("g", { class: "roads" });
  const edgeEls = new Map<string, SVGGElement>();
  const known = (e: MapEdgeView) => e.danger !== null || e.twist !== "unknown" || e.travelled || e.source !== "rough";

  for (const e of map.edges) {
    const a = nodes.get(e.from), b = nodes.get(e.to);
    if (!a || !b) continue;
    const pts: Pt[] = [P(a.x, a.y), ...e.via.map((v) => P(v[0], v[1])), P(b.x, b.y)];
    const d = smooth(pts);
    const g = s("g", {}, `road${e.travelled ? " travelled" : ""}${e.onPath ? " onpath" : ""}${e.wrong ? " wrong" : ""}${known(e) ? "" : " faint"}`);
    g.dataset.edge = e.id;
    add(g, s("path", { d, class: "bed" }), s("path", { d, class: "ink" }));
    // A struck-through belief: a red cross at the road's middle.
    const mid = pts[Math.floor(pts.length / 2)];
    const m: Pt = pts.length % 2 === 0 ? [(pts[pts.length / 2 - 1][0] + mid[0]) / 2, (pts[pts.length / 2 - 1][1] + mid[1]) / 2] : mid;
    if (e.wrong) add(g, s("path", { d: `M${m[0] - 15} ${m[1] - 15}L${m[0] + 15} ${m[1] + 15}M${m[0] + 15} ${m[1] - 15}L${m[0] - 15} ${m[1] + 15}`, class: "strike" }));
    // Believed length and danger pips, under the road's middle.
    if (!opts.compact || e.onPath || e.wrong) {
      const lab = s("g", { transform: `translate(${m[0].toFixed(1)} ${(m[1] + (e.wrong ? 30 : 24)).toFixed(1)})`, class: "elab" });
      add(lab, s("text", { "text-anchor": "middle" }, "emile", `${e.miles} mi`));
      if (e.danger !== null) for (let i = 0; i < 3; i++) lab.appendChild(s("circle", { cx: (i - 1) * 11, cy: 9, r: 3.6 }, i < e.danger ? "pip on" : "pip"));
      g.appendChild(lab);
    }
    const title = s("title");
    title.textContent = `${e.name}, about ${e.miles} miles${e.danger !== null ? `, danger ${e.danger} of 3` : ""}${e.wrong ? " (proved wrong)" : ""}`;
    g.appendChild(title);
    roads.appendChild(g);
    edgeEls.set(e.id, g);
  }
  svg.appendChild(roads);

  const places = s("g", { class: "places" });
  for (const n of map.nodes) {
    const [x, y] = P(n.x, n.y);
    const g = s("g", { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})` }, `place k-${n.kind}${n.visited ? " seen" : ""}${n.current ? " here" : ""}`);
    if (n.kind === "fork") add(g, s("path", { d: "M0 -11L11 0L0 11L-11 0Z", class: "mark" }));
    else if (n.kind === "town" || n.kind === "start" || n.kind === "end") add(g, s("rect", { x: -8, y: -8, width: 16, height: 16, class: "mark" }));
    else add(g, s("circle", { r: 7.5, class: "mark" }));
    if (n.visited) add(g, s("path", { d: "M-4 0L-1 3.5L5 -4", class: "tick" }));
    const above = n.y < 0.55;
    const label = s("text", { y: above ? -17 : 26, "text-anchor": "middle" }, "nlabel", n.name);
    g.appendChild(label);
    places.appendChild(g);
  }
  svg.appendChild(places);

  // The train: a pin at its believed place on the road.
  const [px, py] = P(map.position.x, map.position.y);
  const you = s("g", { transform: `translate(${px.toFixed(1)} ${py.toFixed(1)})`, class: "you" });
  add(you, s("circle", { r: 15, class: "halo" }), s("path", { d: "M0 -19C-6 -12 -8 -8 -8 -4a8 8 0 0 0 16 0C8 -8 6 -12 0 -19Z", class: "pin" }), s("circle", { cy: -4, r: 2.8, class: "pinhole" }));
  const yt = s("title");
  yt.textContent = "The train is here";
  you.appendChild(yt);
  svg.appendChild(you);

  wrap.appendChild(svg);

  // Beliefs that did not hold up, as a plain reading list under the map.
  if (!opts.compact && map.wrong.length) {
    const box = h("ul", "map-wrong");
    for (const w of map.wrong) {
      const li = h("li");
      add(li, h("s", "", w.believed), document.createTextNode(` ${w.truth}`));
      box.appendChild(li);
    }
    wrap.appendChild(box);
  }
  if (!opts.compact && map.maps.length) {
    wrap.appendChild(h("p", "map-src", `Maps held: ${map.maps.map((m) => `${m.name} (${m.right} held, ${m.wrong} wrong)`).join("; ")}`));
  }

  return {
    el: wrap,
    highlight(id) {
      svg.classList.toggle("has-focus", id !== null);
      for (const [eid, g] of edgeEls) g.classList.toggle("focus", eid === id);
    },
  };
}

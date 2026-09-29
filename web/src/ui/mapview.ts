// The parchment map. Draws `hud().map` as an SVG: roads in ink, the road
// travelled heavy, a belief proven wrong struck through in red, and country
// nobody has described faded to a whisper. Coordinates are the game's 0..1 map
// space, fitted to the nodes so a short road still fills the sheet.

import type { MapEdgeView, MapHud, MapNodeView } from "../../../src/game/map-types.ts";
import { add, h } from "./dom.ts";

const NS = "http://www.w3.org/2000/svg";
const VW = 1000;
const VH = 600;

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
  // Map space is abstract, so each axis is stretched to fill the sheet (within reason).
  const kx = sx, ky = Math.min(sy, sx * 1.1);
  const ox = (VW - (maxX - minX) * kx) / 2 - minX * kx;
  const oy = (VH - (maxY - minY) * ky) / 2 - minY * ky;
  const P = (x: number, y: number): Pt => [x * kx + ox, y * ky + oy];

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

  // ---- geometry: every road is a hand-inked curve ----
  // Roads that join the same two places fan out into separate arcs (never crossing), each with a
  // gentle deterministic wobble so no line is ruler-straight.
  const groups = new Map<string, MapEdgeView[]>();
  for (const e of map.edges) {
    if (!nodes.get(e.from) || !nodes.get(e.to)) continue;
    const key = [e.from, e.to].sort().join("|");
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  const bulge = new Map<string, number>();
  for (const list of groups.values()) {
    const first = list[0];
    const A = nodes.get(first.from) as MapNodeView, B = nodes.get(first.to) as MapNodeView;
    const pa = P(A.x, A.y), pb = P(B.x, B.y);
    const len = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) || 1;
    const nx = -(pb[1] - pa[1]) / len, ny = (pb[0] - pa[0]) / len;
    const raw = list.map((e) => {
      const v = e.via[0];
      let d = 0;
      if (v) {
        const q = P(v[0], v[1]);
        d = (q[0] - pa[0]) * nx + (q[1] - pa[1]) * ny;
      }
      return { e, d: Math.max(-len * 0.4, Math.min(len * 0.4, d)) };
    });
    raw.sort((p, q) => p.d - q.d);
    const gap = Math.min(40, Math.max(22, len * 0.16));
    for (let i = 1; i < raw.length; i++) if (raw[i].d - raw[i - 1].d < gap) raw[i].d = raw[i - 1].d + gap;
    // Centre the fan on the chord when it was pushed to one side.
    if (raw.length > 1) {
      const lo = raw[0].d, hi = raw[raw.length - 1].d;
      if (lo > 0) for (const r of raw) r.d -= lo * 0.5;
      else if (hi < 0) for (const r of raw) r.d -= hi * 0.5;
    }
    for (const r of raw) bulge.set(r.e.id, r.d);
  }

  const hashOf = (str: string) => {
    let hsh = 2166136261;
    for (let i = 0; i < str.length; i++) hsh = Math.imul(hsh ^ str.charCodeAt(i), 16777619);
    return ((hsh >>> 0) % 10000) / 10000;
  };
  /** Sample the arc from a to b, bulging by d, wobbling by a slow deterministic ripple. */
  const inkPath = (e: MapEdgeView, a: Pt, b: Pt): Pt[] => {
    const d = bulge.get(e.id) ?? 0;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
    const c1: Pt = [a[0] + ux * len * 0.32 + nx * d * 1.33, a[1] + uy * len * 0.32 + ny * d * 1.33];
    const c2: Pt = [b[0] - ux * len * 0.32 + nx * d * 1.33, b[1] - uy * len * 0.32 + ny * d * 1.33];
    const n = Math.max(6, Math.round(len / 22));
    const f1 = 1.4 + hashOf(e.id + "f") * 1.2, f2 = 3 + hashOf(e.id + "g") * 1.6;
    const p1 = hashOf(e.id + "p") * 6.28, p2 = hashOf(e.id + "q") * 6.28;
    const out: Pt[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, m = 1 - t;
      const x = m * m * m * a[0] + 3 * m * m * t * c1[0] + 3 * m * t * t * c2[0] + t * t * t * b[0];
      const y = m * m * m * a[1] + 3 * m * m * t * c1[1] + 3 * m * t * t * c2[1] + t * t * t * b[1];
      const env = Math.sin(Math.PI * t);
      const w = env * (Math.sin(t * f1 * 6.28 + p1) * 2.6 + Math.sin(t * f2 * 6.28 + p2) * 1.1);
      out.push([x + nx * w, y + ny * w]);
    }
    return out;
  };

  const roadPts = new Map<string, Pt[]>();
  const roadSamples: Pt[] = [];
  for (const e of map.edges) {
    const a = nodes.get(e.from), b = nodes.get(e.to);
    if (!a || !b) continue;
    const pts = inkPath(e, P(a.x, a.y), P(b.x, b.y));
    roadPts.set(e.id, pts);
    for (let i = 0; i < pts.length - 1; i++) {
      const steps = 3;
      for (let j = 0; j < steps; j++) roadSamples.push([pts[i][0] + ((pts[i + 1][0] - pts[i][0]) * j) / steps, pts[i][1] + ((pts[i + 1][1] - pts[i][1]) * j) / steps]);
    }
  }

  // ---- label placement: nothing on a road, nothing on another label ----
  interface Box { x0: number; y0: number; x1: number; y1: number }
  const placed: Box[] = [];
  const fsN = opts.compact ? 31 : 20, fsE = opts.compact ? 26 : 15;
  const nW = (t: string) => t.length * fsN * (opts.compact ? 0.52 : 0.5) + 8;
  const overlap = (a: Box, b: Box) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  const cost = (bx: Box, pen: number): number => {
    let c = pen;
    if (bx.x0 < 14 || bx.x1 > VW - 14 || bx.y0 < 14 || bx.y1 > VH - 14) c += 4000;
    for (const p of placed) if (overlap(bx, p) > 0) c += 500 + overlap(bx, p) * 0.2;
    for (const q of roadSamples) if (q[0] > bx.x0 - 3 && q[0] < bx.x1 + 3 && q[1] > bx.y0 - 3 && q[1] < bx.y1 + 3) c += 9;
    return c;
  };
  const pick = (cands: { box: Box; pen: number }[]) => {
    let best = cands[0], bc = Infinity;
    for (const c of cands) {
      const v = cost(c.box, c.pen);
      if (v < bc) { bc = v; best = c; }
    }
    placed.push(best.box);
    return best.box;
  };

  const [px, py] = P(map.position.x, map.position.y);
  // Obstacles first: place marks and the pin.
  for (const n of map.nodes) {
    const [x, y] = P(n.x, n.y);
    placed.push({ x0: x - 13, y0: y - 13, x1: x + 13, y1: y + 13 });
  }
  placed.push({ x0: px - 12, y0: py - 30, x1: px + 12, y1: py + 10 });

  const nodeLabel = new Map<string, Box>();
  const order = [...map.nodes].sort((p, q) => (q.current ? 1 : 0) - (p.current ? 1 : 0));
  for (const n of order) {
    const [x, y] = P(n.x, n.y);
    const w = nW(n.name), hh = fsN + 4;
    const gapY = 15 + hh / 2, gapX = 16 + w / 2;
    const at = (cx: number, cy: number, pen: number) => ({ box: { x0: cx - w / 2, y0: cy - hh / 2, x1: cx + w / 2, y1: cy + hh / 2 }, pen });
    const cands = [
      at(x, y - gapY - (n.current ? 12 : 0), 0),
      at(x, y + gapY, 2),
      at(x + gapX, y, 6),
      at(x - gapX, y, 6),
      at(x + w * 0.4, y - gapY - 4, 10),
      at(x - w * 0.4, y - gapY - 4, 10),
      at(x + w * 0.4, y + gapY + 4, 12),
      at(x - w * 0.4, y + gapY + 4, 12),
    ];
    for (const [i, r] of [1.6, 2.4, 3.2].entries()) {
      for (let a = 0; a < 12; a++) {
        const ang = (a / 12) * Math.PI * 2 - Math.PI / 2;
        cands.push(at(x + Math.cos(ang) * (gapX * 0.6 + 12) * r * 0.8, y + Math.sin(ang) * (gapY + 6) * r * 0.9, 18 + i * 8 + a * 0.3));
      }
    }
    nodeLabel.set(n.id, pick(cands));
  }

  // "The train", beside the pin.
  const youW = nW("the train") * 0.8;
  const youBox = opts.compact
    ? null
    : pick([
        { box: { x0: px + 18, y0: py - 26, x1: px + 18 + youW, y1: py - 8 }, pen: 0 },
        { box: { x0: px - 18 - youW, y0: py - 26, x1: px - 18, y1: py - 8 }, pen: 1 },
        { box: { x0: px + 18, y0: py + 6, x1: px + 18 + youW, y1: py + 24 }, pen: 3 },
        { box: { x0: px - 18 - youW, y0: py + 6, x1: px - 18, y1: py + 24 }, pen: 4 },
      ]);

  const roads = s("g", { class: "roads" });
  const edgeEls = new Map<string, SVGGElement>();
  const edgeLabs = new Map<string, SVGGElement>();
  const known = (e: MapEdgeView) => e.danger !== null || e.twist !== "unknown" || e.travelled || e.source !== "rough";
  const elabs = s("g", { class: "elabs" });

  for (const e of map.edges) {
    const pts = roadPts.get(e.id);
    if (!pts) continue;
    const d = smooth(pts);
    const g = s("g", {}, `road${e.travelled ? " travelled" : ""}${e.onPath ? " onpath" : ""}${e.wrong ? " wrong" : ""}${known(e) ? "" : " faint"}`);
    g.dataset.edge = e.id;
    add(g, s("path", { d, class: "bed" }), s("path", { d, class: "ink" }));
    const m = pts[Math.floor(pts.length / 2)];
    // A struck-through belief: a red cross at the road's middle.
    if (e.wrong) add(g, s("path", { d: `M${m[0] - 13} ${m[1] - 13}L${m[0] + 13} ${m[1] + 13}M${m[0] + 13} ${m[1] - 13}L${m[0] - 13} ${m[1] + 13}`, class: "strike" }));
    // Believed length and danger pips, beside the road.
    if (!opts.compact || e.onPath || e.wrong) {
      const w = Math.max(`${e.miles} mi`.length * fsE * 0.6, 36) + 4, hh = fsE + 14;
      const cands: { box: Box; pen: number }[] = [];
      for (const [ti, tt] of [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8].entries()) {
        const i = Math.round(tt * (pts.length - 1));
        const q = pts[i], q2 = pts[Math.min(pts.length - 1, i + 1)], q1 = pts[Math.max(0, i - 1)];
        const tx = q2[0] - q1[0], ty = q2[1] - q1[1], tl = Math.hypot(tx, ty) || 1;
        const nx = -ty / tl, ny = tx / tl;
        for (const [side, ring] of [[1, 0], [-1, 0], [1, 1], [-1, 1], [1, 2], [-1, 2]] as [number, number][]) {
          const off = 8 + Math.abs(nx) * w / 2 + Math.abs(ny) * hh / 2 + ring * 22;
          const cx = q[0] + nx * off * side, cy = q[1] + ny * off * side;
          cands.push({ box: { x0: cx - w / 2, y0: cy - hh / 2, x1: cx + w / 2, y1: cy + hh / 2 }, pen: ti * 2 + ring * 5 + (side < 0 ? 0.5 : 0) });
        }
      }
      const bx = pick(cands);
      const lab = s("g", { transform: `translate(${((bx.x0 + bx.x1) / 2).toFixed(1)} ${(bx.y0 + fsE * 0.85).toFixed(1)})`, class: `elab${e.wrong ? " wrong" : ""}` });
      add(lab, s("text", { "text-anchor": "middle" }, "emile", `${e.miles} mi`));
      if (e.danger !== null) for (let i = 0; i < 3; i++) lab.appendChild(s("circle", { cx: (i - 1) * 11, cy: fsE * 0.6 + 4, r: 3.6 }, i < e.danger ? "pip on" : "pip"));
      elabs.appendChild(lab);
      edgeLabs.set(e.id, lab);
    }
    const title = s("title");
    title.textContent = `${e.name}, about ${e.miles} miles${e.danger !== null ? `, danger ${e.danger} of 3` : ""}${e.wrong ? " (proved wrong)" : ""}`;
    g.appendChild(title);
    roads.appendChild(g);
    edgeEls.set(e.id, g);
  }
  svg.appendChild(roads);
  svg.appendChild(elabs);

  const places = s("g", { class: "places" });
  for (const n of map.nodes) {
    const [x, y] = P(n.x, n.y);
    const g = s("g", { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})` }, `place k-${n.kind}${n.visited ? " seen" : ""}${n.current ? " here" : ""}`);
    if (n.kind === "fork") add(g, s("path", { d: "M0 -11L11 0L0 11L-11 0Z", class: "mark" }));
    else if (n.kind === "town" || n.kind === "start" || n.kind === "end") add(g, s("rect", { x: -8, y: -8, width: 16, height: 16, class: "mark" }));
    else add(g, s("circle", { r: 7.5, class: "mark" }));
    if (n.visited) add(g, s("path", { d: "M-4 0L-1 3.5L5 -4", class: "tick" }));
    const lb = nodeLabel.get(n.id);
    if (lb) {
      // A label pushed clear of crowded roads keeps a thin leader to its place.
      const qx = Math.max(lb.x0, Math.min(lb.x1, x)) - x, qy = Math.max(lb.y0, Math.min(lb.y1, y)) - y;
      const dist = Math.hypot(qx, qy);
      if (dist > 24) {
        const f = 13 / dist;
        add(g, s("path", { d: `M${(qx * f).toFixed(1)} ${(qy * f).toFixed(1)}L${(qx * 0.96).toFixed(1)} ${(qy * 0.96).toFixed(1)}`, class: "leader" }));
      }
    }
    if (lb) g.appendChild(s("text", { x: ((lb.x0 + lb.x1) / 2 - x).toFixed(1), y: ((lb.y0 + lb.y1) / 2 - y + fsN * 0.33).toFixed(1), "text-anchor": "middle" }, "nlabel", n.name));
    places.appendChild(g);
  }
  svg.appendChild(places);

  // The train: a pin at its believed place on the road.
  const you = s("g", { transform: `translate(${px.toFixed(1)} ${py.toFixed(1)})`, class: "you" });
  add(you, s("circle", { r: 15, class: "halo" }), s("path", { d: "M0 -19C-6 -12 -8 -8 -8 -4a8 8 0 0 0 16 0C8 -8 6 -12 0 -19Z", class: "pin" }), s("circle", { cy: -4, r: 2.8, class: "pinhole" }));
  const yt = s("title");
  yt.textContent = "The train is here";
  you.appendChild(yt);
  svg.appendChild(you);
  if (youBox) svg.appendChild(s("text", { x: ((youBox.x0 + youBox.x1) / 2).toFixed(1), y: (youBox.y1 - 5).toFixed(1), "text-anchor": "middle" }, "youlabel", "the train"));

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
      for (const [eid, g] of edgeEls) {
        g.classList.toggle("focus", eid === id);
        edgeLabs.get(eid)?.classList.toggle("focus", eid === id);
      }
    },
  };
}

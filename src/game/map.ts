// The route: where the train is on the graph, how it moves along it, and what
// the player believes about the road ahead. Pure state functions over
// GameState; the Game controller calls into this. No randomness is consumed
// here except where a function takes an Rng; every map's accuracy and every
// clue is derived from the seed by hashing, so building a screen never
// disturbs the run and a save replays identically.

import type { GameState, QueueItem, RegionId } from "./types.ts";
import type {
  Accuracy,
  EdgeClaim,
  EdgeDef,
  ForkRouteView,
  ForkView,
  MapCopy,
  MapEdgeView,
  MapHud,
  MapNodeView,
  MapOffer,
  NodeDef,
  RouteEvent,
  RouteState,
  WrongBelief,
} from "./map-types.ts";
import { EDGES, EDGE_BY_ID, MAP_OFFERS, NODES, NODE_BY_ID, NODE_ORDER, OFFER_BY_ID, PHANTOMS, edgeOrder, outEdges } from "./routes.ts";
import type { MapOfferDef } from "./routes.ts";
import { REGIONS } from "./world.ts";
import type { RegionDef } from "./world.ts";
import { TUNING } from "./tuning.ts";
import { hashSeed } from "./rng.ts";
import { firstName, hasTrait, living } from "./party.ts";

const EPS = 1e-6;
const START = "cinder-ford";
const END = "the-gate";

const REGION_BY_ID = new Map<RegionId, RegionDef>(REGIONS.map((r) => [r.id, r]));

// ---------------------------------------------------------------------------
// Hashing (no random stream involved)
// ---------------------------------------------------------------------------

function unit(seed: number, ...parts: (string | number)[]): number {
  let h = hashSeed(`${seed}|${parts.join("|")}`) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

function pickBy<T>(items: readonly T[], u: number): T {
  return items[Math.min(items.length - 1, Math.floor(u * items.length))];
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export function initRoute(): RouteState {
  return { node: START, edge: null, along: 0, path: [], visited: [START], beats: [], known: [], wrong: [], maps: [], checks: {}, bad: [], hold: 0, crossed: [] };
}

/** Old saves carry no route: place the train on the main road at its odometer reading. */
export function migrateRoute(s: GameState): void {
  const route = initRoute();
  let left = s.miles;
  for (const e of EDGES.filter((x) => x.main)) {
    if (left >= e.miles - EPS) {
      left -= e.miles;
      route.path.push(e.id);
      route.node = e.to;
      route.edge = null;
      route.along = 0;
      if (!route.visited.includes(e.to)) route.visited.push(e.to);
      continue;
    }
    if (left > EPS) {
      route.path.push(e.id);
      route.edge = e.id;
      route.along = left;
      route.node = e.from;
    }
    break;
  }
  // Landmarks the old game reported that lie behind us are no longer news.
  s.landmarks = s.landmarks.filter((id) => NODE_BY_ID.has(id));
  for (const id of route.visited) if (!s.landmarks.includes(id) && NODE_BY_ID.get(id)?.kind !== "start") s.landmarks.push(id);
  // Pending or queued arrivals at places that no longer exist are dropped or turned into forks.
  const fix = (q: QueueItem): QueueItem | null => {
    if (q.t !== "arrival") return q;
    if (NODE_BY_ID.has(q.id)) return q;
    if (q.id === "glass-fork") return { t: "fork", node: "glass-cross" };
    return null;
  };
  s.queue = s.queue.map(fix).filter((q): q is QueueItem => q !== null);
  if (s.pending.kind === "arrival" && !NODE_BY_ID.has(s.pending.id)) {
    s.pending = s.pending.id === "glass-fork" ? { kind: "fork", node: "glass-cross" } : { kind: "plan" };
    if (s.pending.kind === "fork") {
      route.node = "glass-cross";
      route.edge = null;
      route.along = 0;
    }
  }
  s.route = route;
}

export function ensureRoute(s: GameState): void {
  if (!s.route) migrateRoute(s);
}

// ---------------------------------------------------------------------------
// Where we are
// ---------------------------------------------------------------------------

export function nodeAt(s: GameState): NodeDef {
  return NODE_BY_ID.get(s.route.node) as NodeDef;
}

/** The road being travelled, or the one about to be (from a plain node). Null at a fork or the end. */
export function activeEdge(s: GameState): EdgeDef | null {
  const r = s.route;
  if (r.edge) return EDGE_BY_ID.get(r.edge) ?? null;
  const n = NODE_BY_ID.get(r.node);
  if (!n || n.kind === "fork" || n.kind === "end") return null;
  return outEdges(n.id)[0] ?? null;
}

export function regionOf(s: GameState): RegionDef {
  const e = activeEdge(s);
  if (e) return REGION_BY_ID.get(e.terrain) as RegionDef;
  return REGION_BY_ID.get(nodeAt(s).region) as RegionDef;
}

export function atFork(s: GameState): boolean {
  return s.route.edge === null && nodeAt(s).kind === "fork";
}

export function atEnd(s: GameState): boolean {
  return s.route.edge === null && s.route.node === END;
}

export function wagonSpeedFactor(s: GameState): number {
  return 0.55 + 0.45 * (s.train.condition / 100);
}

/** Miles per travel hour on a given road right now. */
export function mphOn(s: GameState, e: EdgeDef): number {
  return TUNING.baseMph * (REGION_BY_ID.get(e.terrain) as RegionDef).terrain * (e.speed ?? 1) * wagonSpeedFactor(s);
}

export function hazeMult(s: GameState): number {
  return activeEdge(s)?.hazeMult ?? 1;
}

export function wearMult(s: GameState): number {
  return activeEdge(s)?.wear ?? 1;
}

export function forageMult(s: GameState): number {
  return activeEdge(s)?.forage ?? 1;
}

/** Extra chance of trouble on the road ahead. */
export function encounterBonus(s: GameState): number {
  const e = activeEdge(s);
  return e ? 0.08 * (e.danger - 1) : 0;
}

/** Miles left to the Blue Reach, assuming the main road wherever a fork is still ahead. */
export function routeRemaining(s: GameState): number {
  const r = s.route;
  let node = r.node;
  let total = 0;
  if (r.edge) {
    const e = EDGE_BY_ID.get(r.edge) as EdgeDef;
    total += e.miles - r.along;
    node = e.to;
  }
  for (let guard = 0; node !== END && guard < 40; guard++) {
    const outs = outEdges(node);
    const e = outs.find((x) => x.main) ?? outs[0];
    if (!e) break;
    total += e.miles;
    node = e.to;
  }
  return total;
}

/** Odometer reading at which the train would reach the Reach, if it holds to the roads it has chosen. */
export function routeLength(s: GameState): number {
  return s.miles + routeRemaining(s);
}

// ---------------------------------------------------------------------------
// Moving
// ---------------------------------------------------------------------------

export interface MoveResult {
  distance: number;
  hitFork: boolean;
  arrivedAtEnd: boolean;
}

function run(s: GameState, budget: { hours: number } | { miles: number }): MoveResult {
  const r = s.route;
  let hours = "hours" in budget ? budget.hours : Infinity;
  let miles = "miles" in budget ? budget.miles : Infinity;
  let distance = 0;
  let hitFork = false;
  for (let guard = 0; guard < 60 && hours > EPS && miles > EPS; guard++) {
    if (r.edge === null) {
      const n = nodeAt(s);
      if (n.kind === "end") break;
      if (n.kind === "fork") {
        hitFork = true;
        r.hold = Number.isFinite(hours) ? hours : 0;
        break;
      }
      const next = outEdges(n.id)[0];
      if (!next) break;
      r.edge = next.id;
      r.along = 0;
      r.path.push(next.id);
    }
    const e = EDGE_BY_ID.get(r.edge as string) as EdgeDef;
    const spd = mphOn(s, e);
    const toEnd = e.miles - r.along;
    // The next beat still to play on this road.
    let stop = toEnd;
    let beat = -1;
    (e.beats ?? []).forEach((bt, i) => {
      if (r.beats.includes(`${e.id}#${i}`)) return;
      const d = Math.max(0, bt.at * e.miles - r.along);
      if (d < stop || (beat < 0 && d <= stop)) {
        stop = d;
        beat = i;
      }
    });
    const can = Math.min(hours * spd, miles);
    const step = Math.min(can, stop);
    r.along += step;
    distance += step;
    s.miles += step;
    if (Number.isFinite(hours)) hours -= step / spd;
    if (Number.isFinite(miles)) miles -= step;
    if (beat >= 0 && step >= stop - EPS) {
      r.beats.push(`${e.id}#${beat}`);
      const bt = (e.beats as NonNullable<EdgeDef["beats"]>)[beat];
      let prep: 0 | 1 = 1;
      let lie: 0 | 1 = 0;
      if (bt.twist) {
        const { claim, source } = claimFor(s, e);
        prep = claim.twist === "known" ? 1 : 0;
        lie = claim.twist === "clear" && source !== "seen" ? 1 : 0;
      }
      r.crossed.push({ k: "beat", edge: e.id, i: beat, prep, lie });
    }
    if (r.along >= e.miles - EPS) {
      r.along = 0;
      r.edge = null;
      r.node = e.to;
      if (!r.visited.includes(e.to)) r.visited.push(e.to);
      if (e.cache) r.crossed.push({ k: "cache", edge: e.id });
      r.crossed.push({ k: "node", id: e.to, via: e.id });
      reviewEdge(s, e);
      const n = NODE_BY_ID.get(e.to) as NodeDef;
      if (n.kind === "fork") {
        hitFork = true;
        r.hold = Number.isFinite(hours) ? Math.max(0, hours) : 0;
        break;
      }
      if (n.kind === "end") break;
    } else if (step <= EPS && beat < 0) {
      break;
    }
  }
  return { distance, hitFork, arrivedAtEnd: atEnd(s) };
}

/** Spend up to `hours` of travel time on the road. Stops at a fork and holds the remaining hours. */
export function travelHours(s: GameState, hours: number): MoveResult {
  return run(s, { hours });
}

/** Cover up to `miles`, never quite reaching the Reach. Stops at a fork. */
export function travelMiles(s: GameState, miles: number): MoveResult {
  const room = Math.max(0, routeRemaining(s) - 1);
  return run(s, { miles: Math.min(miles, room) });
}

/** Take events crossed since the last call and turn them into things the player meets. */
export function takeArrivals(s: GameState): { items: QueueItem[]; caches: string[]; lines: string[] } {
  const items: QueueItem[] = [];
  const caches: string[] = [];
  const lines: string[] = [];
  const events: RouteEvent[] = s.route.crossed;
  s.route.crossed = [];
  for (const ev of events) {
    if (ev.k === "cache") caches.push(ev.edge);
    else if (ev.k === "beat") items.push({ t: "beat", edge: ev.edge, i: ev.i, prep: ev.prep, lie: ev.lie });
    else {
      const n = NODE_BY_ID.get(ev.id) as NodeDef;
      if (!s.landmarks.includes(n.id)) s.landmarks.push(n.id);
      if (n.kind === "fork") items.push({ t: "fork", node: n.id });
      else if (n.kind !== "start") {
        items.push({ t: "arrival", id: n.id });
        lines.push(`You reach ${n.name}.`);
      }
    }
  }
  return { items, caches, lines };
}

// ---------------------------------------------------------------------------
// What the player believes
// ---------------------------------------------------------------------------

function hasTwist(e: EdgeDef): boolean {
  return (e.beats ?? []).some((b) => b.twist);
}

function dangerWord(d: number | null): string {
  return d === null ? "condition unknown" : d <= 1 ? "quiet" : d === 2 ? "risky" : "deadly";
}

export function claimFor(s: GameState, e: EdgeDef): { claim: EdgeClaim; source: string } {
  if (s.route.known.includes(e.id)) {
    return {
      claim: { miles: e.miles, danger: e.danger, twist: hasTwist(e) ? "known" : "clear", note: e.words?.truth },
      source: "seen",
    };
  }
  const order = edgeOrder(e);
  for (let i = s.route.maps.length - 1; i >= 0; i--) {
    const m = s.route.maps[i];
    if (m.fromOrder <= order && m.claims[e.id]) return { claim: m.claims[e.id], source: m.id };
  }
  return { claim: { miles: Math.round(e.miles / 10) * 10, danger: null, twist: "unknown" }, source: "rough" };
}

function nodePos(s: GameState, n: NodeDef): [number, number] {
  const order = NODE_ORDER.get(n.id) as number;
  for (let i = s.route.maps.length - 1; i >= 0; i--) {
    const m = s.route.maps[i];
    if (m.fromOrder <= order && m.jitter[n.id]) return [n.x + m.jitter[n.id][0], n.y + m.jitter[n.id][1]];
  }
  return [n.x, n.y];
}

function phantomsAt(s: GameState, forkId: string): { copy: MapCopy; ph: MapCopy["phantoms"][number] }[] {
  const out: { copy: MapCopy; ph: MapCopy["phantoms"][number] }[] = [];
  const order = NODE_ORDER.get(forkId) as number;
  for (const copy of s.route.maps) {
    if (copy.fromOrder > order) continue;
    for (const ph of copy.phantoms) if (ph.from === forkId && !out.some((o) => o.ph.id === ph.id)) out.push({ copy, ph });
  }
  return out;
}

function wrongIds(s: GameState): Set<string> {
  return new Set(s.route.wrong.map((w) => w.id));
}

function edgeView(s: GameState, e: EdgeDef): MapEdgeView {
  const { claim, source } = claimFor(s, e);
  const wrong = wrongIds(s);
  const v: MapEdgeView = {
    id: e.id,
    from: e.from,
    to: e.to,
    name: e.name,
    via: (e.via ?? []).map((p) => [p[0], p[1]]),
    miles: claim.miles,
    danger: claim.danger,
    terrain: e.terrain,
    twist: claim.twist,
    source,
    travelled: s.route.known.includes(e.id),
    onPath: s.route.path.includes(e.id),
  };
  if (claim.note) v.note = claim.note;
  if (wrong.has(e.id) || wrong.has(`${e.id}#twist`)) v.wrong = true;
  return v;
}

export function mapHud(s: GameState): MapHud {
  const r = s.route;
  const nodes: MapNodeView[] = NODES.map((n) => {
    const [x, y] = nodePos(s, n);
    return {
      id: n.id,
      name: n.name,
      kind: n.kind,
      x: Math.round(x * 1000) / 1000,
      y: Math.round(y * 1000) / 1000,
      visited: r.visited.includes(n.id),
      current: r.edge === null && r.node === n.id,
      store: !!n.storeId,
    };
  });
  const posOf = new Map(nodes.map((n) => [n.id, [n.x, n.y] as [number, number]]));
  const edges: MapEdgeView[] = EDGES.map((e) => edgeView(s, e));
  const badPh = new Set(r.bad);
  for (const copy of r.maps) {
    for (const ph of copy.phantoms) {
      if (edges.some((e) => e.id === ph.id)) continue;
      const v: MapEdgeView = {
        id: ph.id,
        from: ph.from,
        to: ph.to,
        name: ph.name,
        via: ph.via.map((p) => [p[0], p[1]]),
        miles: ph.miles,
        danger: ph.danger,
        terrain: null,
        twist: "clear",
        note: ph.note,
        source: copy.id,
        travelled: false,
        onPath: false,
      };
      if (badPh.has(ph.id)) v.wrong = true;
      edges.push(v);
    }
  }
  // Where the marker sits, drawn on the believed road.
  let x = 0;
  let y = 0;
  let fraction = 0;
  if (r.edge) {
    const e = EDGE_BY_ID.get(r.edge) as EdgeDef;
    fraction = Math.min(1, r.along / e.miles);
    const pts = [posOf.get(e.from) as [number, number], ...(e.via ?? []), posOf.get(e.to) as [number, number]];
    [x, y] = pointAlong(pts, fraction);
  } else {
    [x, y] = posOf.get(r.node) as [number, number];
  }
  const maps = r.maps.map((m) => ({
    id: m.id,
    name: m.name,
    seller: m.seller,
    right: r.checks[m.id]?.[0] ?? 0,
    wrong: r.checks[m.id]?.[1] ?? 0,
  }));
  return {
    nodes,
    edges,
    position: { node: r.node, edge: r.edge, fraction: Math.round(fraction * 1000) / 1000, x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000, atFork: atFork(s) },
    wrong: r.wrong.map((w) => ({ ...w })),
    maps,
  };
}

function pointAlong(pts: [number, number][], f: number): [number, number] {
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    seg.push(d);
    total += d;
  }
  let want = f * total;
  for (let i = 0; i < seg.length; i++) {
    if (want <= seg[i] || i === seg.length - 1) {
      const t = seg[i] > 0 ? Math.min(1, want / seg[i]) : 0;
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t];
    }
    want -= seg[i];
  }
  return pts[pts.length - 1];
}

// ---------------------------------------------------------------------------
// Beliefs meet the ground
// ---------------------------------------------------------------------------

function addWrong(s: GameState, w: WrongBelief): void {
  if (!s.route.wrong.some((x) => x.id === w.id)) s.route.wrong.push(w);
}

function bumpCheck(s: GameState, mapId: string, wrong: boolean): void {
  if (mapId === "rough" || mapId === "seen") return;
  const c = (s.route.checks[mapId] ??= [0, 0]);
  c[wrong ? 1 : 0]++;
}

/** The train has just finished a road: compare what it was told with what it walked. */
function reviewEdge(s: GameState, e: EdgeDef): void {
  const { claim, source } = claimFor(s, e);
  if (source !== "rough" && source !== "seen") {
    const milesOff = Math.abs(claim.miles - e.miles) / e.miles > 0.08;
    const dangerOff = claim.danger !== null && claim.danger !== e.danger;
    if (milesOff || dangerOff) {
      const bits: string[] = [];
      if (milesOff) bits.push(`${claim.miles} miles`);
      if (dangerOff) bits.push(dangerWord(claim.danger));
      addWrong(s, {
        id: e.id,
        kind: "edge",
        believed: `${e.name}: ${bits.join(", ")}${claim.note ? ` (${claim.note})` : ""}`,
        truth: `${e.miles} miles, ${dangerWord(e.danger)}`,
      });
    }
    bumpCheck(s, source, milesOff || dangerOff || (hasTwist(e) && claim.twist === "clear"));
  }
  if (!s.route.known.includes(e.id)) s.route.known.push(e.id);
}

/** A beat is about to play. Settle what the map said about it and return the scene to show. */
export function beginBeat(s: GameState, edgeId: string, i: number, prep: number, lie: number): string {
  const e = EDGE_BY_ID.get(edgeId) as EdgeDef;
  const b = (e.beats ?? [])[i];
  if (b.twist && lie) addWrong(s, { id: `${e.id}#twist`, kind: "edge", believed: b.twist.clear, truth: b.twist.truth });
  s.flags["route:prepared"] = prep;
  return b.scene;
}

// ---------------------------------------------------------------------------
// Forks
// ---------------------------------------------------------------------------

function routeChoices(s: GameState, forkId: string): ForkRouteView[] {
  const out: ForkRouteView[] = [];
  const wrong = wrongIds(s);
  for (const e of outEdges(forkId)) {
    const { claim, source } = claimFor(s, e);
    const v: ForkRouteView = { id: `route:${e.id}`, name: e.name, miles: claim.miles, danger: claim.danger, twist: claim.twist, source };
    if (claim.note) v.note = claim.note;
    if (e.sign) v.sign = e.sign;
    if (wrong.has(e.id)) v.wrong = true;
    out.push(v);
  }
  for (const { copy, ph } of phantomsAt(s, forkId)) {
    if (s.route.bad.includes(ph.id)) continue;
    out.push({ id: `route:${ph.id}`, name: ph.name, miles: ph.miles, danger: ph.danger, twist: "clear", note: ph.note, source: copy.id });
  }
  return out;
}

export function forkView(s: GameState, forkId: string): ForkView {
  return { node: forkId, routes: routeChoices(s, forkId) };
}

export function routeOptionText(v: ForkRouteView): { label: string; hint: string } {
  const bits = [`About ${v.miles} miles`, dangerWord(v.danger)];
  let hint = bits.join(", ") + ".";
  if (v.note) hint += ` "${v.note}"`;
  return { label: v.name, hint };
}

export interface RouteChoice {
  phantom: boolean;
  title: string;
  lines: string[];
  notes: string[];
}

/** Take a road at the fork the train waits at. */
export function chooseRoute(s: GameState, optionId: string): RouteChoice {
  const r = s.route;
  const id = optionId.slice("route:".length);
  const phantom = phantomsAt(s, r.node).find((p) => p.ph.id === id);
  if (phantom) {
    r.bad.push(id);
    addWrong(s, { id, kind: "route", believed: `${phantom.ph.name}: ${phantom.ph.note}`, truth: "There is no such road" });
    bumpCheck(s, phantom.copy.id, true);
    return {
      phantom: true,
      title: "No such road",
      lines: [`You follow ${phantom.ph.name} to a dry gully, a dead mule and a line someone drew with a steady hand. It never existed.`, "You turn the wagons round in the mud."],
      notes: [],
    };
  }
  const e = outEdges(r.node).find((x) => x.id === id);
  if (!e) throw new Error(`No road ${id} at ${r.node}`);
  r.edge = e.id;
  r.along = 0;
  r.path.push(e.id);
  const hold = r.hold;
  r.hold = 0;
  const first = e.sign ?? "";
  const move = travelHours(s, hold);
  return {
    phantom: false,
    title: e.name,
    lines: [first, `Your wheels find the ruts of ${e.name}.`].filter(Boolean),
    notes: move.distance > 0.5 ? [`${Math.round(move.distance)} miles of the day's road are left to you.`] : [],
  };
}

// ---------------------------------------------------------------------------
// Maps for sale
// ---------------------------------------------------------------------------

export function accuracyOf(seed: number, offer: MapOfferDef): Accuracy {
  const u = unit(seed, offer.id, "accuracy");
  const w = offer.weights;
  if (u < w.faithful) return "faithful";
  if (u < w.faithful + w.careless) return "careless";
  return "misleading";
}

export function priceOf(seed: number, offer: MapOfferDef): number {
  const a = accuracyOf(seed, offer);
  const mult = a === "faithful" ? 1 : a === "careless" ? 0.75 : 0.45;
  return Math.max(5, Math.round(offer.price * mult));
}

export interface Clue {
  text: string;
  shows: Accuracy | "noise";
}

const REMARKS: Record<Accuracy, string[]> = {
  faithful: [
    "{n} runs a thumb down the road and nods. \"The bends are right. Someone walked this.\"",
    "{n} finds the place they slept last winter on it, and it is where it should be.",
  ],
  careless: [
    "{n} frowns. \"The river is on the wrong side of that hill. He drew it from memory.\"",
    "{n} taps a blank patch. \"Nobody has been here. He is guessing.\"",
    "{n} says, \"Half of this is hearsay. I would not stake a wagon on it.\"",
  ],
  misleading: [
    "{n} says quietly, \"This was drawn to be believed. Look how sure it is.\"",
    "{n} counts the ink. \"Every hard road is made to look easy. Somebody wants us on it.\"",
    "{n} looks up at the seller, then at the map. \"No. The good road is made to look bad. That is on purpose.\"",
  ],
};

const FALSE_ALARM = [
  "{n} pulls the map away, jaw tight. \"I do not like him. Something is off.\"",
  "{n} whispers, \"It is too neat. Put it back.\"",
];

/** How good a member is at sensing a lie in paper and patter. */
function sense(m: { role: string; traits: string[]; nerve: number }): number {
  let p = m.role === "scout" ? 0.55 : m.role === "speaker" ? 0.5 : m.role === "hunter" ? 0.3 : m.role === "mechanic" ? 0.25 : m.role === "guard" ? 0.2 : 0.15;
  if (m.traits.includes("paranoid")) p += 0.2;
  if (m.traits.includes("veteran")) p += 0.15;
  if (m.traits.includes("haunted")) p += 0.05;
  if (m.traits.includes("kind")) p -= 0.05;
  if (m.nerve < 30) p -= 0.1;
  return Math.max(0.05, Math.min(0.9, p));
}

/** Everything the player can learn about a map before buying it. `shows` is for tools and tests only. */
export function offerClues(s: GameState, offer: MapOfferDef): Clue[] {
  const seed = s.seed;
  const acc = accuracyOf(seed, offer);
  const clues: Clue[] = [];
  for (let i = 0; i < 2; i++) {
    const own = unit(seed, offer.id, "tell-from", i) < 0.7;
    const others = (["faithful", "careless", "misleading"] as Accuracy[]).filter((a) => a !== acc);
    const from: Accuracy = own ? acc : pickBy(others, unit(seed, offer.id, "tell-other", i));
    const text = pickBy(offer.tells[from], unit(seed, offer.id, "tell-pick", i));
    if (!clues.some((c) => c.text === text)) clues.push({ text, shows: from });
  }
  const ratio = priceOf(seed, offer) / offer.price;
  if (ratio < 0.6 && unit(seed, offer.id, "price-clue") < 0.85) {
    clues.push({ text: "It costs a fraction of what a chart of this size is worth.", shows: "misleading" });
  } else if (acc === "faithful" && unit(seed, offer.id, "price-noise") < 0.1) {
    clues.push({ text: "He is selling it cheap. He says he is leaving the road.", shows: "noise" });
  }
  // Someone in the party has a feeling.
  let best: { name: string; skill: number; roll: number; false: boolean } | null = null;
  for (const m of living(s)) {
    const skill = sense(m);
    const roll = unit(seed, offer.id, "notice", m.id);
    if (acc !== "faithful" && roll < skill) {
      if (!best || skill > best.skill) best = { name: firstName(m), skill, roll, false: false };
    } else if (acc === "faithful" && m.nerve < 30 && unit(seed, offer.id, "false-alarm", m.id) < 0.3 && !hasTrait(m, "stoic")) {
      if (!best) best = { name: firstName(m), skill, roll, false: true };
    }
  }
  if (best) {
    const pool = best.false ? FALSE_ALARM : REMARKS[acc];
    const text = pickBy(pool, unit(seed, offer.id, "remark")).replace("{n}", best.name);
    clues.push({ text, shows: best.false ? "misleading" : acc });
  }
  return clues;
}

export function mapOffersAt(s: GameState, storeId: string): MapOffer[] {
  return MAP_OFFERS.filter((o) => o.storeId === storeId).map((o) => {
    const clues = offerClues(s, o);
    return {
    id: o.id,
    name: o.name,
    seller: o.seller,
    price: priceOf(s.seed, o),
    pitch: o.pitch,
    clues: clues.map((c) => c.text),
    tells: clues.map((c, i) => ({ id: `map:${o.id}:${i}`, text: c.text, visible: true, severity: c.text.includes("\"") ? 2 : 1 })),
    owned: s.route.maps.some((m) => m.id === o.id),
    };
  });
}

export function makeMapCopy(seed: number, offer: MapOfferDef): MapCopy {
  const acc = accuracyOf(seed, offer);
  const fromOrder = NODE_ORDER.get(offer.fromNode) as number;
  const claims: Record<string, EdgeClaim> = {};
  const jitter: Record<string, [number, number]> = {};
  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
  for (const e of EDGES) {
    if (edgeOrder(e) < fromOrder) continue;
    const u = (k: string) => unit(seed, offer.id, e.id, k);
    const fromFork = (NODE_BY_ID.get(e.from) as NodeDef).kind === "fork";
    const truthClaim: EdgeClaim = { miles: e.miles, danger: e.danger, twist: hasTwist(e) ? "known" : "clear", note: e.words?.truth };
    if (acc === "faithful") {
      claims[e.id] = truthClaim;
    } else if (acc === "careless") {
      const miles = u("m") < 0.5 ? e.miles : Math.round(e.miles * (1 + (u("mm") - 0.5) * 0.5));
      const dz = u("d");
      const danger = clamp(e.danger + (dz < 0.3 ? -1 : dz > 0.75 ? 1 : 0), 1, 3);
      const twist: EdgeClaim["twist"] = hasTwist(e) ? (u("t") < 0.5 ? "known" : "clear") : "clear";
      const note = twist === "known" || u("n") < 0.4 ? e.words?.truth : e.words ? "Drawn from hearsay." : undefined;
      claims[e.id] = { miles, danger, twist, note };
    } else if (!fromFork || u("keep") < 0.15) {
      claims[e.id] = truthClaim;
    } else {
      const bad = hasTwist(e) || (e.danger >= 2 && !e.main);
      if (bad) {
        claims[e.id] = { miles: Math.round(e.miles * 0.88), danger: 1, twist: "clear", note: e.words?.rosy ?? "A good road." };
      } else {
        claims[e.id] = { miles: Math.round(e.miles * 1.12), danger: Math.min(3, e.danger + 1), twist: "clear", note: e.words?.grim ?? "Wet, slow, and watched." };
      }
    }
  }
  if (acc === "careless") {
    for (const n of NODES) {
      if ((NODE_ORDER.get(n.id) as number) < fromOrder) continue;
      const dx = (unit(seed, offer.id, n.id, "jx") - 0.5) * 0.05;
      const dy = (unit(seed, offer.id, n.id, "jy") - 0.5) * 0.05;
      jitter[n.id] = [Math.round(dx * 1000) / 1000, Math.round(dy * 1000) / 1000];
    }
  }
  const phantoms: MapCopy["phantoms"] = [];
  if (acc === "misleading") {
    for (const p of PHANTOMS) {
      if ((NODE_ORDER.get(p.fork) as number) < fromOrder) continue;
      phantoms.push({ id: p.id, from: p.fork, to: p.to, name: p.name, miles: p.miles, danger: p.danger, note: p.note, via: p.via });
    }
  }
  return { id: offer.id, name: offer.name, seller: offer.seller, accuracy: acc, fromOrder, claims, phantoms, jitter };
}

/** Buy a map. Returns the note to show. Throws if it cannot be done. */
export function buyMap(s: GameState, offerId: string, storeId: string): string {
  const offer = OFFER_BY_ID.get(offerId);
  if (!offer || offer.storeId !== storeId) throw new Error(`No such map here: ${offerId}`);
  if (s.route.maps.some((m) => m.id === offerId)) throw new Error("You already carry that map.");
  const price = priceOf(s.seed, offer);
  if (s.scrip < price) throw new Error("You cannot afford that map.");
  s.scrip -= price;
  s.route.maps.push(makeMapCopy(s.seed, offer));
  return `-${price} scrip. ${offer.seller} hands over ${offer.name.toLowerCase()}. It goes into your coat, and into your plans.`;
}

// The witch: mechanics for the multi-stage abduction storyline (content lives in
// content/scenes/witch.ts). A person she takes is not dead. They are marked
// `captive` and `alive: false`, so every "who is on the train" rule already treats
// them as gone, and a rescue simply flips them back. Everything here is
// deterministic under the run's seed.
//
// Storyline flags (all in GameState.flags):
//   witch:stage    0 nothing yet, 1 signs seen, 2 someone is taken, 3 resolved
//   witch:due      the day the witch comes for the camp, once the signs were seen
//   witch:warded   1 if the camp was warded before she came
//   witch:lore     1 if someone studied her marks (small edge on the wagon-master's side)
//   witch:demand   what she asks for at her table: 0 supplies, 1 years, 2 a memory, 3 a person
//   witch:fought   1 once the party fought her at the ring
//   witch:bargained 1 once bargaining at the ring was tried
//   witch:lost / witch:rescued / witch:abandoned   counters for hauntings and epilogues
//   witch:haunts   how many times a lost voice has called from the fog
//
// Ties (see relationships.ts): losing or trading someone hits their spouse, lover
// and close friends harder, writes history lines, and sours those ties to the
// wagon-master; a rescue with a close one aboard goes better.

import type { Effect, GameState, Mark, Member } from "./types.ts";
import type { Env } from "./effects.ts";
import { changeNerve, exposeToFog, killMember } from "./effects.ts";
import { addBond, bond, clamp, firstName, hasMark, hasTrait, leader, living, remember } from "./party.ts";
import { changeKind, kindOf, onDeath, onDeparture } from "./relationships.ts";
import { RATIONS, TUNING, zoneOf } from "./tuning.ts";
import { baseHazeMiles, catchupMiles } from "./travel.ts";

export const CAPTIVE_FATE = "taken by the witch";
/** The smallest the gap is allowed to get from time spent off the road. The Haze does the rest. */
const MIN_GAP = 2;

export function captivesOf(s: GameState): Member[] {
  return s.party.filter((m) => m.captive);
}

/** Everyone the witch ever took who is not on the train now, oldest first. */
export function takenOf(s: GameState): Member[] {
  return s.party.filter((m) => m.taken && !m.alive);
}

export function nameList(ms: Member[]): string {
  const names = ms.map(firstName);
  if (names.length <= 1) return names[0] ?? "no one";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

// ---------------------------------------------------------------------------
// Taking
// ---------------------------------------------------------------------------

const RESIST_DC = 12;

/** How well a person holds against her voice. Nerve and character, not luck alone. */
export function resistBonus(s: GameState, m: Member, ward: boolean): number {
  let b = clamp(Math.round((m.nerve - 50) / 15), -3, 2);
  if (hasTrait(m, "stoic")) b += 2;
  if (hasTrait(m, "pious")) b += 2;
  if (hasTrait(m, "veteran")) b += 1;
  if (hasTrait(m, "paranoid")) b += 1;
  if (hasTrait(m, "haunted")) b -= 2;
  if (hasTrait(m, "coward")) b -= 2;
  if (hasTrait(m, "sickly")) b -= 1;
  if (m.sick || m.wounded) b -= 1;
  if (hasMark(m, "hexed")) b -= 2;
  if (ward) b += 4;
  if ((s.flags["witch:warded"] ?? 0) > 0) b += 3;
  if ((s.flags["witch:lore"] ?? 0) > 0) b += 1;
  return b;
}

type Tie = "couple" | "close" | "friend" | "none";

/** What two people are to each other, as far as the witch storyline cares. */
function tieOf(s: GameState, a: Member, b: Member): Tie {
  const k = kindOf(s, a.id, b.id);
  if (k === "spouses" || k === "lovers" || k === "courting") return "couple";
  if (k === "close-friend") return "close";
  if (k === "friend") return "friend";
  return "none";
}

function abduct(env: Env, ward: boolean, notes: string[]): void {
  const { s, rng } = env;
  const pool = living(s).filter((m) => !m.isLeader);
  if (!pool.length) return;
  // She comes for as many as she can carry. Three only when the camp is frayed or the Haze is on top of it.
  const avg = pool.reduce((n, m) => n + m.nerve, 0) / pool.length;
  const roll = rng.next();
  let count = roll < 0.65 ? 1 : roll < 0.93 ? 2 : avg < 55 || s.gap < 30 ? 3 : 2;
  if (ward) count = Math.max(1, count - 1);
  count = Math.min(count, pool.length);
  const margins = pool.map((m) => {
    const d20 = rng.int(1, 20);
    const bonus = resistBonus(s, m, ward);
    const held = d20 === 20 || (d20 !== 1 && d20 + bonus >= RESIST_DC);
    return { m, margin: d20 + bonus - RESIST_DC + (d20 === 1 ? -10 : 0) + (d20 === 20 ? 10 : 0), held };
  });
  // The weakest resolve goes first. She always takes at least one: nobody outlasts her forever.
  const order = margins.slice().sort((a, b) => a.margin - b.margin);
  const failed = order.filter((x) => !x.held);
  const chosen = (failed.length ? failed : order).slice(0, Math.min(count, Math.max(1, failed.length)));
  const chosenIds = new Set(chosen.map((x) => x.m.id));
  const resisted = margins.filter((x) => x.held && !chosenIds.has(x.m.id) && x.margin >= 4).map((x) => x.m);
  for (const { m } of chosen) {
    m.alive = false;
    m.dying = false;
    m.captive = true;
    m.taken = true;
    m.fate = CAPTIVE_FATE;
  }
  s.flags["witch:stage"] = 2;
  s.flags["witch:demand"] = rng.int(0, 3);
  notes.push(`The witch takes ${nameList(chosen.map((x) => x.m))}.`);
  if (resisted.length) notes.push(`${nameList(resisted)} held fast against her voice.`);
  for (const { m } of chosen) remember(s, m, "Taken by the witch.");
  for (const other of living(s)) {
    let loss = 4;
    for (const { m } of chosen) {
      const tie = other.isLeader ? "none" : tieOf(s, other, m);
      if (tie === "couple") {
        loss += 8;
        remember(s, other, `Watched ${firstName(m)} taken by the witch.`);
      } else if (tie === "close") loss += 4;
      else if (bond(s, other.id, m.id) >= 40) loss += 3;
    }
    changeNerve(other, -loss);
  }
  notes.push("Everyone else: nerve falls");
}

// ---------------------------------------------------------------------------
// Giving back and losing
// ---------------------------------------------------------------------------

function finishStory(s: GameState): void {
  if (!captivesOf(s).length) s.flags["witch:stage"] = 3;
}

function applyMark(m: Member, mark: Mark, notes: string[]): boolean {
  if (hasMark(m, mark)) return false;
  (m.marks ?? (m.marks = [])).push(mark);
  if (mark === "aged") {
    m.maxHealth = Math.max(30, m.maxHealth - 15);
    m.health = Math.min(m.health, m.maxHealth);
    notes.push(`${firstName(m)} is years older. (max health -15)`);
  } else if (mark === "hexed") notes.push(`${firstName(m)} is hexed. Fear finds them faster.`);
  else if (mark === "witch-touched") notes.push(`${firstName(m)} is witch-touched. They hear the fog, and it hears them.`);
  else notes.push(`${firstName(m)} has forgotten faces they should know. (worse at reading people)`);
  return true;
}

function restore(env: Env, changed: number, leave: number, notes: string[]): void {
  const { s, rng } = env;
  const held = captivesOf(s);
  if (!held.length) return;
  // Some stay behind if the deal was bad. Chosen by the run's seed, never by the bots' preference.
  const left = rng.shuffle(held).slice(0, Math.min(leave, held.length));
  for (const m of left) lose(env, [m], "kept by the witch", false, notes);
  const back = held.filter((m) => !left.includes(m));
  for (const m of back) {
    m.alive = true;
    m.captive = false;
    m.fate = undefined;
    m.health = Math.max(20, Math.round(m.maxHealth * 0.5));
    m.nerve = clamp(Math.min(m.nerve, 40) - 10, 5, 100);
    m.trust = clamp(m.trust + 8, 0, 100);
    // Someone close aboard makes the coming-back easier: they are met at the wagons, and the hex takes less hold.
    const close = living(s).filter((o) => o.id !== m.id && !o.isLeader && (tieOf(s, o, m) === "couple" || tieOf(s, o, m) === "close"));
    const bonus = close.length > 0;
    if (bonus) {
      m.health = Math.min(m.maxHealth, m.health + Math.round(m.maxHealth * 0.15));
      m.nerve = clamp(m.nerve + 12, 5, 100);
      for (const o of close) {
        addBond(s, o.id, m.id, 10);
        remember(s, o, `Met ${firstName(m)} at the wagons when they came back from the witch.`);
      }
      notes.push(`${firstName(m)} is met by ${nameList(close)}, and mends faster.`);
    }
    remember(s, m, "Came back from the witch's hollow.");
    remember(s, leader(s), `Got ${firstName(m)} back from the witch.`);
    s.flags["witch:rescued"] = (s.flags["witch:rescued"] ?? 0) + 1;
    notes.push(`${m.name} comes back to the wagons, weak, and quiet.`);
    if (rng.chance(bonus ? changed * 0.5 : changed)) {
      const mark: Mark = rng.chance(0.6) ? "hexed" : "witch-touched";
      if (applyMark(m, mark, notes)) remember(s, m, mark === "hexed" ? "The witch left a hex on them." : "The witch left her touch on them. They hear the fog.");
    }
  }
  if (back.length) {
    for (const other of living(s)) if (!back.includes(other)) changeNerve(other, 5);
    notes.push("The train: +5 nerve (they came back)");
  }
  finishStory(s);
}

function lose(env: Env, who: Member[], cause: string, abandon: boolean, notes: string[]): void {
  const { s } = env;
  for (const m of who) {
    m.captive = false;
    m.alive = false;
    m.fate = cause;
    s.stats.deaths++;
    s.flags["witch:lost"] = (s.flags["witch:lost"] ?? 0) + 1;
    if (abandon) s.flags["witch:abandoned"] = (s.flags["witch:abandoned"] ?? 0) + 1;
    notes.push(`${m.name} is lost to the witch.`);
    remember(s, m, abandon ? "Left to the witch." : "Kept by the witch.");
    remember(s, leader(s), abandon ? `Left ${firstName(m)} to the witch.` : `Lost ${firstName(m)} to the witch.`);
    for (const other of living(s)) {
      let loss = abandon ? 5 : 4;
      const tie = other.isLeader ? "none" : tieOf(s, other, m);
      if (tie === "couple") loss += abandon ? 10 : 6;
      else if (tie === "close") loss += abandon ? 5 : 3;
      else if (bond(s, other.id, m.id) >= 40) loss += 4;
      if (hasTrait(other, "kind") || hasTrait(other, "pious")) loss += 3;
      changeNerve(other, -loss);
      if (abandon && !other.isLeader) {
        other.trust = clamp(other.trust - 6, 0, 100);
        remember(s, other, `${firstName(m)} was left to the witch.`);
        if (tie === "couple" || tie === "close") {
          // They saw who chose. It is not forgotten.
          const couple = tie === "couple";
          addBond(s, leader(s).id, other.id, couple ? -25 : -12);
          other.trust = clamp(other.trust - (couple ? 14 : 6), 0, 100);
          remember(s, other, couple ? `Will not forgive the wagon-master for leaving ${firstName(m)}.` : `Cannot look at the wagon-master since ${firstName(m)} was left.`);
        }
      }
    }
    // The ones who loved them grieve on the ordinary path (nerve, and a grief scene).
    onDeath(env, m);
  }
  if (who.length) notes.push(abandon ? "Everyone: trust and nerve fall (they saw you choose)" : "Everyone: nerve falls");
  finishStory(s);
}

/**
 * Her price is one of the crew: the weakest goes. Ties decide the cost. A spouse or lover
 * left behind either follows in the night or stays and never forgives; close friends
 * turn cold. Deterministic under the run's seed.
 */
function giveCrew(env: Env, cause: string, notes: string[]): void {
  const { s, rng } = env;
  const pool = living(s).filter((m) => !m.isLeader);
  if (!pool.length) return;
  const target = pool.reduce((w, m) => (m.health < w.health ? m : w), pool[0]);
  target.alive = false;
  target.dying = false;
  target.fate = cause;
  s.stats.departures++;
  notes.push(`${target.name} is gone: ${cause}.`);
  remember(s, target, `Given to the witch: ${cause}.`);
  const lead = leader(s);
  remember(s, lead, `Gave ${firstName(target)} to the witch.`);
  const others = living(s);
  for (const o of others) remember(s, o, `${firstName(target)} was given to the witch.`);
  const before = s.queue.length;
  onDeparture(env, target);
  // Followers are decided here, not by the generic lover-follows scene.
  s.queue = s.queue.filter((q, i) => i < before || !(q.t === "scene" && q.id === "rel-lover-follows"));
  for (const o of others) {
    if (o.isLeader || !o.alive) continue;
    const tie = tieOf(s, o, target);
    if (tie === "couple") {
      if (rng.chance(0.5)) {
        o.alive = false;
        o.dying = false;
        o.fate = "left in the night, after their own was given to the witch";
        s.stats.departures++;
        notes.push(`${o.name} is gone: ${o.fate}.`);
        remember(s, o, `Left the train after ${firstName(target)} was given to the witch.`);
        remember(s, lead, `${firstName(o)} left after I gave ${firstName(target)} away.`);
      } else {
        changeKind(s, o, target, "estranged");
        addBond(s, lead.id, o.id, -40);
        o.trust = clamp(Math.min(o.trust, 8), 0, 100);
        changeNerve(o, -25);
        remember(s, o, `Will never forgive the wagon-master for giving ${firstName(target)} to the witch.`);
        notes.push(`${firstName(o)} will not forgive this. (a lasting rift)`);
      }
    } else if (tie === "close") {
      addBond(s, lead.id, o.id, -15);
      o.trust = clamp(o.trust - 18, 0, 100);
      changeNerve(o, -10);
      remember(s, o, `Cannot look at the wagon-master since ${firstName(target)} was given away.`);
    }
  }
}

// ---------------------------------------------------------------------------
// Time off the road
// ---------------------------------------------------------------------------

function daysAway(env: Env, n: number, notes: string[]): void {
  const { s, rng } = env;
  if (n <= 0) return;
  const start = s.gap;
  const hungerBefore = s.res.rations;
  for (let i = 0; i < n; i++) {
    const noise = 1 + rng.float(-TUNING.hazeNoise, TUNING.hazeNoise);
    s.gap -= baseHazeMiles(s) * noise + catchupMiles(s);
    s.day++;
    s.stats.hoursLost += 12;
    const mouths = living(s).length;
    const need = Math.ceil(mouths * RATIONS[s.rations].perHead);
    if (s.res.rations >= need) s.res.rations -= need;
    else {
      s.res.rations = 0;
      for (const m of living(s)) changeNerve(m, -3);
    }
    if (s.gap < TUNING.torchGap) {
      if (s.res.torches >= 1) s.res.torches -= 1;
      else for (const m of living(s)) changeNerve(m, -2);
    }
    if (zoneOf(s.gap) === "upon") for (const m of living(s)) if (rng.chance(0.25)) exposeToFog(env, m, notes);
  }
  let clamped = false;
  if (s.gap < MIN_GAP) {
    s.gap = MIN_GAP;
    clamped = true;
  }
  s.stats.minGap = Math.min(s.stats.minGap, s.gap);
  notes.push(`Time: ${n} ${n === 1 ? "day" : "days"} off the road. The Haze gains ${Math.round(start - s.gap)} miles (gap ${Math.round(start)} to ${Math.round(s.gap)}).`);
  if (s.res.rations < hungerBefore) notes.push(`-${hungerBefore - s.res.rations} rations eaten while you searched`);
  if (clamped) notes.push("The red is at the edge of the camp.");
  // Nobody heals or is treated while the party is away: the dying do not wait.
  for (const m of living(s).slice()) {
    if (m.dying && (m.dyingSince ?? s.day) < s.day) killMember(env, m, "died while the party was away", notes);
  }
}

/** Effects owned by the witch storyline. Returns false for any other effect. */
export function applyWitchEffect(env: Env, e: Effect, notes: string[]): boolean {
  const { s, rng } = env;
  switch (e.t) {
    case "abduct":
      abduct(env, e.ward === true, notes);
      return true;
    case "restore":
      restore(env, e.changed ?? 0.3, e.leave ?? 0, notes);
      return true;
    case "lose":
      lose(env, captivesOf(s), e.cause ?? "kept by the witch", e.abandon === true, notes);
      return true;
    case "giveCrew":
      giveCrew(env, e.cause ?? "stayed with the witch, in trade", notes);
      return true;
    case "days":
      daysAway(env, rng.amount(e.d), notes);
      return true;
    case "flagSet": {
      const v = rng.amount(e.v);
      s.flags[e.key] = e.day ? s.day + v : v;
      return true;
    }
    default:
      return false;
  }
}

export { applyMark };

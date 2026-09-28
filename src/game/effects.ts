// The effect interpreter: turns declarative Effect / Cond data into state changes.
// Every function that changes state pushes human-readable lines into `notes`, so
// the player sees exactly what a choice cost after the fact.

import type { Cond, Effect, GameState, Member, ResourceId, Who } from "./types.ts";
import type { Rng } from "./rng.ts";
import {
  able,
  addBond,
  anyTrait,
  byId,
  cargoCap,
  cargoUsed,
  clamp,
  firstName,
  hasRole,
  hasTrait,
  leader,
  living,
} from "./party.ts";
import { ITEMS, TUNING } from "./tuning.ts";
import { RECRUITS } from "./content/roster.ts";
import type { MemberTemplate } from "./content/roster.ts";
import { finish } from "./ending.ts";

export interface Bind {
  actor?: string;
  other?: string;
  a?: string;
  b?: string;
}

export interface Env {
  s: GameState;
  rng: Rng;
  bind: Bind;
}

const RES_NAME: Record<ResourceId, string> = {
  rations: "rations",
  torches: "torches",
  ammo: "powder & shot",
  medicine: "physic",
  spares: "spare parts",
  veils: "haze veils",
  rockets: "signal rockets",
};

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

function ensureActor(env: Env): Member | undefined {
  let m = byId(env.s, env.bind.actor);
  if (m && m.alive) return m;
  const pool = able(env.s).length ? able(env.s) : living(env.s);
  if (!pool.length) return undefined;
  m = env.rng.pick(pool);
  env.bind.actor = m.id;
  return m;
}

function ensureOther(env: Env): Member | undefined {
  let m = byId(env.s, env.bind.other);
  if (m && m.alive && m.id !== env.bind.actor) return m;
  const actor = ensureActor(env);
  const pool = living(env.s).filter((x) => x.id !== actor?.id);
  if (!pool.length) return undefined;
  m = env.rng.pick(pool);
  env.bind.other = m.id;
  return m;
}

export function resolveWho(env: Env, who: Who): Member[] {
  const { s, rng } = env;
  const alive = living(s);
  if (typeof who === "object") {
    if ("role" in who) return alive.filter((m) => m.role === who.role);
    return alive.filter((m) => m.traits.includes(who.trait));
  }
  switch (who) {
    case "leader": {
      const l = leader(s);
      return l.alive ? [l] : [];
    }
    case "actor": {
      const m = ensureActor(env);
      return m ? [m] : [];
    }
    case "other": {
      const m = ensureOther(env);
      return m ? [m] : [];
    }
    case "a": {
      const m = byId(s, env.bind.a);
      return m && m.alive ? [m] : [];
    }
    case "b": {
      const m = byId(s, env.bind.b);
      return m && m.alive ? [m] : [];
    }
    case "random":
      return alive.length ? [rng.pick(alive)] : [];
    case "randomOther": {
      const actor = ensureActor(env);
      const pool = alive.filter((m) => m.id !== actor?.id);
      return pool.length ? [rng.pick(pool)] : [];
    }
    case "two": {
      const shuffled = rng.shuffle(alive);
      return shuffled.slice(0, 2);
    }
    case "all":
      return alive;
    case "others": {
      const actor = ensureActor(env);
      return alive.filter((m) => m.id !== actor?.id);
    }
    case "fogsick":
      return alive.filter((m) => m.fog > 0);
    case "weakest": {
      // The wagon-master is never the one who volunteers; the run ends with them.
      const pool = alive.filter((m) => !m.isLeader);
      const from = pool.length ? pool : alive;
      if (!from.length) return [];
      return [from.reduce((w, m) => (m.health < w.health ? m : w))];
    }
  }
}

export function fillText(env: Env, text: string): string {
  return text.replace(/\{(actor|other|a|b|leader)\}/g, (_, key: string) => {
    if (key === "leader") return firstName(leader(env.s));
    if (key === "actor") {
      const m = ensureActor(env);
      return m ? firstName(m) : "someone";
    }
    if (key === "other") {
      const m = ensureOther(env);
      return m ? firstName(m) : "someone";
    }
    const m = byId(env.s, key === "a" ? env.bind.a : env.bind.b);
    return m ? firstName(m) : "someone";
  });
}

// ---------------------------------------------------------------------------
// Conditions
// ---------------------------------------------------------------------------

export function evalCond(env: Env, c: Cond): boolean {
  const s = env.s;
  if ("role" in c) return hasRole(s, c.role);
  if ("trait" in c) return anyTrait(s, c.trait);
  if ("res" in c) return s.res[c.res] >= c.min;
  if ("scrip" in c) return s.scrip >= c.scrip;
  if ("flag" in c) {
    const v = s.flags[c.flag] ?? 0;
    return v >= (c.min ?? -Infinity) && v <= (c.max ?? Infinity);
  }
  if ("gapBelow" in c) return s.gap < c.gapBelow;
  if ("gapAbove" in c) return s.gap >= c.gapAbove;
  if ("fog" in c) return living(s).some((m) => m.fog > 0);
  if ("partyMin" in c) return living(s).length >= c.partyMin;
  if ("partyMax" in c) return living(s).length <= c.partyMax;
  if ("not" in c) return !evalCond(env, c.not);
  return c.any.some((x) => evalCond(env, x));
}

export function allConds(env: Env, conds: Cond[] | undefined): boolean {
  return !conds || conds.every((c) => evalCond(env, c));
}

// ---------------------------------------------------------------------------
// Primitive state changes
// ---------------------------------------------------------------------------

const NERVE_LOSS_MULT: Partial<Record<string, number>> = { stoic: 0.6, paranoid: 1.2, haunted: 1.2, coward: 1.3 };

export function changeNerve(m: Member, d: number): number {
  let delta = d;
  if (d < 0) {
    let mult = 1;
    for (const t of m.traits) mult *= NERVE_LOSS_MULT[t] ?? 1;
    delta = -Math.round(-d * mult);
  }
  const before = m.nerve;
  m.nerve = clamp(m.nerve + delta, 0, 100);
  return m.nerve - before;
}

export function addResource(env: Env, res: ResourceId, d: number, notes: string[]): number {
  const s = env.s;
  const before = s.res[res];
  if (d >= 0) {
    const free = cargoCap(s) - cargoUsed(s.res);
    const canTake = Math.max(0, Math.floor(free / ITEMS[res].weight + 1e-9));
    const take = Math.min(d, canTake);
    s.res[res] += take;
    if (take < d) notes.push(`No room in the wagons: ${d - take} ${RES_NAME[res]} left behind.`);
    if (take > 0) notes.push(`+${take} ${RES_NAME[res]}`);
    return take;
  }
  s.res[res] = Math.max(0, before + d);
  const lost = before - s.res[res];
  if (lost > 0) notes.push(`-${lost} ${RES_NAME[res]}`);
  return -lost;
}

export function trimCargo(env: Env, notes: string[]): void {
  const s = env.s;
  const cap = cargoCap(s);
  const used = cargoUsed(s.res);
  if (used <= cap) return;
  const ratio = cap / used;
  for (const id of Object.keys(s.res) as ResourceId[]) {
    const keep = Math.floor(s.res[id] * ratio);
    const dropped = s.res[id] - keep;
    if (dropped > 0) notes.push(`-${dropped} ${RES_NAME[id]} (no room left)`);
    s.res[id] = keep;
  }
}

export function killMember(env: Env, m: Member, cause: string, notes: string[]): void {
  if (!m.alive) return;
  const s = env.s;
  m.alive = false;
  m.dying = false;
  m.fate = cause;
  s.stats.deaths++;
  notes.push(`${m.name} is dead: ${cause}.`);
  for (const other of living(s)) {
    let loss = TUNING.grief;
    const b = s.bonds[other.id < m.id ? `${other.id}|${m.id}` : `${m.id}|${other.id}`] ?? 0;
    if (b >= 40) loss += 8;
    if (hasTrait(other, "kind") || hasTrait(other, "pious")) loss += 3;
    changeNerve(other, -loss);
  }
  if (m.isLeader) {
    finish(s, "lost", "The wagon-master is gone.", [
      `${m.name} is dead. Without a voice to follow, the train breaks apart in the dark.`,
      "Some go on alone. Most do not get far.",
    ]);
  }
}

export function hurt(env: Env, m: Member, dmg: number, notes: string[], lethal = false): void {
  if (!m.alive || dmg <= 0) return;
  m.health -= dmg;
  if (dmg >= 8) m.wounded = true;
  if (m.health <= 0) {
    if (lethal || m.dying) {
      killMember(env, m, m.dying ? "finished off while dying" : "killed outright", notes);
    } else {
      m.health = 1;
      m.dying = true;
      m.dyingSince = env.s.day;
      m.wounded = true;
      notes.push(`${m.name} is dying. They will not last the night without physic.`);
    }
  }
}

export function heal(m: Member, amount: number): void {
  m.health = clamp(m.health + amount, 0, m.maxHealth);
}

/** Expose a member to the Haze. Veils can turn it aside. Returns true if it took hold. */
export function exposeToFog(env: Env, m: Member, notes: string[], stages = 1): boolean {
  const s = env.s;
  const alive = living(s).length || 1;
  const coverage = Math.min(1, s.res.veils / alive);
  if (coverage > 0 && env.rng.chance(coverage * 0.6)) {
    if (env.rng.chance(0.15) && s.res.veils > 0) {
      s.res.veils--;
      notes.push(`A veil rots through protecting ${firstName(m)}. -1 haze veils`);
    }
    return false;
  }
  const before = m.fog;
  m.fog = Math.min(3, m.fog + stages);
  if (m.fog > before) {
    if (m.fog >= 3) notes.push(`${m.name}'s eyes have gone the color of the sky. They are turning.`);
    else notes.push(`${m.name} breathes the Haze in. Fogsick (stage ${m.fog}).`);
  }
  return true;
}

export function recruit(env: Env, id: string | undefined, notes: string[]): Member | undefined {
  const s = env.s;
  if (living(s).length >= TUNING.maxParty) {
    notes.push("There is no room for another mouth on the train.");
    return undefined;
  }
  const pool = RECRUITS.filter((r) => !s.recruitsUsed.includes(r.id));
  const tpl: MemberTemplate | undefined = id ? pool.find((r) => r.id === id) : pool.length ? env.rng.pick(pool) : undefined;
  if (!tpl) return undefined;
  s.recruitsUsed.push(tpl.id);
  const maxHealth = tpl.maxHealth ?? 90;
  const m: Member = {
    id: tpl.id,
    name: tpl.name,
    role: tpl.role,
    traits: tpl.traits.slice(),
    bio: tpl.bio,
    health: Math.round(maxHealth * 0.75),
    maxHealth,
    nerve: tpl.nerve ?? 50,
    trust: 55,
    wounded: false,
    sick: false,
    dying: false,
    fog: 0,
    alive: true,
    isLeader: false,
    recruited: true,
  };
  s.party.push(m);
  for (const other of living(s)) {
    if (other.id === m.id) continue;
    if (hasTrait(other, "kind")) addBond(s, m.id, other.id, 10);
  }
  notes.push(`${m.name} joins the train. (${m.role}; ${m.traits.join(", ")})`);
  return m;
}

// ---------------------------------------------------------------------------
// Effect dispatch
// ---------------------------------------------------------------------------

function groupName(who: Who, ms: Member[]): string {
  if (ms.length === 1) return ms[0].name;
  if (who === "all") return "Everyone";
  return ms.map(firstName).join(" & ");
}

export function applyEffects(env: Env, effects: Effect[] | undefined, notes: string[]): void {
  if (!effects) return;
  for (const e of effects) {
    if (env.s.ending) return;
    applyEffect(env, e, notes);
  }
}

export function applyEffect(env: Env, e: Effect, notes: string[]): void {
  const { s, rng } = env;
  switch (e.t) {
    case "res":
      addResource(env, e.res, rng.amount(e.d), notes);
      return;
    case "scrip": {
      const d = rng.amount(e.d);
      const before = s.scrip;
      s.scrip = Math.max(0, s.scrip + d);
      const real = s.scrip - before;
      if (real) notes.push(`${real > 0 ? "+" : "-"}${Math.abs(real)} scrip`);
      return;
    }
    case "hp": {
      const ms = resolveWho(env, e.who);
      if (!ms.length) return;
      const d = rng.amount(e.d);
      if (d < 0) {
        for (const m of ms) hurt(env, m, -d, notes, e.lethal);
        if (ms.every((m) => m.alive && !m.dying)) notes.push(`${groupName(e.who, ms)}: ${d} health`);
      } else {
        for (const m of ms) heal(m, d);
        notes.push(`${groupName(e.who, ms)}: +${d} health`);
      }
      return;
    }
    case "nerve": {
      const ms = resolveWho(env, e.who);
      if (!ms.length) return;
      const d = rng.amount(e.d);
      for (const m of ms) changeNerve(m, d);
      notes.push(`${groupName(e.who, ms)}: ${d > 0 ? "+" : ""}${d} nerve`);
      return;
    }
    case "trust": {
      const ms = resolveWho(env, e.who).filter((m) => !m.isLeader);
      if (!ms.length) return;
      const d = rng.amount(e.d);
      for (const m of ms) m.trust = clamp(m.trust + d, 0, 100);
      notes.push(`${groupName(e.who, ms)}: ${d > 0 ? "+" : ""}${d} trust in you`);
      return;
    }
    case "bond": {
      const as = resolveWho(env, e.a);
      const bs = resolveWho(env, e.b);
      const d = rng.amount(e.d);
      let touched = false;
      for (const a of as) {
        for (const b of bs) {
          if (a.id === b.id) continue;
          addBond(s, a.id, b.id, d);
          touched = true;
        }
      }
      if (touched && as.length === 1 && bs.length === 1) {
        notes.push(`${firstName(as[0])} & ${firstName(bs[0])}: bond ${d > 0 ? "+" : ""}${d}`);
      }
      return;
    }
    case "bondAll": {
      const d = rng.amount(e.d);
      const ms = living(s);
      for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) addBond(s, ms[i].id, ms[j].id, d);
      notes.push(`The train ${d > 0 ? "grows closer" : "grows apart"} (${d > 0 ? "+" : ""}${d} between everyone)`);
      return;
    }
    case "status": {
      const ms = resolveWho(env, e.who);
      for (const m of ms) {
        if (e.s === "wounded" && !m.wounded) {
          m.wounded = true;
          notes.push(`${m.name} is wounded.`);
        } else if (e.s === "sick" && !m.sick) {
          m.sick = true;
          notes.push(`${m.name} falls sick.`);
        } else if (e.s === "fog") {
          exposeToFog(env, m, notes, e.v ?? 1);
        }
      }
      return;
    }
    case "cure": {
      for (const m of resolveWho(env, e.who)) {
        if (e.s === "wounded" && m.wounded) {
          m.wounded = false;
          notes.push(`${firstName(m)}'s wound closes.`);
        } else if (e.s === "sick" && m.sick) {
          m.sick = false;
          notes.push(`${firstName(m)} recovers.`);
        } else if (e.s === "fog" && m.fog > 0) {
          m.fog = Math.max(0, m.fog - 1);
          notes.push(`${firstName(m)}'s fogsickness eases.`);
        }
      }
      return;
    }
    case "repair": {
      const d = rng.amount(e.d);
      const before = s.train.condition;
      s.train.condition = clamp(before + d, 0, 100);
      const real = Math.round(s.train.condition - before);
      if (real) notes.push(`Wagons ${real > 0 ? "+" : ""}${real} condition`);
      return;
    }
    case "wagons": {
      const before = s.train.wagons;
      s.train.wagons = Math.max(1, before + e.d);
      const real = s.train.wagons - before;
      if (real < 0) {
        notes.push("A wagon is abandoned.");
        trimCargo(env, notes);
      } else if (real > 0) notes.push("A wagon joins the train.");
      return;
    }
    case "gap": {
      const d = rng.amount(e.d);
      s.gap += d;
      if (d < 0) notes.push(`The Haze gains ${-d} miles on you.`);
      else if (d > 0) notes.push(`You gain ${d} miles on the Haze.`);
      return;
    }
    case "advance": {
      const d = Math.min(rng.amount(e.miles), TUNING.totalMiles - s.miles - 1);
      s.miles += d;
      s.gap += d;
      if (d > 0) notes.push(`The road carries you ${d} miles ahead.`);
      return;
    }
    case "hours": {
      const d = rng.amount(e.d);
      s.today.hoursUsed += d;
      if (d > 0) notes.push(`+${d}h lost`);
      return;
    }
    case "recruit": {
      if (e.chance !== undefined && !rng.chance(e.chance)) return;
      recruit(env, e.id, notes);
      return;
    }
    case "combat":
      s.queue.unshift({ t: "combat", enemy: e.enemy });
      return;
    case "scene": {
      if (e.chance !== undefined && !rng.chance(e.chance)) return;
      s.queue.unshift({
        t: "scene",
        id: e.id,
        a: e.same ? env.bind.a : undefined,
        b: e.same ? env.bind.b : undefined,
        actor: e.same ? env.bind.actor : undefined,
      });
      return;
    }
    case "flag":
      s.flags[e.key] = (s.flags[e.key] ?? 0) + e.d;
      return;
    case "end":
      finish(s, e.kind, e.headline, e.text);
      return;
    case "kill": {
      for (const m of resolveWho(env, e.who)) killMember(env, m, e.cause ?? "killed", notes);
      return;
    }
    case "leave": {
      for (const m of resolveWho(env, e.who)) {
        if (m.isLeader || !m.alive) continue;
        m.alive = false;
        m.dying = false;
        m.fate = e.cause ?? "left the train";
        s.stats.departures++;
        notes.push(`${m.name} is gone: ${m.fate}.`);
        if (e.takes) {
          for (const id of Object.keys(e.takes) as ResourceId[]) {
            const take = Math.min(s.res[id], e.takes[id] ?? 0);
            if (take > 0) {
              s.res[id] -= take;
              notes.push(`-${take} ${RES_NAME[id]} (taken)`);
            }
          }
        }
        for (const other of living(s)) {
          const b = s.bonds[other.id < m.id ? `${other.id}|${m.id}` : `${m.id}|${other.id}`] ?? 0;
          if (b >= 30) changeNerve(other, -6);
        }
      }
      return;
    }
  }
}

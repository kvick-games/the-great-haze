// Combat is a short, costly scene: every round takes time off the Haze's clock
// and every tactic burns something you cannot replace.

import type { CombatInstance, GameState, Member, ScreenOption } from "./types.ts";
import type { Env } from "./effects.ts";
import { applyEffects, changeNerve, exposeToFog, hurt } from "./effects.ts";
import { able, addBond, firstName, hasTrait, living } from "./party.ts";
import { TUNING } from "./tuning.ts";
import { ENEMIES } from "./content/enemies.ts";
import type { EnemyDef } from "./content/enemies.ts";
import { finish } from "./ending.ts";

export function enemyDef(id: string): EnemyDef {
  const def = ENEMIES[id];
  if (!def) throw new Error(`Unknown enemy: ${id}`);
  return def;
}

function progress(s: GameState): number {
  return Math.min(1, s.miles / TUNING.totalMiles);
}

export function startCombat(env: Env, enemyId: string): { combat: CombatInstance; notes: string[] } {
  const def = enemyDef(enemyId);
  const { s, rng } = env;
  const maxHp = Math.round(def.hp * rng.float(0.85, 1.15) * (1 + progress(s) * 0.35));
  const notes: string[] = [];
  const dread = def.tags.includes("hollowed") ? -3 : -1;
  for (const m of living(s)) changeNerve(m, dread);
  notes.push(`Everyone: ${dread} nerve`);
  s.today.hoursUsed += 0.5;
  s.stats.hoursLost += 0.5;
  return { combat: { enemy: enemyId, hp: maxHp, maxHp, round: 1, stagger: 0, log: [] }, notes };
}

function shootSkill(m: Member): number {
  let p = 0.66;
  if (m.role === "hunter") p += 0.16;
  if (hasTrait(m, "veteran")) p += 0.1;
  if (m.role === "guard") p += 0.06;
  if (hasTrait(m, "coward")) p -= 0.1;
  return p;
}

export function combatOptions(env: Env, c: CombatInstance): ScreenOption[] {
  const { s } = env;
  const def = enemyDef(c.enemy);
  const opts: ScreenOption[] = [];
  const anyAble = able(s).length > 0;
  const shooters = Math.min(3, able(s).length, s.res.ammo);
  opts.push({
    id: "fire",
    label: "Open fire",
    hint: shooters ? `Up to ${shooters} shooters, one charge each.` : "Nobody has a charge to spend.",
    hours: 0.5,
    disabled: !anyAble ? "No one can stand." : s.res.ammo < 1 ? "No powder and shot." : undefined,
  });
  opts.push({
    id: "hold",
    label: "Hold the line",
    hint: "Fight with what is in your hands. No ammunition, more blood.",
    hours: 0.5,
    disabled: !anyAble ? "No one can stand." : undefined,
  });
  opts.push({
    id: "torch",
    label: "Torches and fire",
    hint: def.lightWeak ? "Costs 2 torches. Fire is the one thing they hate." : "Costs 2 torches. Men do not fear fire.",
    hours: 0.5,
    disabled: s.res.torches < 2 ? "You need 2 torches." : undefined,
  });
  opts.push({
    id: "rocket",
    label: "Fire a signal rocket",
    hint: "Costs 1 rocket. Sudden light and noise; may break their nerve.",
    hours: 0.5,
    disabled: s.res.rockets < 1 ? "No rockets." : undefined,
  });
  if (def.tribute && def.parleyOdds !== undefined) {
    if (def.tribute.scrip) {
      opts.push({
        id: "pay-scrip",
        label: `Pay them off (${def.tribute.scrip} scrip)`,
        hint: "They may take it and come anyway.",
        hours: 0.5,
        disabled: s.scrip < def.tribute.scrip ? "You cannot afford it." : undefined,
      });
    }
    if (def.tribute.rations) {
      opts.push({
        id: "pay-rations",
        label: `Give them food (${def.tribute.rations} rations)`,
        hint: "They may take it and come anyway.",
        hours: 0.5,
        disabled: s.res.rations < def.tribute.rations ? "You cannot spare it." : undefined,
      });
    }
  }
  opts.push({
    id: "flee",
    label: "Whip the oxen and run",
    hint: "Lose cargo cutting loose. A damaged wagon will not outrun anything.",
    hours: 0.5,
  });
  return opts;
}

export interface CombatStep {
  lines: string[];
  notes: string[];
  done: boolean;
  outcome?: "victory" | "routed" | "escaped" | "paid" | "withdrew";
}

function pickTarget(env: Env): Member | undefined {
  const pool = living(env.s);
  if (!pool.length) return undefined;
  return env.rng.weighted(pool, (m) => (m.isLeader ? 0.7 : 1));
}

function endCombat(env: Env, def: EnemyDef, outcome: NonNullable<CombatStep["outcome"]>, step: CombatStep): CombatStep {
  const { s } = env;
  step.done = true;
  step.outcome = outcome;
  s.stats.fights++;
  if (outcome === "victory") {
    step.lines.push(def.win);
    if (def.tags.includes("human")) {
      for (const m of living(s)) if (hasTrait(m, "kind") || hasTrait(m, "pious")) changeNerve(m, -3);
    }
    applyEffects(env, def.loot, step.notes);
  } else if (outcome === "routed" || outcome === "withdrew") {
    step.lines.push(def.fled);
  }
  if (outcome === "victory" || outcome === "routed") {
    const ms = living(s);
    for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) addBond(s, ms[i].id, ms[j].id, 2);
  }
  return step;
}

export function combatRound(env: Env, c: CombatInstance, tactic: string): CombatStep {
  const { s, rng } = env;
  const def = enemyDef(c.enemy);
  const step: CombatStep = { lines: [], notes: [], done: false };
  s.today.hoursUsed += 0.5;
  s.stats.hoursLost += 0.5;
  let extraHits = 0;

  const fighters = able(s);
  if (!fighters.length) {
    finish(s, "lost", "There is no one left standing.", ["The last of the train falls in the road. The Haze arrives at its leisure."]);
    step.done = true;
    return step;
  }

  switch (tactic) {
    case "fire": {
      const crew = fighters
        .slice()
        .sort((a, b) => shootSkill(b) - shootSkill(a))
        .slice(0, Math.min(3, s.res.ammo));
      let shots = 0;
      let hits = 0;
      let dmg = 0;
      for (const m of crew) {
        if (hasTrait(m, "coward") && rng.chance(0.35)) {
          step.lines.push(`${firstName(m)} freezes and does not fire.`);
          continue;
        }
        s.res.ammo--;
        shots++;
        if (rng.chance(shootSkill(m))) {
          hits++;
          dmg += Math.round(rng.int(6, 10) * (def.tags.includes("hollowed") ? 0.75 : 1));
        }
      }
      c.hp -= dmg;
      step.lines.push(`${shots} shots. ${hits} hit for ${dmg}.${def.tags.includes("hollowed") ? " They barely slow." : ""}`);
      step.notes.push(`-${shots} powder & shot`);
      break;
    }
    case "hold": {
      let dmg = 0;
      for (const m of fighters.slice(0, 4)) {
        if (hasTrait(m, "coward") && rng.chance(0.3)) continue;
        const brawler = m.role === "guard" || hasTrait(m, "veteran") || hasTrait(m, "hothead");
        dmg += brawler ? rng.int(4, 7) : rng.int(2, 4);
      }
      c.hp -= dmg;
      extraHits = 1;
      step.lines.push(`You close and fight hand to hand. ${dmg} damage, and they get a swing at you.`);
      break;
    }
    case "torch": {
      s.res.torches -= 2;
      step.notes.push("-2 torches");
      if (def.lightWeak) {
        const dmg = rng.int(12, 18);
        c.hp -= dmg;
        c.stagger = 1;
        step.lines.push(`Fire. They shriek and shy from it. ${dmg} damage, and they falter.`);
      } else {
        step.lines.push("You wave the torches. The men only see where you are standing better.");
      }
      break;
    }
    case "rocket": {
      s.res.rockets -= 1;
      step.notes.push("-1 signal rockets");
      const pBreak = def.lightWeak ? 0.65 : def.tags.includes("beast") ? 0.55 : 0.35;
      if (def.canFlee !== false || def.lightWeak) {
        if (rng.chance(pBreak)) {
          step.lines.push("The rocket goes off like a second sun. They break.");
          return endCombat(env, def, "routed", step);
        }
      }
      const dmg = rng.int(4, 8);
      c.hp -= dmg;
      c.stagger = 1;
      step.lines.push(`The rocket sears the dark. ${dmg} damage. They stagger, but do not break.`);
      break;
    }
    case "pay-scrip":
    case "pay-rations": {
      const scrip = tactic === "pay-scrip";
      if (scrip) s.scrip -= def.tribute?.scrip ?? 0;
      else s.res.rations -= def.tribute?.rations ?? 0;
      step.notes.push(scrip ? `-${def.tribute?.scrip} scrip` : `-${def.tribute?.rations} rations`);
      if (rng.chance(def.parleyOdds ?? 0.5)) {
        step.lines.push("They take it. They count it. They let you go.");
        return endCombat(env, def, "paid", step);
      }
      step.lines.push("They take it, and come anyway.");
      extraHits = 1;
      break;
    }
    case "flee": {
      const p = Math.max(0.1, 0.28 + 0.4 * (s.train.condition / 100) - 0.04 * (c.round - 1));
      if (rng.chance(p)) {
        const rations = Math.min(s.res.rations, rng.int(3, 8));
        const torches = Math.min(s.res.torches, rng.int(0, 2));
        s.res.rations -= rations;
        s.res.torches -= torches;
        step.lines.push("You cut sacks loose off the back wagon and whip the oxen until they scream. It works.");
        if (rations) step.notes.push(`-${rations} rations (cut loose)`);
        if (torches) step.notes.push(`-${torches} torches (cut loose)`);
        return endCombat(env, def, "escaped", step);
      }
      step.lines.push("The wagons lurch and the oxen fight the traces. You are not going anywhere.");
      extraHits = 1;
      break;
    }
    default:
      throw new Error(`Unknown combat tactic: ${tactic}`);
  }

  if (c.hp <= 0) return endCombat(env, def, "victory", step);

  // Enemy turn.
  const hits = Math.max(0, def.hits + extraHits - (c.stagger > 0 ? 1 : 0));
  if (c.stagger > 0) c.stagger--;
  const guardHere = fighters.some((m) => m.role === "guard");
  for (let i = 0; i < hits; i++) {
    const target = pickTarget(env);
    if (!target) break;
    let dmg = rng.int(def.atk[0], def.atk[1]);
    dmg = Math.round(dmg * (1 + progress(s) * 0.25));
    if (guardHere && tactic === "hold") dmg = Math.max(1, dmg - 1);
    step.lines.push(`${firstName(target)} is struck for ${dmg}.`);
    hurt(env, target, dmg, step.notes);
    if (def.fogTouch && target.alive && rng.chance(def.fogTouch)) exposeToFog(env, target, step.notes);
    if (s.ending) {
      step.done = true;
      return step;
    }
  }
  if (def.tags.includes("hollowed")) {
    for (const m of living(s)) if (!hasTrait(m, "stoic") && !hasTrait(m, "veteran")) changeNerve(m, -1);
  }

  if (def.canFlee && c.hp <= c.maxHp * 0.35 && rng.chance(0.5)) return endCombat(env, def, "routed", step);
  c.round++;
  if (c.round > 6) return endCombat(env, def, "withdrew", step);
  return step;
}

export function combatSummary(c: CombatInstance): string {
  const def = enemyDef(c.enemy);
  const frac = Math.max(0, c.hp) / c.maxHp;
  const bars = Math.max(0, Math.round(frac * 10));
  const mood = frac > 0.66 ? "full strength" : frac > 0.33 ? "hurt" : "faltering";
  return `${def.name} — ${"█".repeat(bars)}${"░".repeat(10 - bars)} (${mood}). Round ${c.round}.`;
}


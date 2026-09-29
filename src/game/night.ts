// Everything that happens between dusk and dawn: supper, torches, the Haze
// creeping in, wounds and sickness, and the crises that surface in the dark.

import type { QueueItem } from "./types.ts";
import type { Env } from "./effects.ts";
import { changeNerve, exposeToFog, heal, hurt, killMember } from "./effects.ts";
import { finish } from "./ending.ts";
import { firstName, hasRole, hasTrait, living, avgNerve } from "./party.ts";
import { PACES, RATIONS, TUNING, zoneOf } from "./tuning.ts";
import { regionOf } from "./map.ts";

export interface NightReport {
  lines: string[];
  notes: string[];
  crises: QueueItem[];
  starving: boolean;
}

export function processNight(env: Env, restQuality: number): NightReport {
  const { s, rng } = env;
  const lines: string[] = [];
  const notes: string[] = [];
  const crises: QueueItem[] = [];
  const pace = PACES[s.pace];
  const ration = RATIONS[s.rations];
  const mouths = living(s).length;

  // --- Supper ---------------------------------------------------------------
  const need = Math.ceil(mouths * ration.perHead);
  let starving = false;
  if (s.res.rations >= need) {
    s.res.rations -= need;
    notes.push(`-${need} rations eaten (${ration.name.toLowerCase()})`);
    for (const m of living(s)) {
      changeNerve(m, ration.nerve);
      if (ration.health > 0 && !m.sick && !m.wounded) heal(m, ration.health);
      else if (ration.health < 0 && !m.dying) hurt(env, m, -ration.health, notes);
    }
  } else {
    const eaten = s.res.rations;
    const shortage = 1 - eaten / Math.max(1, need);
    s.res.rations = 0;
    starving = true;
    s.stats.starvedDays++;
    if (eaten > 0) notes.push(`-${eaten} rations eaten (not enough)`);
    lines.push(
      eaten > 0
        ? "There is not enough food to go round. People eat in silence and watch each other's plates."
        : "There is nothing left to eat. Nobody says it aloud.",
    );
    for (const m of living(s)) {
      if (!m.dying) hurt(env, m, Math.round(2 + 3 * shortage), notes);
      changeNerve(m, -Math.round(2 + 3 * shortage));
      m.trust = Math.max(0, m.trust - 2);
    }
    notes.push("Everyone: starving (health and nerve fall)");
  }
  if (s.res.rations === 0) s.stats.daysNoRations++;

  // --- Torches --------------------------------------------------------------
  const gapNow = s.gap;
  const needTorch = gapNow < TUNING.torchGap;
  let dark = false;
  if (needTorch) {
    const burn = gapNow < 12 ? 2 : 1;
    if (s.res.torches >= burn) {
      s.res.torches -= burn;
      notes.push(`-${burn} torches burned (the ring holds)`);
      lines.push("The ring of torches burns around the wagons. Shapes move past the edge of the light and are not permitted in.");
    } else {
      dark = true;
      s.res.torches = 0;
      lines.push("You have no torches to light. The dark closes in around the wagons. Something walks the circle all night.");
      for (const m of living(s)) changeNerve(m, -4);
      notes.push("Everyone: -4 nerve (a dark camp)");
      if (rng.chance(0.4)) {
        const region = regionOf(s);
        const enemy = region.id === "pines" || region.id === "fen" ? "haze-hounds" : "hollowed-single";
        crises.push({ t: "combat", enemy });
      }
    }
  } else if (rng.chance(0.03)) {
    lines.push("Something calls from outside the firelight, in a voice you know. Nobody answers. It stops.");
    for (const m of living(s)) changeNerve(m, -1);
  }

  // --- The Haze ---------------------------------------------------------------
  const zone = zoneOf(s.gap);
  const zoneNerve = zone === "close" ? -1 : zone === "upon" ? -3 : 0;
  if (zoneNerve) for (const m of living(s)) changeNerve(m, zoneNerve);
  if (zone === "upon") {
    lines.push("Red fog seeps between the wheels and lies along the ground. It is warm. Everyone breathes it, and knows.");
    for (const m of living(s)) if (rng.chance(0.4)) exposeToFog(env, m, notes);
    if (s.res.veils > 0 && rng.chance(0.25)) {
      s.res.veils--;
      notes.push("-1 haze veils (rotted through)");
    }
  }

  // --- Pace ---------------------------------------------------------------
  if (pace.nerve) for (const m of living(s)) changeNerve(m, pace.nerve);
  if (pace.health < 0) for (const m of living(s)) if (!m.dying && rng.chance(0.5)) hurt(env, m, -pace.health, notes);
  if (pace.health > 0) for (const m of living(s)) if (!m.sick && !m.wounded && !m.dying) heal(m, pace.health * restQuality);

  // --- Bodies -----------------------------------------------------------------
  const fed = !starving && s.rations !== "bare";
  for (const m of living(s).slice()) {
    if (!m.alive) continue;
    if (m.dying) {
      if ((m.dyingSince ?? s.day) < s.day) {
        killMember(env, m, "died in the night of their wounds", notes);
        continue;
      }
      lines.push(`${firstName(m)} is dying. Without physic, they will not see another dusk.`);
      continue;
    }
    if (m.wounded) {
      hurt(env, m, 2, notes);
      if (!m.alive || m.dying) continue;
      // Bodies mend on their own more readily when they are not already close to the edge.
      const pHeal = (m.health > 35 ? 0.2 : 0.1) + (hasRole(s, "medic") ? 0.15 : 0);
      if (rng.chance(pHeal)) {
        m.wounded = false;
        notes.push(`${firstName(m)}'s wound closes on its own.`);
      }
    }
    if (m.sick) {
      hurt(env, m, 2, notes);
      if (!m.alive || m.dying) continue;
      if (rng.chance(hasRole(s, "medic") ? 0.35 : 0.22)) {
        m.sick = false;
        notes.push(`${firstName(m)} shakes the fever.`);
      } else if (rng.chance(hasRole(s, "medic") ? 0.05 : 0.1)) {
        const targets = living(s).filter((x) => !x.sick && x.id !== m.id);
        if (targets.length) {
          const t = rng.pick(targets);
          t.sick = true;
          notes.push(`${t.name} catches it.`);
        }
      }
    }
    if (m.fog > 0) {
      const worsen = s.gap < 25 ? 0.1 : 0.03;
      if (rng.chance(worsen)) {
        m.fog = Math.min(3, m.fog + 1);
        notes.push(`${m.name}'s fogsickness worsens (stage ${m.fog}).`);
      } else if (s.gap >= 45 && rng.chance(0.12)) {
        m.fog--;
        notes.push(`${firstName(m)}'s fogsickness eases.`);
      }
      if (m.fog >= 2) for (const o of living(s)) if (o.id !== m.id && rng.chance(0.3)) changeNerve(o, -1);
    }
    if (fed && !m.wounded && !m.sick && m.fog === 0) {
      const base = 2 + (s.pace === "easy" ? 1 : 0) + (s.pace === "halt" ? 6 * restQuality : 0);
      heal(m, hasTrait(m, "sickly") ? base * 0.7 : base);
    }
    // A fed camp inside a ring of torchlight is the one place anyone can breathe.
    if (!starving && !dark && zone !== "upon") {
      changeNerve(m, (hasTrait(m, "pious") || hasTrait(m, "stoic") ? 3 : 2) - (zone === "close" ? 1 : 0));
    }
  }
  if (s.ending) return { lines, notes, crises, starving };

  // --- Crises ---------------------------------------------------------------
  const lead = living(s).find((m) => m.isLeader);
  if (lead && lead.fog >= 3) {
    finish(s, "consumed", "You are Hollowed.", [
      "You wake in the night with the fog behind your eyes and a great, patient calm in your chest.",
      "You get up. You count the sleeping shapes. You are very gentle about it.",
      "Later, the others will remember only that the wagon-master walked out into the red at dawn, and that it seemed, for once, like a person who knew exactly where they were going.",
    ]);
    return { lines, notes, crises, starving };
  }
  for (const m of living(s)) {
    if (crises.length >= 3) break;
    if (m.isLeader) continue;
    if (m.fog >= 3) crises.push({ t: "scene", id: "turned", actor: m.id });
    else if (m.nerve <= 3 && rng.chance(0.5)) crises.push({ t: "scene", id: "breakdown", actor: m.id });
    else if (m.fog === 2 && !(s.flags[`fog2:${m.id}`] ?? 0)) {
      s.flags[`fog2:${m.id}`] = 1;
      crises.push({ t: "scene", id: "fogsick-quarantine", actor: m.id });
    } else if (!m.isLeader && m.trust < 22 && (hasTrait(m, "greedy") || hasTrait(m, "hothead") || m.nerve < 40) && rng.chance(0.25)) {
      crises.push({ t: "scene", id: "deserter", actor: m.id });
    }
  }
  // The witch, once her signs were seen, comes on the night she chose.
  if ((s.flags["witch:stage"] ?? 0) === 1 && s.day >= (s.flags["witch:due"] ?? Infinity) && living(s).some((m) => !m.isLeader)) {
    crises.push({ t: "scene", id: "witch-takes" });
  }
  // Someone the witch touched talks in their sleep, in a voice that is not theirs.
  for (const m of living(s)) {
    if (m.marks && m.marks.includes("witch-touched") && rng.chance(0.15)) {
      lines.push(`${firstName(m)} talks in their sleep, in a woman's voice. The others do not sleep after.`);
      for (const o of living(s)) if (o.id !== m.id) changeNerve(o, -1);
      break;
    }
  }
  if (avgNerve(s) < 12 && living(s).length) lines.push("Nobody is speaking. Even the oxen are quiet.");
  return { lines, notes, crises, starving };
}

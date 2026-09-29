// Content rules for dialogue, tells, checks and NPCs. These are the authoring
// contract: they fail loudly when a scene breaks the shape the 3D client and the
// video pipeline rely on.

import { test } from "node:test";
import assert from "node:assert/strict";
import { SCENES, sceneById } from "../src/game/content/scenes/index.ts";
import { NPCS } from "../src/game/content/npcs.ts";
import { RECRUITS } from "../src/game/content/roster.ts";
import { BUILDS, CHECK_KINDS, FACIAL, GESTURES, HAIR_STYLES, HEIGHTS, MOODS, ROLES, TRAITS } from "../src/game/types.ts";
import type { Effect, Line, Look, Outcome, SceneDef } from "../src/game/types.ts";

const MAX_WORDS = 14;
const words = (t: string): number => t.split(/\s+/).filter(Boolean).length;

interface Where {
  where: string;
  scene: SceneDef;
  optionId?: string;
  hasCheck?: boolean;
}

function allLines(): { at: Where; line: Line; setup: boolean }[] {
  const out: { at: Where; line: Line; setup: boolean }[] = [];
  for (const def of SCENES) {
    def.talk?.forEach((line, i) => out.push({ at: { where: `${def.id}/talk[${i}]`, scene: def }, line, setup: true }));
    for (const opt of def.options) {
      for (const group of ["genuine", "trap", "any"] as const) {
        (opt.results[group] ?? []).forEach((o, k) =>
          o.talk?.forEach((line, i) =>
            out.push({ at: { where: `${def.id}/${opt.id}/${group}[${k}].talk[${i}]`, scene: def, optionId: opt.id, hasCheck: Boolean(opt.check) }, line, setup: false }),
          ),
        );
      }
    }
  }
  return out;
}

function outcomes(def: SceneDef): { where: string; o: Outcome; optionId: string; group: string }[] {
  const out: { where: string; o: Outcome; optionId: string; group: string }[] = [];
  for (const opt of def.options)
    for (const group of ["genuine", "trap", "any"] as const)
      (opt.results[group] ?? []).forEach((o, k) => out.push({ where: `${def.id}/${opt.id}/${group}[${k}]`, o, optionId: opt.id, group }));
  return out;
}

test("every scene opens with 2-6 short spoken lines", () => {
  for (const def of SCENES) {
    assert.ok(def.talk, `${def.id} has no spoken setup`);
    assert.ok(def.talk.length >= 2 && def.talk.length <= 6, `${def.id}: ${def.talk.length} setup lines (want 2-6)`);
  }
});

test("spoken lines are short, well-formed and use only the fixed mood and gesture sets", () => {
  for (const { at, line } of allLines()) {
    assert.ok(line.text.trim().length >= 2, `${at.where}: empty line`);
    assert.ok(words(line.text) <= MAX_WORDS, `${at.where}: ${words(line.text)} words: "${line.text}"`);
    for (const v of line.vary ?? []) assert.ok(words(v) <= MAX_WORDS && words(v) >= 1, `${at.where}: vary is ${words(v)} words: "${v}"`);
    if (line.mood) assert.ok((MOODS as readonly string[]).includes(line.mood), `${at.where}: bad mood ${line.mood}`);
    if (line.gesture) assert.ok((GESTURES as readonly string[]).includes(line.gesture), `${at.where}: bad gesture ${line.gesture}`);
    for (const [trait, text] of Object.entries(line.alt ?? {})) {
      assert.ok((TRAITS as readonly string[]).includes(trait), `${at.where}: alt for unknown trait ${trait}`);
      assert.ok(words(text as string) <= MAX_WORDS, `${at.where}: alt (${trait}) is ${words(text as string)} words`);
    }
  }
});

test("every speaker resolves in the scene that uses it", () => {
  const npcIds = new Set(NPCS.map((n) => n.id));
  for (const { at, line } of allLines()) {
    const who = line.who;
    const def = at.scene;
    if (who.startsWith("npc:")) assert.ok(npcIds.has(who.slice(4)), `${at.where}: unknown NPC ${who}`);
    else if (who.startsWith("role:")) assert.ok((ROLES as readonly string[]).includes(who.slice(5)), `${at.where}: unknown role ${who}`);
    else if (who === "stranger") assert.ok(def.stranger, `${at.where}: "stranger" speaks but ${def.id} defines no stranger`);
    else if (who === "observer") assert.ok(def.tells?.length, `${at.where}: "observer" needs a scene with tells`);
    else if (who === "a" || who === "b") assert.ok(def.pairWeight || def.bound, `${at.where}: "${who}" needs a scene with a pair (or a bound scene)`);
    else if (who === "by") assert.ok(at.hasCheck, `${at.where}: "by" needs an option with a check`);
    else assert.ok(["leader", "actor", "other", "taken"].includes(who), `${at.where}: unknown speaker ${who}`);
  }
});

test("card narration is short: one or two lines, and one line per outcome", () => {
  for (const def of SCENES) {
    assert.ok(def.intro.length >= 1 && def.intro.length <= 2, `${def.id}: ${def.intro.length} intro lines (want 1-2)`);
    for (const l of def.intro) assert.ok(words(l) <= 24, `${def.id}: intro line is ${words(l)} words: "${l}"`);
    for (const { where, o } of outcomes(def)) {
      assert.ok(words(o.text) <= 26, `${where}: outcome narration is ${words(o.text)} words: "${o.text}"`);
      assert.ok((o.talk?.length ?? 0) <= 4, `${where}: too many spoken lines`);
    }
  }
});

test("most outcomes are spoken, not narrated", () => {
  let total = 0;
  let spoken = 0;
  for (const def of SCENES) {
    for (const { o } of outcomes(def)) {
      total++;
      if (o.talk && o.talk.length) spoken++;
    }
  }
  assert.ok(spoken / total >= 0.8, `only ${spoken} of ${total} outcomes carry dialogue`);
});

test("party lines reflect traits: authors give trait variants", () => {
  const withAlt = allLines().filter(({ line }) => line.alt && Object.keys(line.alt).length).length;
  assert.ok(withAlt >= 30, `only ${withAlt} lines have trait variants`);
});

test("strangers are people: a name and a full look", () => {
  for (const def of SCENES.filter((d) => d.kind === "stranger")) {
    assert.ok(def.stranger, `${def.id} needs a stranger`);
    assert.ok(def.stranger.name.length >= 3, `${def.id}: stranger needs a name`);
    assertLook(def.stranger.look, `${def.id} stranger`);
  }
});

test("tells are structured: id, severity, and something the observer can say", () => {
  let tells = 0;
  let said = 0;
  const ids = new Set<string>();
  for (const def of SCENES.filter((d) => d.tells)) {
    def.tells!.forEach((t, i) => {
      tells++;
      const id = t.id ?? `${def.id}:${i}`;
      assert.ok(!ids.has(id), `duplicate tell id ${id}`);
      ids.add(id);
      assert.ok(t.severity === undefined || [1, 2, 3].includes(t.severity), `${id}: bad severity`);
      if (t.say) {
        said++;
        assert.ok(words(t.say) <= MAX_WORDS, `${id}: say is ${words(t.say)} words`);
      }
    });
    // Fair both ways: each side has an unmistakable tell to find.
    assert.ok(def.tells!.some((t) => t.shows === "genuine" && (t.severity ?? 2) >= 2), `${def.id}: honest need should be able to show itself clearly`);
    assert.ok(def.tells!.some((t) => t.shows === "trap" && (t.severity ?? 2) >= 2), `${def.id}: a trap should be able to show itself clearly`);
  }
  assert.ok(said / tells >= 0.8, `only ${said} of ${tells} tells can be spoken by the observer`);
});

test("charisma checks appear across the road and every check outcome is covered", () => {
  const kinds = new Set<string>();
  let checks = 0;
  for (const def of SCENES) {
    for (const opt of def.options) {
      if (!opt.check) {
        for (const group of ["genuine", "trap", "any"] as const)
          for (const o of opt.results[group] ?? []) assert.ok(!o.needs, `${def.id}/${opt.id}: "needs" without a check`);
        continue;
      }
      checks++;
      kinds.add(opt.check.kind);
      assert.ok((CHECK_KINDS as readonly string[]).includes(opt.check.kind));
      assert.ok(opt.check.dc >= 6 && opt.check.dc <= 20, `${def.id}/${opt.id}: dc ${opt.check.dc}`);
      for (const group of ["genuine", "trap", "any"] as const) {
        const list = opt.results[group];
        if (!list) continue;
        const ok = list.filter((o) => !o.needs || o.needs === "success").length;
        const bad = list.filter((o) => !o.needs || o.needs === "fail").length;
        assert.ok(ok > 0 && bad > 0, `${def.id}/${opt.id}/${group}: a check needs outcomes for both success and failure`);
      }
    }
  }
  assert.ok(checks >= 8, `only ${checks} options have checks`);
  for (const k of ["persuade", "calm", "haggle", "talk-down"]) assert.ok(kinds.has(k), `no ${k} check anywhere`);
});

// ---------------------------------------------------------------------------
// NPCs
// ---------------------------------------------------------------------------

function assertLook(look: Look, who: string): void {
  assert.ok((BUILDS as readonly string[]).includes(look.build), `${who}: bad build`);
  assert.ok((HEIGHTS as readonly string[]).includes(look.height), `${who}: bad height`);
  assert.ok(Number.isInteger(look.age) && look.age >= 5 && look.age <= 95, `${who}: bad age`);
  assert.ok(look.skin.length >= 3, `${who}: skin`);
  assert.ok((HAIR_STYLES as readonly string[]).includes(look.hair.style), `${who}: bad hair style`);
  assert.ok(look.hair.color.length >= 3, `${who}: hair colour`);
  assert.ok((FACIAL as readonly string[]).includes(look.hair.facial), `${who}: bad facial hair`);
  assert.ok(look.clothing.length >= 2 && look.clothing.every((c) => c.length >= 4), `${who}: clothing`);
  assert.ok(look.palette.length >= 2 && look.palette.length <= 4, `${who}: palette`);
  assert.ok(look.prop.id.length >= 3 && look.prop.desc.length >= 10, `${who}: prop`);
  assert.ok(Array.isArray(look.marks), `${who}: marks`);
  assert.ok(look.summary.length >= 30, `${who}: summary`);
}

function recruitsOf(def: SceneDef): Set<string> {
  const ids = new Set<string>();
  const visit = (e: Effect) => {
    if (e.t === "recruit" && e.id) ids.add(e.id);
  };
  for (const { o } of outcomes(def)) (o.fx ?? []).forEach(visit);
  return ids;
}

test("there are 6-10 named NPCs, each with full visual data, a backstory and a complication", () => {
  assert.ok(NPCS.length >= 6 && NPCS.length <= 10, `${NPCS.length} NPCs`);
  const ids = new Set<string>();
  for (const n of NPCS) {
    assert.ok(!ids.has(n.id));
    ids.add(n.id);
    assert.ok((ROLES as readonly string[]).includes(n.role));
    assert.equal(n.traits.length, 2);
    for (const t of n.traits) assert.ok((TRAITS as readonly string[]).includes(t));
    assert.ok(n.backstory.length >= 20 && !n.backstory.includes("\n"), `${n.id}: one-line backstory`);
    assertLook(n.look, n.id);
    assert.ok(n.join.length >= 1 && n.join.every((l) => words(l.text) <= MAX_WORDS), `${n.id}: join lines`);
    assert.ok(n.join.some((l) => l.who === `npc:${n.id}`), `${n.id}: speaks in their own join lines`);
    const scene = sceneById(n.complication.scene);
    assert.ok(scene, `${n.id}: complication scene ${n.complication.scene} is missing`);
    assert.ok(scene.once, `${n.id}: complication scene must be once`);
    assert.ok(scene.talk?.some((l) => l.who === `npc:${n.id}`), `${n.id}: speaks in their own complication`);
    assert.ok(n.complication.afterDays >= 2 && n.complication.afterDays <= 8);
    assert.ok(RECRUITS.some((r) => r.id === n.id), `${n.id} is not recruitable`);
  }
});

test("every NPC is met on the road, and some come back", () => {
  const met = new Map<string, string[]>();
  for (const def of SCENES) for (const id of recruitsOf(def)) met.set(id, [...(met.get(id) ?? []), def.id]);
  for (const n of NPCS) assert.ok(met.get(n.id)?.length, `${n.id} is never met: no scene recruits them`);
  const returns = SCENES.filter((d) => (d.when ?? []).some((c) => "flag" in c && c.flag.startsWith("met:")));
  assert.ok(returns.length >= 4, `only ${returns.length} recurring encounters`);
  for (const d of returns) {
    const cond = (d.when ?? []).find((c) => "flag" in c && c.flag.startsWith("met:")) as { flag: string };
    assert.ok(NPCS.some((n) => `met:${n.id}` === cond.flag), `${d.id}: gated on unknown ${cond.flag}`);
    assert.ok(d.talk?.some((l) => l.who.startsWith("npc:")), `${d.id}: a returning NPC should speak`);
  }
  // Something sets each `met:` flag.
  const set = new Set<string>();
  for (const def of SCENES)
    for (const { o } of outcomes(def)) for (const e of o.fx ?? []) if (e.t === "flag" && e.key.startsWith("met:")) set.add(e.key);
  for (const d of returns) {
    const cond = (d.when ?? []).find((c) => "flag" in c && c.flag.startsWith("met:")) as { flag: string };
    assert.ok(set.has(cond.flag), `${d.id}: nothing ever sets ${cond.flag}`);
  }
});

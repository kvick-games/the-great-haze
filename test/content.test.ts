import { test } from "node:test";
import assert from "node:assert/strict";
import { SCENES, sceneById } from "../src/game/content/scenes/index.ts";
import { ENEMIES } from "../src/game/content/enemies.ts";
import { RECRUITS, ROSTER, BACKGROUNDS } from "../src/game/content/roster.ts";
import { LANDMARKS, REGIONS, STORES } from "../src/game/world.ts";
import { RESOURCE_IDS, ROLES, TRAITS } from "../src/game/types.ts";
import type { Effect, Outcome, SceneDef } from "../src/game/types.ts";
import { ITEMS } from "../src/game/tuning.ts";

function outcomesOf(def: SceneDef): { where: string; o: Outcome }[] {
  const out: { where: string; o: Outcome }[] = [];
  for (const opt of def.options) {
    for (const group of ["genuine", "trap", "any"] as const) {
      for (const o of opt.results[group] ?? []) out.push({ where: `${def.id}/${opt.id}/${group}`, o });
    }
  }
  return out;
}

const QUEUED_BY_ENGINE = ["turned", "breakdown", "fogsick-quarantine", "deserter", "last-stand", "axle-break", "fistfight"];

test("scene ids are unique and options are well formed", () => {
  const ids = new Set<string>();
  for (const def of SCENES) {
    assert.ok(!ids.has(def.id), `duplicate scene id ${def.id}`);
    ids.add(def.id);
    assert.ok(def.title && def.intro.length > 0, `${def.id} needs a title and intro`);
    assert.ok(def.options.length > 0, `${def.id} needs options`);
    const optIds = new Set<string>();
    for (const opt of def.options) {
      assert.ok(!optIds.has(opt.id), `${def.id} has duplicate option ${opt.id}`);
      assert.notEqual(opt.id, "look", `${def.id}: "look" is reserved`);
      optIds.add(opt.id);
      assert.ok(opt.label.length > 0);
    }
  }
});

test("every option resolves for every hidden truth", () => {
  for (const def of SCENES) {
    const hasTruth = Boolean(def.tells && def.tells.length);
    for (const opt of def.options) {
      const r = opt.results;
      if (hasTruth) {
        const genuine = r.genuine ?? r.any;
        const trap = r.trap ?? r.any;
        assert.ok(genuine?.length, `${def.id}/${opt.id} has no outcome for a genuine situation`);
        assert.ok(trap?.length, `${def.id}/${opt.id} has no outcome for a trap`);
      } else {
        assert.ok(r.any?.length, `${def.id}/${opt.id} needs "any" outcomes (scene has no tells)`);
      }
    }
  }
});

test("outcomes have text and positive total weight", () => {
  for (const def of SCENES) {
    for (const opt of def.options) {
      for (const group of ["genuine", "trap", "any"] as const) {
        const list = opt.results[group];
        if (!list) continue;
        assert.ok(list.reduce((n, o) => n + (o.weight ?? 1), 0) > 0, `${def.id}/${opt.id}/${group}: zero total weight`);
      }
    }
    for (const { where, o } of outcomesOf(def)) assert.ok(o.text.trim().length >= 5, `${where}: outcome text missing`);
  }
});

test("stranger scenes carry tells that point both ways, and use them fairly", () => {
  for (const def of SCENES.filter((d) => d.tells)) {
    const tells = def.tells!;
    assert.ok(tells.some((t) => t.shows === "genuine"), `${def.id} has no genuine tell`);
    assert.ok(tells.some((t) => t.shows === "trap"), `${def.id} has no trap tell`);
    for (const t of tells) {
      assert.ok(t.p === undefined || (t.p > 0 && t.p <= 1), `${def.id}: bad tell probability`);
      assert.ok(["genuine", "trap", "noise"].includes(t.shows));
    }
  }
});

test("all effects reference things that exist", () => {
  const check = (where: string, e: Effect) => {
    switch (e.t) {
      case "combat":
        assert.ok(ENEMIES[e.enemy], `${where}: unknown enemy ${e.enemy}`);
        break;
      case "scene":
        assert.ok(sceneById(e.id), `${where}: unknown scene ${e.id}`);
        break;
      case "recruit":
        if (e.id) assert.ok(RECRUITS.some((r) => r.id === e.id), `${where}: unknown recruit ${e.id}`);
        break;
      case "res":
        assert.ok(RESOURCE_IDS.includes(e.res), `${where}: unknown resource ${e.res}`);
        break;
      case "leave":
        for (const id of Object.keys(e.takes ?? {})) assert.ok(RESOURCE_IDS.includes(id as never), `${where}: unknown resource ${id}`);
        break;
      default:
        break;
    }
  };
  for (const def of SCENES) {
    for (const opt of def.options) {
      for (const id of Object.keys(opt.cost ?? {})) assert.ok(id === "scrip" || RESOURCE_IDS.includes(id as never), `${def.id}/${opt.id}: unknown cost ${id}`);
    }
    for (const { where, o } of outcomesOf(def)) for (const e of o.fx ?? []) check(where, e);
  }
  for (const [id, enemy] of Object.entries(ENEMIES)) {
    assert.equal(enemy.id, id);
    for (const e of enemy.loot ?? []) check(`enemy ${id}`, e);
  }
});

test("scenes the engine queues by name all exist", () => {
  for (const id of QUEUED_BY_ENGINE) assert.ok(sceneById(id), `missing engine scene ${id}`);
  for (const lm of LANDMARKS) {
    if (lm.scene) assert.ok(sceneById(lm.scene), `landmark ${lm.id} references missing scene ${lm.scene}`);
    if (lm.storeId) assert.ok(STORES[lm.storeId], `landmark ${lm.id} references missing store ${lm.storeId}`);
  }
  assert.ok(STORES["cinder-ford"]);
});

test("dispute scenes can pick a pair", () => {
  for (const def of SCENES.filter((d) => d.kind === "dispute")) assert.ok(def.pairWeight, `${def.id} needs pairWeight`);
});

test("roster, recruits, and backgrounds are valid and unique", () => {
  const ids = new Set<string>();
  for (const m of [...ROSTER, ...RECRUITS]) {
    assert.ok(!ids.has(m.id), `duplicate member id ${m.id}`);
    ids.add(m.id);
    assert.ok(ROLES.includes(m.role));
    assert.equal(m.traits.length, 2, `${m.id} should have exactly two traits`);
    for (const t of m.traits) assert.ok(TRAITS.includes(t));
    for (const other of Object.keys((m as { ties?: Record<string, number> }).ties ?? {})) assert.ok(ROSTER.some((r) => r.id === other), `${m.id} has a tie to unknown ${other}`);
  }
  assert.ok(ROSTER.length >= 8, "need enough companions to choose from");
  for (const b of BACKGROUNDS) assert.ok(ROLES.includes(b.role));
  assert.ok(!ids.has("leader"));
});

test("regions tile the road and landmarks fall inside it", () => {
  assert.equal(REGIONS[0].start, 0);
  for (let i = 1; i < REGIONS.length; i++) assert.equal(REGIONS[i].start, REGIONS[i - 1].end);
  for (const r of REGIONS) assert.equal(r.sky.length, 4);
  const last = REGIONS[REGIONS.length - 1].end;
  for (const lm of LANDMARKS) assert.ok(lm.mile > 0 && lm.mile <= last);
  assert.equal(LANDMARKS[LANDMARKS.length - 1].mile, last);
});

test("stores stock only known items", () => {
  for (const store of Object.values(STORES)) {
    for (const id of RESOURCE_IDS) assert.ok(store.stock[id] !== undefined, `${store.id} missing stock for ${id}`);
    assert.ok(store.markup >= 1 && store.buyback >= 0 && store.buyback <= 1);
  }
  for (const id of RESOURCE_IDS) assert.ok(ITEMS[id].price > 0 && ITEMS[id].weight > 0);
});

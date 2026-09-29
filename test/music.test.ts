// The soundtrack's cue mapping (web/src/music/cues.ts) against real bot runs,
// and the score document's coverage of what the mapping can ask for. The
// sequencer and renderer have their own tests in the shared audio-engine;
// tools/music-render.ts renders and level-checks the score offline.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runBot } from "../tools/bots.ts";
import { NPCS } from "../src/game/content/npcs.ts";
import { COMPANION_IDS, hazeLevel, musicCues, musicScene, newlyDead, zoneWorsened, type MusicScene, type MusicView } from "../web/src/music/cues.ts";
import type { GameState, Screen } from "../src/game/types.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
type Rule = { section: string; when: Record<string, string | string[]> };
type Layer = { kind: string; motif?: string; motifFrom?: { state: string; map: Record<string, string>; fallback?: string | null } };
const score = JSON.parse(readFileSync(join(root, "assets/music/the-great-haze.dtscore.json"), "utf8")) as {
  schema: string;
  motifs: Record<string, unknown>;
  sections: Record<string, { layers: Layer[]; enterStinger?: string }>;
  stingers: Record<string, { motif: string }>;
  rules: Rule[];
  defaultSection: string;
};

/** The section the score's rules pick for a set of states (first match wins). */
function sectionFor(states: Record<string, string>): string | undefined {
  return score.rules.find((r) => Object.entries(r.when).every(([k, v]) => (Array.isArray(v) ? v : [v]).includes(states[k] ?? "")))?.section;
}

function view(game: { s: GameState }, screen: Screen, previous: MusicScene | null, mourning = false): MusicView {
  const night = screen.kind === "plan" ? 1 : 0;
  return {
    state: game.s,
    screenKind: screen.kind,
    regionId: screen.hud.regionId,
    zone: screen.hud.zone,
    night,
    camp: night,
    moving: 0,
    busy: false,
    mourning,
    previous,
  };
}

test("the score is well formed where the game depends on it", () => {
  assert.equal(score.schema, "dreamatron.music-score/1");
  assert.ok(score.sections[score.defaultSection]);
  for (const r of score.rules) assert.ok(score.sections[r.section], `rule names unknown section ${r.section}`);
  for (const [id, s] of Object.entries(score.stingers)) assert.ok(score.motifs[s.motif], `stinger ${id} names unknown motif`);
  for (const [id, sec] of Object.entries(score.sections)) {
    if (sec.enterStinger) assert.ok(score.stingers[sec.enterStinger], `${id} enters with unknown stinger`);
    for (const l of sec.layers) {
      if (l.motif) assert.ok(score.motifs[l.motif], `${id}: unknown motif ${l.motif}`);
      for (const m of Object.values(l.motifFrom?.map ?? {})) assert.ok(score.motifs[m], `${id}: unknown motif ${m}`);
    }
  }
  // Themes the game relies on.
  for (const m of ["trail", "haze", "grief", "witch"]) assert.ok(score.motifs[m], `missing ${m} theme`);
  for (const stinger of ["death", "haze", "landmark", "fork"]) assert.ok(score.stingers[stinger], `missing ${stinger} stinger`);
});

test("every named companion has a theme at camp and in scenes", () => {
  for (const sectionId of ["camp", "scene"]) {
    const layer = score.sections[sectionId].layers.find((l) => l.motifFrom?.state === "focus");
    assert.ok(layer, `${sectionId} has no character theme layer`);
    for (const npc of NPCS) assert.ok(layer.motifFrom!.map[npc.id], `${sectionId}: no theme for ${npc.id}`);
    assert.ok(layer.motifFrom!.map.witch, `${sectionId}: no theme for the witch`);
  }
  assert.equal(COMPANION_IDS.size, NPCS.length);
});

test("every trail region has its own section, and the scenes the mapping names all resolve", () => {
  const trail = new Set<string>();
  for (const region of ["tallow", "fen", "flats", "pines", "spine", "threshold"]) {
    const s = sectionFor({ scene: "trail", region, mourning: "no" });
    assert.equal(s, `trail-${region}`);
    trail.add(s!);
  }
  assert.equal(trail.size, 6);
  const scenes: MusicScene[] = ["title", "muster", "town", "trail", "camp", "scene", "fork", "landmark", "combat", "ending"];
  for (const scene of scenes) assert.ok(sectionFor({ scene, region: "fen", mourning: "no", ending: "loss" }), `no section for ${scene}`);
  assert.equal(sectionFor({ scene: "ending", ending: "victory" }), "ending-victory");
  assert.equal(sectionFor({ scene: "ending", ending: "loss" }), "ending-loss");
  assert.equal(sectionFor({ scene: "trail", region: "fen", mourning: "yes" }), "grief");
  // Combat is never interrupted by mourning.
  assert.equal(sectionFor({ scene: "combat", mourning: "yes" }), "combat");
});

test("cue mapping basics", () => {
  const title = musicCues({ state: null, screenKind: null, regionId: null, zone: null, night: 0, camp: 0, moving: 0, busy: false, mourning: false, previous: null });
  assert.equal(title.states.scene, "title");
  assert.equal(sectionFor(title.states), "title");
  assert.equal(hazeLevel(80), 0);
  assert.equal(hazeLevel(0), 1);
  assert.ok(hazeLevel(20) > hazeLevel(40));
  assert.deepEqual(newlyDead(new Set(["a", "b"]), [{ id: "a", alive: false }, { id: "b", alive: true }, { id: "c", alive: false }]), ["a"]);
  assert.ok(zoneWorsened("far", "close"));
  assert.ok(!zoneWorsened("close", "near"));
  assert.ok(!zoneWorsened(null, "upon"));
});

test("bot runs map every screen to a section, with themes, deaths and endings", () => {
  const scenes = new Set<string>();
  const sections = new Set<string>();
  const focuses = new Set<string>();
  const endings = new Set<string>();
  let deaths = 0;
  for (const [i, strategy] of (["random", "reckless", "samaritan", "cautious"] as const).entries()) {
    for (let seed = 1; seed <= 6; seed++) {
      let previous: MusicScene | null = null;
      let alive: Set<string> | null = null;
      let last: { s: GameState; screen(): Screen } | null = null;
      const step = (game: { s: GameState }, screen: Screen) => {
        const dead = alive ? newlyDead(alive, game.s.party) : [];
        deaths += dead.length;
        alive = new Set(game.s.party.filter((m) => m.alive).map((m) => m.id));
        const { states, params } = musicCues(view(game, screen, previous, dead.length > 0));
        for (const [k, v] of Object.entries(params)) assert.ok(v >= 0 && v <= 1 && Number.isFinite(v), `${k}=${v}`);
        const section = sectionFor(states);
        assert.ok(section, `no section for ${JSON.stringify(states)} on a ${screen.kind} screen`);
        if (states.mourning === "yes") assert.equal(section, "grief");
        if (screen.kind === "combat") assert.equal(section, "combat");
        if (states.scene === "ending") {
          assert.equal(section, game.s.ending?.kind === "victory" ? "ending-victory" : "ending-loss");
          endings.add(section!);
        }
        scenes.add(states.scene);
        sections.add(section!);
        if (states.focus !== "none") focuses.add(states.focus);
        previous = musicScene(view(game, screen, previous));
      };
      runBot(strategy, seed * 97 + i, {}, 6000, (game, screen) => {
        last = game;
        step(game, screen);
      });
      // The hook sees every choice; the ending screen comes after the last one.
      const done = last as { s: GameState; screen(): Screen } | null;
      if (done) step(done, done.screen());
    }
  }
  for (const s of ["muster", "town", "camp", "scene", "fork", "combat", "ending"]) assert.ok(scenes.has(s), `bots never reached ${s} music (saw ${[...scenes].join(", ")})`);
  assert.ok(deaths > 0 && sections.has("grief"), "a death should bring the grief section");
  assert.ok(focuses.size > 0, "some scene or camp should carry a companion theme");
  assert.ok(endings.size > 0);
});

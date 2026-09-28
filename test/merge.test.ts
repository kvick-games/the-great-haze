// Route map (package A) and dialogue/companions (package B) working together.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Game } from "../src/game/game.ts";
import { chooseOption, makeRand, shop } from "../tools/bots.ts";

test("save and restore at every step of a full run stays in lock-step, with route scenes and companions", () => {
  let routeScenes = 0;
  let recruited = 0;
  for (const [seed, strat] of [[3, "random"], [8, "reckless"], [14, "random"], [21, "reckless"], [5, "random"], [9, "random"]] as const) {
    const a = Game.create({ seed, leaderName: "Jo", background: "surveyor" });
    let b = Game.restore(a.serialize());
    const ra = makeRand(seed);
    const rb = makeRand(seed);
    let first = true;
    for (let i = 0; i < 4000 && !a.over; i++) {
      if (a.s.pending.kind === "store") {
        shop(a, strat, first);
        shop(b, strat, first);
        first = false;
      }
      const ida = chooseOption(a, strat, ra);
      const idb = chooseOption(b, strat, rb);
      assert.equal(ida, idb, `seed ${seed}: bots diverged at step ${i}`);
      a.choose(ida);
      b.choose(idb);
      if (a.s.pending.kind === "scene" && a.s.pending.scene.id.startsWith("route-")) routeScenes++;
      assert.equal(JSON.stringify(a.s), JSON.stringify(b.s), `seed ${seed}: state drifted at step ${i}`);
      b = Game.restore(a.serialize());
    }
    assert.ok(a.over, `seed ${seed}: run finished`);
    recruited += a.s.party.filter((m) => m.recruited).length;
  }
  assert.ok(routeScenes > 0, "some run reached a route scene");
  assert.ok(recruited > 0, "some run took on a named companion");
});

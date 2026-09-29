import { test } from "node:test";
import assert from "node:assert/strict";
import { Game } from "../src/game/game.ts";
import { regionSpans } from "../src/game/map.ts";
import { chooseOption, makeRand, shop } from "../tools/bots.ts";

const COMPANIONS = ["ines", "dov", "cutter", "wren"];

test("regionSpans: the span under the wheels names the hud region, on every road and at forks", () => {
  for (const seed of [3, 11]) {
    const game = Game.create({ seed, leaderName: "Jo", background: "surveyor", companions: COMPANIONS });
    const rand = makeRand(seed);
    const seen = new Set<string>();
    let first = true;
    for (let i = 0; i < 2500 && !game.over; i++) {
      if (game.s.pending.kind === "store") {
        shop(game, "cautious", first);
        first = false;
      }
      const hud = game.hud();
      const spans = regionSpans(game.s);
      assert.ok(spans.length > 0);
      for (let k = 1; k < spans.length; k++) assert.ok(spans[k].lo <= spans[k - 1].hi + 1e-6, "spans leave no gap");
      const m = game.s.miles;
      const holding = spans.filter((sp) => m >= sp.lo - 1e-6 && m <= sp.hi + 1e-6);
      assert.ok(holding.length > 0, "some span covers the current mile");
      assert.ok(holding.some((sp) => sp.region === hud.regionId), `a span at mile ${m} names ${hud.regionId}`);
      seen.add(hud.regionId);
      game.choose(chooseOption(game, "cautious", rand));
    }
    assert.ok(seen.size >= 2);
  }
});

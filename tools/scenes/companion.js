// A joined companion (Birdie, the tinker) walking with the caravan.
// Plays the tinker's roadside scene until she is honest (a few seeds are traps), takes her aboard,
// clears the rest of the day's scenes, then sets the train moving. VIEW=camp stays in camp instead.
// Under #fast the day takes seconds: use a short wait (about 500 ms) to catch the walk.
(async () => {
  const d = window.__haze.director;
  d.ui.hideTitle();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (f, ms = 20000) => {
    for (let t = 0; t < ms && !f(); t += 100) await sleep(100);
    return f();
  };
  const hasBirdie = (g) => g.hud().party.some((m) => /birdie/i.test(`${m.id} ${m.name}`));
  const log = (m) => console.log("companion: " + m);
  let joined = false;
  for (let seed = 7; seed < 12 && !joined; seed++) {
    await d.newGame({ seed, leaderName: "Jo", background: "nurse", companions: ["ines", "dov", "cutter", "wren"] });
    const g = d.game;
    g.trade("rations", 100); g.trade("torches", 14); g.trade("ammo", 20); g.trade("medicine", 4);
    g.choose("depart");
    g.s.miles = 180; g.s.gap = 40; g.s.day = 20;
    g.s.queue = [{ t: "scene", id: "birdie-dead-mule" }, { t: "travel" }];
    g.s.pending = { kind: "result", title: "x", lines: [], notes: [] };
    d.resume(g.serialize());
    d.conv.holdAt = -2;
    await d.act("continue");
    d.conv.skipAll();
    if (!(await until(() => d.screen && d.screen.options.some((o) => o.id === "take"), 12000))) {
      log("seed " + seed + ": no take option; screen " + (d.screen && d.screen.kind));
      continue;
    }
    await until(() => !d.busy, 15000);
    await d.act("take");
    await until(() => !d.busy);
    joined = hasBirdie(d.game);
    log("seed " + seed + " joined " + joined + " title=" + (d.screen && d.screen.title) + " party=" + d.game.hud().party.map((m) => m.id + "/" + m.name).join(","));
  }
  d.conv.holdAt = null;
  // No random scene or quarrel interrupts the walk: the next day is just the road.
  d.game.beginDay = function () {
    this.s.queue = [{ t: "travel" }];
    this.advance();
  };
  // Click through the result and the morning plan until the wagons roll; no other scene interrupts the walk.
  for (let step = 0; step < 6 && window.__view !== "camp"; step++) {
    await until(() => !d.busy);
    d.conv.skipAll();
    await until(() => !d.busy);
    const o = d.screen && d.screen.options.find((x) => x.id === "go" || x.id === "continue");
    if (!o) break;
    if (o.id === "go") {
      d.act("go");
      break;
    }
    await d.act(o.id);
  }
})();

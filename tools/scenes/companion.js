// A joined companion (Birdie, the tinker) walking with the caravan. Seed 7 makes the
// stranger honest, then sets the train moving. VIEW=camp stays in camp instead.
(async () => {
  const d = window.__haze.director;
  d.ui.hideTitle();
  for (let seed = 7; seed < 8; seed++) {
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
    await new Promise((r) => setTimeout(r, 500));
    d.conv.skipAll();
    await new Promise((r) => setTimeout(r, 400));
    if (!d.screen || !d.screen.options.some((o) => o.id === "take")) continue;
    await d.act("take");
    if (g.s.party.some((m) => m.npc === "birdie" || m.id === "birdie")) break;
  }
  // Click through the result and the morning plan until the wagons roll.
  const idle = async () => {
    for (let k = 0; k < 40 && d.busy; k++) await new Promise((r) => setTimeout(r, 250));
  };
  for (let step = 0; step < 4 && window.__view !== "camp"; step++) {
    await idle();
    d.conv.skipAll();
    await idle();
    const o = d.screen && d.screen.options.find((x) => x.id === "go" || x.id === "continue");
    if (!o) break;
    if (o.id === "go") {
      d.act("go");
      break;
    }
    await d.act(o.id);
  }
})();

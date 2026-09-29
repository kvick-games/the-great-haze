// A check result: the tinker is asked to come along; the roller is ringed and the die readout shows.
// VIEW=-1 holds at the roll readout; VIEW=<n> holds at spoken line n; leave unset to play through.
(async () => {
  const d = window.__haze.director;
  d.ui.hideTitle();
  await d.newGame({ seed: 7, leaderName: "Jo", background: "nurse", companions: ["ines", "dov", "cutter", "wren"] });
  const g = d.game;
  g.trade("rations", 100); g.trade("torches", 14); g.trade("ammo", 20); g.trade("medicine", 4);
  g.choose("depart");
  g.s.miles = 180; g.s.gap = 40; g.s.day = 20;
  g.s.queue = [{ t: "scene", id: window.__u || "birdie-dead-mule" }, { t: "travel" }];
  g.s.pending = { kind: "result", title: "x", lines: [], notes: [] };
  d.resume(g.serialize());
  d.conv.holdAt = -2;
  await d.act("continue");
  await new Promise((r) => setTimeout(r, 1500));
  d.conv.skipAll();
  await new Promise((r) => setTimeout(r, 400));
  d.conv.holdAt = Number(window.__view ?? -1);
  await d.act("ask");
})();

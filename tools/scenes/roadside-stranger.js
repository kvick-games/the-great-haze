(async () => {
  const d = window.__haze.director;
  d.ui.hideTitle();
  await d.newGame({ seed: 7, leaderName: "Jo", background: "nurse", companions: ["ines", "dov", "cutter", "wren"] });
  const g = d.game;
  g.trade("rations", 100); g.trade("torches", 14); g.trade("ammo", 20); g.trade("medicine", 4);
  g.choose("depart");
  g.s.miles = 180; g.s.gap = 40; g.s.day = 20;
  g.s.queue = [{t:"scene",id:"wounded-traveler"},{t:"travel"}];
  g.s.pending = { kind: "result", title: "x", lines: [], notes: [] };
  d.resume(g.serialize());
  await d.act("continue");
  
})();

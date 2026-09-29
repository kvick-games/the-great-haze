// Tells staged: the stranger speaks, the party looks closer, and a "You notice" marker
// and a subtle cue appear on the stranger. U=<scene id> picks another scene.
(async () => {
  const d = window.__haze.director;
  d.ui.hideTitle();
  await d.newGame({ seed: 7, leaderName: "Jo", background: "nurse", companions: ["ines", "dov", "cutter", "wren"] });
  const g = d.game;
  g.trade("rations", 100); g.trade("torches", 14); g.trade("ammo", 20); g.trade("medicine", 4);
  g.choose("depart");
  g.s.miles = 180; g.s.gap = 40; g.s.day = 20;
  g.s.queue = [{ t: "scene", id: window.__u || "wounded-traveler" }, { t: "travel" }];
  g.s.pending = { kind: "result", title: "x", lines: [], notes: [] };
  d.resume(g.serialize());
  d.conv.holdAt = -2;
  await d.act("continue");
  await new Promise((r) => setTimeout(r, 1200));
  d.conv.skipAll();
  await new Promise((r) => setTimeout(r, 600));
  const look = d.screen && d.screen.options.find((o) => o.id === "look");
  if (look) await d.act("look");
})();

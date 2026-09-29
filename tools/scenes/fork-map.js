// A fork in the road, with a bought (misleading) map in the coat. Seed 7 makes the drover's sketch a liar.
// VIEW=map opens the full parchment overlay instead of the card.
(async () => {
  const d = window.__haze.director;
  d.ui.hideTitle();
  await d.newGame({ seed: 7, leaderName: "Jo", background: "nurse", companions: ["ines", "dov", "cutter", "wren"] });
  const g = d.game;
  g.trade("rations", 100);
  g.choose("depart");
  g.s.scrip = 200;
  g.s.route.node = "drovers-rest";
  g.s.route.visited = ["cinder-ford", "drovers-rest"];
  g.s.pending = { kind: "store", storeId: "drovers-rest" };
  d.resume(g.serialize());
  try {
    g.choose("buymap:drover-sketch");
  } catch (e) {
    console.error(String(e));
  }
  g.s.route.node = "crows-parting";
  g.s.route.visited = ["cinder-ford", "drovers-rest", "crows-parting"];
  g.s.miles = 40;
  g.s.pending = { kind: "fork", node: "crows-parting" };
  d.resume(g.serialize());
  if (window.__view === "map") setTimeout(() => d.ui.showMap(), 600);
})();

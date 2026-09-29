// A travel day in which the last wagon breaks down and is left at the roadside.
// Wait about 1500 ms (under #fast) after the script to catch the wagon settling by the verge.
(async () => {
  const d = window.__haze.director;
  d.ui.hideTitle();
  await d.newGame({ seed: 7, leaderName: "Jo", background: "nurse", companions: ["ines", "dov", "cutter", "wren"] });
  const g = d.game;
  g.trade("rations", 100); g.trade("torches", 14); g.trade("ammo", 20); g.trade("medicine", 4);
  g.choose("depart");
  g.s.miles = 180; g.s.gap = 40; g.s.day = 20;
  d.resume(g.serialize());
  const game = d.game;
  // The road takes the wagon on the way: the sim loses one as the day begins.
  game.beginDay = function () {
    this.s.queue = [{ t: "travel" }];
    this.s.train.wagons = Math.max(1, this.s.train.wagons - 1);
    this.advance();
  };
  await new Promise((r) => setTimeout(r, 800));
  const o = d.screen && d.screen.options.find((x) => x.id === "go");
  console.log("go option " + !!o + " wagons " + game.s.train.wagons + " game same " + (d.game === game));
  if (o) d.act("go");
  await new Promise((r) => setTimeout(r, 300));
  console.log("after: wagons " + d.game.s.train.wagons + " hud " + d.game.hud().wagons);
})();

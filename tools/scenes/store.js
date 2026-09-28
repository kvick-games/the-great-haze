(async () => {
  const d = window.__haze.director;
  d.ui.hideTitle();
  await d.newGame({ seed: 4, leaderName: "Jo", background: "wheelwright", companions: ["ines", "dov", "cutter", "wren"] });
  d.game.trade("rations", 80); d.game.trade("torches", 10);
  d.screen = d.game.screen(); d.present();
})();

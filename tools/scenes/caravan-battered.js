// A late-game caravan in bad shape, standing on the road for side-on review.
//   VIEW=wide|push|wheels|back|dusk  node tools/web-scene.mjs out.png tools/scenes/caravan-battered.js 3500
// Set CARAVAN=fresh for the same train on day one. U (0..1) picks the moment within a shot.
(async () => {
  const d = window.__haze.director;
  d.ui.hideTitle();
  await d.newGame({ seed: 7, leaderName: "Jo", background: "sergeant", companions: ["ines", "dov", "cutter", "wren"] });
  const g = d.game;
  g.trade("rations", 100);
  g.trade("torches", 14);
  g.trade("ammo", 20);
  g.trade("medicine", 4);
  g.choose("depart");
  const fresh = window.__caravan === "fresh";
  const s = g.s;
  if (!fresh) {
    s.miles = 430;
    s.gap = 24;
    s.day = 41;
    s.train.condition = 24;
    s.res.rations = 7;
    s.res.torches = 3;
    s.res.ammo = 4;
    s.res.medicine = 0;
    s.res.spares = 0;
    const by = (id) => s.party.find((m) => m.id === id);
    Object.assign(by("ines"), { health: 34, wounded: true, sick: true, nerve: 30 });
    Object.assign(by("dov"), { health: 12, dying: true, wounded: true, nerve: 45 });
    Object.assign(by("cutter"), { health: 55, wounded: true, nerve: 62 });
    Object.assign(by("wren"), { health: 70, fog: 2, nerve: 18 });
    Object.assign(s.party[0], { health: 60, nerve: 50 });
  } else {
    s.miles = 30;
  }
  s.queue = [];
  d.resume(g.serialize());
  document.getElementById("ui").style.display = "none";
  d.previewTravelShot(window.__view || "wide", Number(window.__u ?? 0.5), Number(window.__wagon ?? 0));
})();

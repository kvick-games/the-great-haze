// The party panel with portraits, and the crew sheet. VIEW=sheet opens a sheet (U=<member id>, default the
// second member); VIEW=fallen opens the sheet of the dead one; VIEW=mobile-sheet is the same for narrow screens.
// Members are hurt, sickened and one is killed so the portraits and the sheet have something to show.
(async () => {
  const d = window.__haze.director;
  d.ui.hideTitle();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (f, ms = 20000) => {
    for (let t = 0; t < ms && !f(); t += 100) await sleep(100);
    return f();
  };
  await d.newGame({ seed: 7, leaderName: "Jo", background: "nurse", companions: ["ines", "dov", "cutter", "wren"] });
  const g = d.game;
  g.trade("rations", 100); g.trade("torches", 14); g.trade("ammo", 20); g.trade("medicine", 4);
  await d.act("depart");
  await until(() => !d.busy);
  const s = g.s;
  const others = s.party.filter((m) => !m.isLeader);
  const [a, b, c, e] = others;
  d.ui.crew.chronicle.observe(s);
  s.day = 14;
  if (a) { a.health = 42; a.wounded = true; a.nerve = 38; }
  if (b) { b.sick = true; b.health = 55; b.fog = 1; }
  if (c) { c.dying = true; c.dyingSince = 13; c.health = 12; c.nerve = 20; }
  if (e) { e.alive = false; e.fate = "taken by the Haze on the fen road"; }
  const lead = s.party.find((m) => m.isLeader);
  if (a && b) s.bonds[a.id < b.id ? a.id + "|" + b.id : b.id + "|" + a.id] = 64;
  if (a && c) s.bonds[a.id < c.id ? a.id + "|" + c.id : c.id + "|" + a.id] = -42;
  if (a && e) s.bonds[a.id < e.id ? a.id + "|" + e.id : e.id + "|" + a.id] = 35;
  if (lead && a) a.trust = 34;
  d.conv?.skipAll?.();
  await until(() => !d.busy);
  d.screen = g.screen();
  d.present();
  await sleep(300);
  const view = window.__view || "";
  const pick = view.includes("fallen") ? e : (others.find((m) => m.id === window.__u) || a);
  if (view.includes("sheet") || view.includes("fallen")) {
    d.ui.openCrew(pick.id);
  }
  if (view.includes("interact")) {
    // Checks the sheet's open/close paths and narrates the results.
    const open = () => !document.querySelector(".crew-layer").hidden;
    const tiles = [...document.querySelectorAll(".party .member")];
    tiles[1].click(); await sleep(100);
    console.log("click opens: " + open() + " | focus on " + document.activeElement.className);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); await sleep(50);
    console.log("esc closes: " + !open() + " | focus back on tile: " + (document.activeElement === tiles[1]));
    tiles[2].click(); await sleep(100);
    document.querySelector(".crew-scrim").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); await sleep(50);
    console.log("outside click closes: " + !open());
    tiles[4].click(); await sleep(100);
    console.log("fallen opens: " + open());
    document.querySelector(".crew-close").click();
    console.log("close button: " + !open());
    tiles[1].click(); await sleep(100);
    d.ui.setBusy(true);
    console.log("busy closes: " + !open());
    d.ui.setBusy(false);
  }
  console.log("crew: " + s.party.map((m) => m.id + (m.alive ? "" : "(dead)")).join(","));
})();

# The Great Haze

Working title for a modern horror take on Oregon Trail, built with Dream Engine.

Repository: https://github.com/kvick-games/the-great-haze

## Status

The game is **playable in 3D in the browser** and its **simulation core is implemented and tested**. It is not yet
bound to Dream Engine.

- `src/game/`: engine-agnostic core: the Haze clock, supplies and stores, the party (nerve, trust, bonds, traits),
  strangers with hidden truth and tells, combat, quarrels, crises, landmarks, and four endings.
- `src/game/content/`: the road as data: 60+ scenes, enemies, a 12-person roster, and recruitable strangers.
- `web/`: a real-time 3D client (Three.js) that drives the same core. The wagon train rolls across six regions
  under a sky that bleeds as the Haze closes in; every event is staged on the road; camps, combat, deaths, and
  recruits all play out on screen. See "The 3D client" in [docs/design.md](docs/design.md).
- `tools/`: a terminal player, bot strategies, a balance simulator, a browser driver, and a project-manifest validator.
- `test/`: 46 tests, including invariants over many seeded runs and measurements of the design pillars.

Not done: the Dream Engine binding (scenes, prefabs, Studio-authored UI). `src/main.ts` is still the placeholder,
and nothing new is registered in `project.dtproject`. The browser client is a prototype presentation layer; see the
design doc for why and for the intended integration shape.

## Play it now

Requires Node 22+.

```
npm install
npm run web:build                                          # writes dist/the-great-haze.html; open it in a browser
npm run play -- --seed 7 --name Jo --background nurse     # or play in the terminal
npm test                                                   # 46 tests, ~7s
npm run typecheck                                          # core, tools, and the web client
npm run validate                                           # manifests + referenced paths
npm run web:smoke                                          # plays the 3D build in headless Chromium
npm run simulate -- 200 normal                             # balance report across bot strategies
npm run trace -- cautious 7                                # full transcript of one bot run
```

The built page loads Three.js from jsDelivr at the pinned version; `npm run web:build -- --inline` bundles it for
offline use. Add `#fast` to the page URL to run cinematics at high speed.

## The game in one paragraph

You are the wagon-master of a train of covered wagons fleeing a crimson fog, the Great Haze, toward the Blue Reach,
840 miles away. You buy what you can afford, choose four companions, and go. Every stop, whether to help a stranger,
scavenge a farmhouse, or mediate a quarrel, costs hours, and the Haze keeps its own clock. Half of the people begging
for help are telling the truth. Half are not. Read the tells, manage the party's nerve, keep the torches burning, and do
not stop for anything you cannot afford.

## Open the project

Open `project.dtproject` in Dream Engine Studio. This is the single project authority;
`dreamengine.project.json` is the engine's native workspace document.
The local checkout lives at `D:\Dreamatron\Games\TheGreatHaze`.
Dream Engine is currently supplied by the local ecosystem checkout at
`D:\Dreamatron\Apps\DT_DreamEngine`; it is not bundled in this repository.

## Brief

See [the original game brief](docs/game-brief.md). The name is provisional.
Party relationships, scarce supplies, combat, deceptive encounters, genuine requests for help,
and pressure from the approaching Great Haze were the requested pillars; all of them are now implemented in the
core and staged by the 3D client.

## Preservation

Local Git and the explicitly requested GitHub remote preserve the setup files.
DT_Backup project enrollment remains opt-in; no backup selection or nightly protection is claimed.

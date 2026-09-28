# The Great Haze

Working title for a modern horror take on Oregon Trail, built with Dream Engine.

Repository: https://github.com/kvick-games/the-great-haze

## Status

The game's **simulation core is implemented and tested**; it is not yet bound to Dream Engine.

- `src/game/`: engine-agnostic core: the Haze clock, supplies and stores, the party (nerve, trust, bonds, traits),
  strangers with hidden truth and tells, combat, quarrels, crises, landmarks, and four endings.
- `src/game/content/`: the road as data: 60+ scenes, enemies, a 12-person roster, and recruitable strangers.
- `tools/`: a terminal player, bot strategies, a balance simulator, and a project-manifest validator.
- `test/`: 33 tests, including invariants over many seeded runs and measurements of the design pillars.

Not done: Dream Engine scenes, prefabs, UI, audio, and art. `src/main.ts` is still the placeholder, and the
core has not been registered in `project.dtproject`. See [docs/design.md](docs/design.md) for the reasons and the
intended integration shape.

## Play it now

Requires Node 22+. No runtime dependencies; `npm install` only fetches TypeScript and Node typings for checks.

```
npm install
npm run play -- --seed 7 --name Jo --background nurse     # play in the terminal
npm test                                                   # 33 tests, ~6s
npm run typecheck
npm run validate                                           # manifests + referenced paths
npm run simulate -- 200 normal                             # balance report across bot strategies
npm run trace -- cautious 7                                # full transcript of one bot run
```

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
and pressure from the approaching Great Haze are requested pillars, not implemented features.

## Preservation

Local Git and the explicitly requested GitHub remote preserve the setup files.
DT_Backup project enrollment remains opt-in; no backup selection or nightly protection is claimed.

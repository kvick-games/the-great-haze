# Soundtrack

The music is adaptive and procedural: no audio files. A score document,
`assets/music/the-great-haze.dtscore.json` (`dreamatron.music-score/1`, a
Waver-owned asset registered in `project.dtproject`), describes sections,
themes, layers, stingers and rules. DreamEngine's music host
(`@dreamatron/dreamengine-music/host`, over the shared audio-engine `music`
module) plays it with Web Audio.

## How the game drives it

`src/game/` knows nothing about music. `web/src/music/cues.ts` is a pure map
from what the player sees to the score's **states** and **parameters**:

| State | Values |
|---|---|
| `scene` | title, muster, town, trail, camp, scene, fork, landmark, combat, ending |
| `region` | tallow, fen, flats, pines, spine, threshold (each trail region has its own section and palette) |
| `scenario` | the scene kind (stranger, hazard, find, haze, oddity, respite, dispute, crisis, landmark) or witch |
| `focus` | the companion a scene is about, or one companion per night at camp; the witch |
| `ending` | victory, loss |
| `mourning` | yes for a while after a death |

Parameters are `haze` (from the gap: the dread drone, the Haze's breath and its
motif rise with it over the trail, camp and forks), `danger`, `intensity` and
`night`. The score's rules pick the section; transitions land on beats (combat)
or bar lines.

`web/src/music/controller.ts` polls the director four times a second, tolls a
bell stinger and holds the grief section when someone dies, plays the Haze
stinger when the zone worsens, and ducks the music while a conversation runs or
speech synthesis is speaking. `GameMusic.duck(on)` is the explicit hook: the
speech voice (`web/src/talk/voice.ts`) or a recorded voice pack can call it
around each line instead of relying on the polling.

## Themes

The trail theme recurs in almost every section, in that section's key and mode
(major for the victory ending). Themes are written as scale degrees and vary by
seed after their opening notes, so repeats stay recognizable. Other themes: the
Haze (a rising minor second), one per named companion, the witch, one per
scenario kind, the fork, landmarks and grief.

## Controls and headless runs

The **Music** button beside Sound mutes the music; the slider sets its volume.
Both persist in localStorage. The master Sound switch silences music too.
Under automation (`navigator.webdriver`) and `#fast`, the host is inert: its
sequencer runs and `window.__haze.music.status()` reports sections, but no audio
context is created.

## Building and checking

The web client is not a DreamEngine workspace, so `web/build.ts` resolves the
music host from a DreamEngine checkout: `DREAMENGINE_DIR`, or the nearest
`Apps/DT_DreamEngine` above this repository. Without one that has
`packages/music`, the build uses a silent stub and says so.

- `node tools/music-render.ts` renders every section, the Haze closing in, and a
  scripted run through the cue mapping to `artifacts/music/*.wav`, checks their
  levels, and writes `artifacts/music/report.txt` (sections, themes and
  stingers over time). It also checks the built game's host is inert under
  automation and that the control persists. Never commit the WAVs.
- `node tools/music-register.ts` refreshes the score's registration (size and
  sha256) after editing it; `npm run validate` fails until you do.
- `test/music.test.ts` maps bot runs through the cues and checks the score
  covers every state they produce.

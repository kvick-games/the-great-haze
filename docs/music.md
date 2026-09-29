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
| `scenario` | the scene kind (stranger, hazard, find, haze, oddity, respite, dispute, crisis, landmark); a relationship mood (tender, betrayal, lament); or witch |
| `focus` | the companion a scene is about (for a lament, the one who died), one companion per night at camp, the companion being mourned; the witch |
| `ending` | victory, loss |
| `mourning` | yes for a while after a death |

Parameters are `haze` (from the gap: the dread drone, the Haze's breath and its
motif rise with it over the trail, camp and forks), `danger`, `intensity` and
`night`. The score's rules pick the section; transitions land on beats (combat)
or bar lines.

Relationship scenes (`rel-*`) are crisis-kind for the simulation but get their
own music, listed in `RELATIONSHIP_MOOD` in `web/src/music/cues.ts`: courtship,
lovers, weddings and loyal friends play **tender** (the romance section, in F
major, with a slow, tender variant of the companion's theme and the trail
theme); affairs, jealousy and lovers' quarrels play **betrayal** (harmonic
minor, a creeping betrayal motif under a soured companion theme); grief for a
lover or friend plays the **grief** section with the dead companion's theme.
The rivals' brawl stays a plain crisis. Witch scenes (any id containing witch,
hag or crone, e.g. `witch-signs`) and the `witch` enemy in combat carry the
witch's theme, and she gets an entrance stinger each time she appears.

`web/src/music/controller.ts` polls the director four times a second, tolls a
bell stinger and holds the grief section (playing the dead companion's theme)
when someone dies, plays the Haze stinger when the zone worsens, and ducks the
music under speech. The speech voice (`web/src/talk/voice.ts`) calls
`GameMusic.duck(on)` as each line starts and ends (through
`voice.setDucker`, wired in `main.ts`); an active conversation or speech
synthesis still speaking ducks it too, as a fallback.

The score's master limiter (`mix.ceilingDb`, -3 dBFS) keeps overlapping
stingers from peaking above -3 dBFS; material under the threshold is untouched.

## Themes

The trail theme recurs in almost every section, in that section's key and mode
(major for the victory ending). Themes are written as scale degrees and vary by
seed after their opening notes, so repeats stay recognizable. Other themes: the
Haze (a rising minor second), one per named companion, the witch, one per
scenario kind, betrayal, the fork, landmarks and grief.

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
  levels (including the -3 dBFS peak ceiling), and writes `artifacts/music/report.txt` (sections, themes and
  stingers over time). It also checks the built game's host is inert under
  automation and that the control persists. Never commit the WAVs.
- `node tools/music-register.ts` refreshes the score's registration (size and
  sha256) after editing it; `npm run validate` fails until you do.
- `test/music.test.ts` maps bot runs through the cues and checks the score
  covers every state they produce.

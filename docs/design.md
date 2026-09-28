# The Great Haze — Design

Working title. Setting, names, and tone below are a first pass and are meant to move as the art does.
The original request is preserved, untouched, in [game-brief.md](game-brief.md).

## Premise

Nine winters ago the sky over the east stopped going dark. It went the color of a healing wound, and then the red
came down: the **Great Haze**, a bank of warm crimson fog a mile deep, rolling west across the whole country.
It does not stop and it does not tire. Over rock and open water it slows. Over farmland and forest it runs.

What the Haze takes does not die. It *empties*. People walk into it and come out with their eyes open and their
hands patient: the **Hollowed**, who follow it the way gulls follow a plough.

The Meridian Company, which once ran the Road and owned every waystation on it, has failed. Rumor says that past
the mountains there is a place where the sky is still blue: **the Blue Reach**, with a wall, a gate, and a ledger.

You are the **wagon-master** of a small train of covered wagons leaving Cinder Ford, the last town the Haze has not
reached. The Blue Reach is 840 miles away. The Haze is 58 miles behind you and it is faster than you are.

## Art direction (from the first two concept pieces)

The concept art pulls the setting toward a frontier wagon train, not a lone wagon, so the game commits to that.

- **Frontier, covered wagons, pitch torches.** A line of canvas wagons, oxen, and torchlight. The player character
  reads as a wide-brimmed-hat wagon-master holding a torch. Torches are therefore *the* resource: the ring of fire
  around camp is both the game's signature image and its most important nightly cost.
- **Two sky moods, and the game moves between them:**
  - *Far from the Haze* (the night-camp piece): deep navy and teal, a real starfield, cold clean cumulus, and
    **blood-red stains bleeding into the sky like paint**. Wagons ringed with torches, misty valley below.
  - *Close to the Haze* (the road piece): black smoke against oxblood cloud, a blood moon, dead bare trees, ash-gray
    earth, blood pooled in the ruts of the road.
- **Blue is safety.** The blue clouds of the night piece, with the red removed, are the Blue Reach. Red is the Haze.
  Warm firelight is the only other warm color in the frame.
- **The sky is the gauge.** Each region has four sky descriptions keyed to how close the Haze is
  (`far → near → close → upon`, see `src/game/world.ts`). A renderer should drive its sky from `hud.zone`.

The concept images themselves are not committed to this repository. Add them to the project through Dream Engine
Studio so they are registered in `project.dtproject`.

## Pillars, and how each is enforced

| Pillar | How the rules make it true |
| --- | --- |
| **Resources are always tight.** | The first market cannot fill the wagons (600 scrip; rations alone for the whole trip would cost more). Wagons have a hard cargo cap. Food, torches, physic, and shot each drain on their own clock. Anything you find must fit or be left behind. |
| **You can never stop for free.** | Every option carries an hour cost, shown before you choose. Hours come straight out of that day's travel; the Haze keeps its own clock. A "halt" day gives the Haze a full day on you. |
| **The world is hostile.** | Hazards, traps, and raiders are constant. Cargo, nerve, and bodies are all things the road can take. |
| **Some people genuinely need help.** | Roughly half of strangers are genuine. Helping them is the only source of recruits, big supply finds, and shortcuts — and refusing them wears on your party. |
| **Some people will use your kindness.** | The other half are traps. Same scene, same words; only the *tells* differ. |
| **Progress or be consumed.** | The Haze is a gap in miles that shrinks unless you outrun it. Gap ≤ 0 ends the run. |

These are not just aspirations: `test/runs.test.ts` measures them. Across seeded runs, careful discernment must beat
both reflexive kindness and reflexive suspicion; food must run dry in a large but not universal share of runs; and
never-stopping play must be shown to abandon real people while always-helping play is shown to get tricked.

## The loop

1. **Muster** at Cinder Ford: pick four companions from six offered (plus you, with a chosen background).
2. **Buy supplies.** 600 scrip, seven goods, a cargo cap. You cannot afford everything.
3. Each **day**:
   1. *Morning plan.* Set pace (Easy / Steady / Forced march / Halt) and rations (Full / Meager / Bare).
      Optionally repair the wagons, treat the sick and dying, rally the party, or **forage** (trade hours for food).
   2. *The road* throws up to two scenes and possibly a quarrel among your people.
   3. *Nightfall.* Supper, torches, the Haze creeping in, wounds and fever, and whatever crises surface in the dark.
   4. Landmarks fire at their mile: stores, forks, the mission, the toll gate.
4. **The Gate.** Reaching the Blue Reach is not the end of the decision-making. See below.

## The Haze and the clock

- `gap` is the distance in miles between the wagons and the Haze's leading edge. Start 58.
- Each day the Haze advances a region-dependent distance (about 8–12 miles) with noise, and occasional **surges**
  (+8) and **lulls** (−5). A *haunted* companion can hear a surge coming and will warn you at the morning plan.
- **It never lets you get comfortable.** Past a gap of about 62 miles the Haze quickens in proportion to how far ahead
  you are, so a cushion cannot grow without bound. Simulated careful runs sit around 70 miles early on and are squeezed
  toward the 40s by the end. The plan screen shows the Haze's expected move including this catch-up. Without this rule, early slack made the first third of the road toothless.
- You advance `travel hours × mph`. Hours spent on anything else reduce travel hours. Overflow spills into tomorrow.
- Zones: `far ≥ 45`, `near ≥ 25`, `close ≥ 10`, `upon < 10`. The closer it is, the more it costs nerve, the more
  Hollowed and Haze phenomena show up, and (below 32 miles) the more torches you burn each night.
- **Fogsick.** Breathing the Haze gives stages 0–3. At 3 a companion is *Turned*. If the wagon-master reaches
  stage 3 the run ends. Haze veils block much of it. Physic eases a stage at a time but never below stage I; only
  distance from the Haze wears the mark away, slowly.
- **Last stand.** When the gap falls below 14 a scene offers ways to buy miles, and every one of them costs: send
  the weakest companion back with the last torches (+12–16 miles), cut a wagon loose, burn a firebreak, or refuse.

## Party

Members have **health**, **nerve**, **trust** in you, **bonds** with each other, one **role**, and two **traits**.

- **Roles**: scout, mechanic, medic, hunter, guard, speaker. Each unlocks or improves options (a mechanic halves
  repair time; a medic stretches physic; a speaker can bargain and talk people down).
- **Traits**: hothead, kind, paranoid, greedy, stoic, pious, coward, veteran, charming, sickly, haunted.
  Traits change how nerve is lost, how fights and quarrels go, who is good at reading strangers, and who breaks first.
- **Nerve** is the party's mood and its perception. Below 30 people are *frayed* (quarrels spike); at 0 someone may
  walk into the Haze. Frayed observers also **misread tells**: they sometimes see evidence that points the wrong way.
- **Disputes** are scenes like any other: back one side, mediate (costs hours), cut it off, or look away and risk
  it turning into a fistfight. Some accusations have hidden truth and tells too (who *really* took the rations?).
- **Injury.** Zero health does not kill you outright. It leaves you **dying**, and you have until the second nightfall
  to spend physic. Another hit while dying is fatal, and rest does not help: only treatment does. Wounds bleed a little
  each night and can close on their own; the worse off you are, the less likely.
- **The wagon-master** is a person in the party. If they die, the run ends. The weakest-companion sacrifice and
  crisis scenes never target them.

## Strangers and the grammar of tells

A stranger scene rolls a hidden truth (`genuine` or `trap`), then rolls which tells are present. The intro text
never changes. The player sees one free first impression, then can spend an hour per **Look closer** (up to 3) to
surface more. A scout or a paranoid companion reveals two at a time. Tells are probabilistic and a few are
noise, so no single one is proof; but they follow a **shared grammar** that an attentive player can learn:

- **Traps** tend to be *too clean, too eager*: unmarked boots, tidy fires, hidden cover and trampled grass, questions
  about your guns or cargo before your names, stories with a hole, oxen that will not look at them.
- **Genuine need** tends to *ask for less than it needs*: old real wounds, shame, warnings offered before requests,
  hands cracked from work, a place set for someone who is gone.
- **Noise** (a nervous glance at the Haze) shows up under either truth.

Each option resolves differently by truth. There is almost always a **half-measure** (leave water and a ration;
send one scout alone) with a small cost and a small reward, because the pillar is a spectrum, not a switch.

## Dialogue

The cards say little; people talk. A scene has an `intro` of one or two short lines plus `talk`, 2 to 6 spoken
lines. Outcomes carry their own `talk` (1 to 4 lines) and a one-line `text`. A `Line` is
`{ who, text, mood?, gesture?, alt? }`, at most 14 words. `who` is `leader`, `actor`, `other`, `a`, `b`, `observer`,
`by` (whoever made the option's check), `stranger`, `role:<role>` or `npc:<id>`. Lines are resolved when the screen
is built (`SpokenLine`: speaker id, name, kind `member | stranger | npc`, text, mood, gesture), never at authoring
time, so a dead speaker is skipped and outcome lines are resolved before effects apply. `alt` swaps the words when the
speaker has a trait (`kind`, `paranoid`, `coward`...). Without a `mood` a member's is derived from traits and nerve.
Moods: calm, afraid, angry, pleading, sly, grieving, cold. Gestures: none, point, beckon, shrug, raise-hands, clutch,
kneel, draw-weapon, offer, turn-away. These sets are exported from `src/game/talk-types.ts` for the client to stage.

## Checks

An option may carry `check: { kind, dc, target?, exclude? }`. Kinds: `persuade`, `calm`, `haggle`, `talk-down`
(charisma) and `spot`, `see-lie` (perception). The best-suited living member rolls d20 + bonus against the dc,
chosen deterministically by bonus (ties go to party order). Bonus comes from role and trait tables in
`checks.ts`, steady or frayed nerve, weakness, wounds, fever and fog. The seeded RNG makes it reproducible. The result
is `{ kind, by, byName, target, roll, bonus, dc, success, reason }` and appears on the outcome screen; option previews
show who will roll and their bonus. Outcomes filter with `needs: "success" | "fail"`.

## Tells, structured

Each tell has `id`, `text`, `shows`, `p`, `severity` (1 subtle, 2 clear, 3 unmistakable) and `say`, what the observer
mutters aloud. Every scene has a genuine and a trap tell of severity 2 or more, so honest people give themselves away
as clearly as liars. **Look closer** is a `spot` check whose margin decides how many tells surface. **Read them**
is a `see-lie` check that yields a verdict (genuine, trap or unsure), which can be wrong on a bad roll.

## Named companions

`content/npcs.ts` defines nine people: role, traits, one-line backstory, a `Look` (build, height, age, skin, hair,
clothing, palette, prop, marks, summary, meant for portraits and video prompts), join lines, and a complication scene.
Recruiting one makes them an ordinary party member (`recruited`, flag `joined:<id>`). After `afterDays` their
complication fires once as a scene where they speak. Some strangers recur, gated on `met:<id>` flags.

## Combat

Short and expensive. Each round takes half an hour off the road and each tactic burns something: **fire** (shot, one
charge per shooter), **hold the line** (nothing but blood), **torches** (2; devastating against the Hollowed and
beasts, useless against men), **signal rocket** (may break their nerve), **pay them off**, or **run** (cargo is
dumped). Enemies scale with distance travelled. Humans can break and flee; the Hollowed do not.

## Landmarks

Ninefold Bridge (crossing), Meridian Wayhouse (a store whose factor short-weights rations and physic by a fifth
unless you spend an hour checking the scales; there is a fair tell if you read the shop text), the Fork at Glass Cross (fast, dangerous rail line or a
slow safe pilgrim road), Mission of Saint Ambrose (refuge, or something worse), the Toll Gate (extortion, or a
real toll), Last Lamp (store, brutal prices), and **the Gate of the Blue Reach**. Stopping to shop costs hours.

**The Gate** refuses anyone the Haze has marked. Bring them in with a lie and risk everyone, leave them in the
"quarantine ward" and go in without them, or stay outside together. Four endings, all earned by the run.

## Route map, forks and maps that lie

The road is a graph (`src/game/routes.ts`): nodes (towns, outposts, landmarks, forks) joined by edges that carry
terrain, true length and true hazards. Four forks (Crow's Parting, Black Water, Glass Cross, Spine Foot) offer two
or three routes each; every route sums to about 840 miles, so the choice is about risk, speed, wear and supplies.
`s.miles` stays the total odometer; region comes from the current edge or node (`hud.regionId`).

Forks are a `fork` screen with choices `route:<edgeId>`. The player only knows a rough default map (lengths rounded,
no danger) unless they buy one at the starting store or an outpost. Maps have hidden accuracy (faithful, careless,
misleading) and fair clues: the seller's tells, a too-good price, a party member who notices. Where the land differs
from the believed map, a reveal scene plays partway along the edge and costs hours or supplies; a warning map makes
it cheaper (`route:prepared`). Wrong beliefs are recorded and shown in `hud.map`. All of it is seeded and saves
round-trip; old saves are migrated onto the main road by odometer.

## Tuning

Every knob is in `src/game/tuning.ts` and `src/game/world.ts`. Use the simulator rather than guessing:

```
npm run simulate -- 200 normal     # 200 seeded runs per strategy
npm run simulate -- 200 dire
npm run trace -- cautious 7        # a full transcript of one bot run
```

Current targets on **Exodus (normal)**, measured by bots: careful play wins about 30%, always-help under 10%,
never-stop about 0%, random about 0%. On **Ash Reckoning (dire)** careful play wins roughly 13%. The bots read the
scene data directly so they are *better* at reading tells than a human will be; treat these as upper bounds.

## The 3D client

`web/` renders the game in real time with Three.js. It adds no rules: every decision still goes through
`Game.choose`, and the client turns the difference between the state before and after into something you watch.

- **The world** (`web/src/world/`). A procedural road through six regions, each with its own relief, ground colour,
  and scenery (wheat and east-facing scarecrows, drowned trees and reeds, white salt, dark pines, boulders and
  mountains, green grass under a clearing sky). Terrain is displaced in a shader using the same noise as the JS that
  places props, so nothing floats. Nothing is downloaded but Three.js itself: every model, texture, and sound is
  built in code.
- **The sky is the gauge.** Far from the Haze it is the night-camp concept: stars, teal cloud, red stains bleeding
  in. As the gap closes the stains spread, the moon reddens, fog turns crimson toward the east, blood pools in the
  wheel ruts, ash falls, and the Haze itself rises as a churning wall behind the train at a distance driven by the
  sim's gap.
- **Fire is the light.** The wagons carry torch poles, the wagon-master walks ahead with a torch like the road
  concept, and the camp is ringed with torches when the sim says torches were burned that night. A small pool of real
  lights is handed to whichever flames matter most to the current shot.
- **The director** (`web/src/director.ts`) plays each transition: breaking and making camp, rolling to the next
  event, a stranger staged on the road ahead (a man against a milestone, a toll rope with two armed men, the Vigil
  kneeling toward the Haze, a Hollowed procession on the ridge), recruits walking over from where they stood, the
  dead falling and a grave marker left behind, crises staged in camp, combat with enemies coming out of the dark
  and each tactic's effect (muzzle flashes, thrown fire, a signal rocket that turns the sky white), and the four
  endings.
- **The UI** (`web/src/ui/`) is a thin HTML layer: a HUD with a gauge showing the red band chasing your wagon, a
  party dock, and each decision as a card. The camera frames the subject in the part of the screen the card leaves
  free. Cinematics letterbox the screen and can be skipped with a click or Space.
- **Sound** is procedural WebAudio: wind, a drone that swells as the Haze closes, wheel rumble, fire crackle, and
  synthesized gunshots, fire, rockets, and a tolling bell.

Quality scales down automatically on phones and small screens (no bloom, fewer props); the camera button in the
HUD switches modes.

## Architecture and Dream Engine

`src/game/` is a **pure, engine-agnostic simulation core**: no rendering, input, or engine imports, plain-JSON state,
a seeded RNG, and a screen-in / option-out API:

```ts
const game = Game.create({ leaderName: "Jo", background: "surveyor" });
let screen = game.screen();      // title, lines, options (with hour costs), hud, store view
screen = game.choose("forage");  // returns the next screen
game.serialize();                // exact save; Game.restore() resumes with no drift
```

Content (scenes, enemies, roster, regions) is **data** under `src/game/content/`, interpreted by a small effect
engine. Adding a scene means writing an object, not code (see below).

A terminal harness (`npm run play`), the bots (`tools/`), and the 3D browser client (`web/`) all drive the same API.

The browser client exists because the Dream Engine checkout was not available to the session that built it and the
brief asked for something visual and 3D. It is a prototype presentation layer, not a second engine: the rules stay
in `src/game/`, and the director's job (turn a before/after state diff into staging) is the part to carry over when
the game is bound to Dream Engine.

**Not done, by design:** nothing here creates Dream Engine scenes, prefabs, components, or UI, and `src/main.ts` is
still the placeholder. The engine's authoring contract (in the Dreamatron ecosystem checkout) was not available while
this was built, so the binding layer is deliberately left for a session that can read it. The intended shape is a
thin adapter that renders `Screen`/`Hud` into Studio-authored scenes and forwards option ids to `game.choose`.
Source files use explicit `.ts` import extensions and only erasable TypeScript syntax so they run under Node's type
stripping and should bundle without changes; confirm against the engine's module rules.

New files under `src/`, `tools/`, `test/`, and `docs/` are **not registered** in `project.dtproject`. Registry
changes must go through the shared project-format transaction API, not hand edits.

## Adding content

A scene is a `SceneDef` (see `src/game/types.ts`). Minimal example:

```ts
{
  id: "ruined-farmhouse", kind: "find", weight: 6, regions: ["tallow", "fen"],
  title: "A ruined farmhouse",
  intro: ["A farmhouse stands back from the road, front door open, curtains moving."],
  options: [
    { id: "search", label: "Search it top to bottom", hours: 3,
      results: { any: [
        o("A cellar full of jars.", [fx.res("rations", [8, 16])], 5),
        o("The floor gives way under {actor}.", [fx.hp("actor", [-12, -5])], 2),
      ] } },
    { id: "leave", label: "Leave it alone", results: { any: [o("You do not stop.")] } },
  ],
}
```

- Give a scene `tells` and `genuineOdds` to make it a stranger; give options `results.genuine` / `results.trap`.
- Effects are data (`fx.res`, `fx.hp`, `fx.nerve`, `fx.combat`, `fx.recruit`, `fx.scene`, `fx.end`, ...).
- Text placeholders: `{actor}`, `{other}`, `{a}`, `{b}`, `{leader}`.
- `npm test` validates that every scene, enemy, recruit, and landmark reference resolves, and that every option has an
  outcome for every truth.

## Open questions

- Setting and tone once more art arrives: how far toward folk-horror versus survival drama?
- Whether the wagon-master should be a chosen character with a portrait, or a more abstract "voice".
- How much of the party should be procedurally generated versus authored, once there is room for more roster art.
- Audio: the ring of torches, the oxen, and the hum in the telegraph wire are all begging for sound design.
- Whether to add a persistent meta layer (a journal of past trains, unlocks) once a run feels right.

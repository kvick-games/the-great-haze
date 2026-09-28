# Handoff: the interaction, map and video experiment

Development moves from the cloud sandbox to the player's PC, where Hyperlab runs.
This note is the plan to resume from: what was asked, what was learned, and five
work packages ready to hand to parallel agents. Nothing below is implemented yet.
The four agents briefed in the cloud were stopped before they changed any code.

## Where things stand

- Branch `claude/horror-oregon-trail-game-d542x8`: the simulation core (`src/game/`,
  46 tests) and the real-time Three.js client (`web/`) with the review fixes.
- Run it: `npm install`, `npm run web:build`, open `dist/the-great-haze.html`
  (add `#fast` to speed cinematics up). Node 22.18+ (the build runs `.ts` directly).
- Visual checks: `node tools/web-scene.mjs out.png tools/scenes/<setup>.js 9000` renders one
  situation; `W=1280 H=720 node tools/web-play.mjs <outdir> <steps>` plays through the
  real UI and saves a screenshot per new screen kind. Set `CHROME_PATH` to a local
  Chrome, or run `npx playwright-core install chromium` once.

## What the player asked for

> I want to add more detail to the individual interactions, I want actual dialogue and
> stuff, I want fewer words in text and more stuff in the actual 3d simulation. For
> travelling, I want it to take a bit longer and establish like a side view of the
> caravan to showcase their diminishing state, right now everything is a bit too
> logical and not emotional enough, it's difficult to understand just by looking at the
> game exactly what is happening. Also we need to establish a map of the game and make
> choices at locations where there are forks in the road with different challenges,
> and sometimes the landscape should differ from the map, when reaching outposts you
> should have the option to buy a map but it may not be accurate or intentionally
> misleading, there should be clues to tell if someone is sketchy or maybe charisma
> rolls based on party members. We should make the party members more visually
> distinct, add NPCs who are optionally people you can bring along on the caravan
> throughout the game.
>
> But most importantly I want to use this as a test bed for using Hyperlab to generate
> videos of the gameplay events that play out utilizing the story graph feature but
> for an actual game. I want 2 primary ways of doing this: offline pre-baked content,
> and realtime API (expensive but faster) using fal's MiniMax H3 Max models. We should
> have datoms defined for each character in the game and be able to use those to
> generate consistent characters, and utilize the story graph world state system to
> keep track of changes to the characters over time, and we should have datom
> mutations to keep note of changes as characters undergo significantly life altering
> events or equipment/costume changes. Utilize Sonnet agents to execute on most of this.

## Findings and decisions

**Hyperlab.** Not public and not in any repository the cloud session could reach. First
local step: read Hyperlab's story-graph, world-state and datom API, then shape package D
to it. Until then the plan treats datoms in the Datomic sense (immutable facts
`[entity, attribute, value, tx, added]`). The game keeps its own datom log and story
graph as the source of truth for game facts, behind a small adapter that exports to
Hyperlab.

**fal MiniMax H3.** Taken from fal's public model pages via search, because the sandbox couldn't
reach fal.ai. Verify the field names against the live API docs before relying on them.

| Endpoint | Use |
|---|---|
| `minimax/h3-max/reference-to-video` | Consistent characters: `prompt` plus `reference_image_urls`, `reference_video_urls`, `reference_audio_urls` (12 files at most across the three) |
| `minimax/h3-max/image-to-video` | Animate a still (first frame, optionally a last frame) |
| `minimax/h3-max/text-to-video` | Prompt only |

- Output: 5–15 s at 24 fps, 480P or 768P for H3 Max; the base `minimax/h3/*` also offers 2K/4K.
- Other inputs seen: `aspect_ratio`, `resolution`, `prompt_expansion_mode`, `enable_safety_checker`.
  The duration field name is unconfirmed.
- Price: about $0.08/s at 768P and $0.05/s at 480P for H3 Max (base H3 is $0.06/s at 768P).
  H3 Max reportedly renders faster than real time.
- Queue API: `POST https://queue.fal.run/<endpoint>` with `Authorization: Key $FAL_KEY` returns
  `status_url` and `response_url`; poll the status until `COMPLETED`, then read `video.url`.
- Prompts should name references explicitly ("Image 1 is Marlowe Crane, the wagon-master…").

**Keys.** `FAL_KEY` stays server-side. The realtime path needs a small local proxy server
that the browser calls; the page must never hold the key.

## Work packages

Run A–D in parallel, each agent in its own worktree with the ownership below. Run E after
A–C are merged. Every package keeps `npm run typecheck`, `npm test`, `npm run validate`
and `npm run web:build` green. Web packages also run `npm run web:smoke` and look at
their screenshots. Keep `src/game/` free of engine, rendering, DOM and Node imports.
Shared files (`src/game/types.ts`, `src/game/game.ts`, `web/src/director.ts`) get small,
separated additions so merges stay easy.

### A. Route map, forks, maps that lie (simulation)
Owns `src/game/world.ts`, `travel.ts`, stores and outposts, a new map module, and its tests and tools.
- A route graph from Cinder Ford to the Blue Reach. Nodes are towns, outposts, landmarks
  and forks; edges carry terrain, true length and true hazards. Aim for 3–5 forks with 2–3
  routes each and real trade-offs (time, danger, cost, resources), with the total length
  close to today's 840 miles.
- A `fork` pending/screen kind that offers routes as the player's map describes them.
- Maps for sale at outposts, with hidden accuracy (faithful, careless or misleading) and fair
  clues to it (seller tells, a price too good, a party member noticing).
- When the land differs from the map, a scene reveals it on arrival (bridge gone, dead-end
  shortcut, burned town) and costs time or resources.
- `hud().map` gives believed nodes and edges in 2D map space, what has been visited, the current
  position and which beliefs were proven wrong.
- Keep `s.miles` as total miles travelled, because the 3D road uses it; derive the region from
  the current edge.
- Save round-trip; bots handle forks and buying maps; `npm run simulate` numbers before and after;
  tests for forks, purchases, the misleading-map reveal, mid-route save/restore and determinism.

### B. Dialogue, rolls, tells, companions (simulation and content)
Owns `src/game/content/scenes/**`, `roster.ts`, NPC content, `scenes.ts`, `party.ts`, and new
dialogue and check modules.
- Spoken lines `{ who, text, mood?, gesture? }` on scene setups and outcomes, 2–6 lines of
  at most about 14 words each.
  - `who` resolves to a party member (leader, actor, a/b, observer, a role), the stranger or an NPC.
  - `mood` and `gesture` come from fixed sets the client can animate.
  - Screens expose the resolved lines: speaker id, name, kind, text, mood and gesture.
  - Party lines reflect traits.
- Rewrite every scene so the card narration is 1–2 short lines, and move the drama into
  dialogue and staging.
- Seeded charisma checks (persuade, calm, haggle, talk down) and perception checks (spot a tell,
  see a lie), made by a specific member chosen by role and traits.
  - Modifiers come from traits, nerve, health and conditions.
  - The result shows `{ kind, by, target, roll, bonus, dc, success, reason }`.
- Structured tells `{ id, text, visible, severity }` that are fair both ways: traps give
  themselves away, and so do honest people in need. Perception reveals hidden tells.
- 6–10 named NPCs met on the road who can join the caravan. Some recur. Each has:
  - a role, traits and a one-line backstory;
  - a visual description (build, age, hair, clothing, a distinctive prop) that the 3D looks
    and the video datoms both use;
  - a complication and their own dialogue.
- Save round-trip, bots, simulate numbers, content validation tests.

### C. The caravan on the road and distinct people (web)
Owns `web/src/world/*` and the travel code in `web/src/director.ts`.
- Travel days of about 8–14 s (still skippable) built around side-on tracking shots of the
  whole caravan against the sky: a wide dolly, a push along the line, wheels in the ruts,
  and a look back when the Haze is close. Dusk falls during the roll.
- The caravan's state readable at a glance from live `hud()` data:
  - torn and sagging canvas and bad wheels as condition drops;
  - supply stacks that shrink with rations, torches and ammo;
  - straining oxen;
  - gait and posture from each member's health and nerve: limping, hunched, staggering,
    or lying in a wagon bed when dying;
  - bandages, and pallor with eye glow for the fog-sick;
  - small diegetic pops of the day's losses.
- Members recognisable by silhouette and a role prop:
  - medic: satchel with a red cross;
  - hunter: rifle and fur cap;
  - mechanic: tool belt and apron;
  - scout: long coat and spyglass;
  - speaker: collar, book and lantern;
  - guard: bandolier.

  Builds, hair, beards and coat colours vary too. NPC visual descriptions from B map onto
  the same system.
- Keep low quality light, and dispose everything that gets removed (`disposeTree`, `keep()`).

### D. Datoms, story graph, video pipeline (new modules)
Owns `src/story/**`, `tools/video/**`, `web/src/video/**`, `test/story.test.ts`, `docs/video-pipeline.md`,
and a few hook lines in `director.ts` and `main.ts`. Shape it to Hyperlab's API once that is read.
- `src/story/`, pure TypeScript:
  - `datoms.ts`: a datom store with `transact`, `asOf`, `entity`, `history` and stable JSON.
  - `characters.ts`: a namespaced character schema (appearance, costume, equipment, condition,
    status and reference sheet version), with initial datoms for the leader, the roster, NPCs
    and stranger/enemy archetypes.
  - `mutations.ts`: a pure `chronicle(before, after, choiceId)` returning a beat plus mutations for
    life-altering and costume/equipment changes: wounds, maiming, fog stages, starving, death,
    departure, turning, joining, weapons and props, bloodied or bandaged costume. A change of
    appearance bumps the character's sheet version.
  - `graph.ts`: story-graph beats and edges for a playthrough, plus an enumerator of the static
    content graph for pre-baking.
  - `shots.ts`: beat plus world state as of that transaction becomes a `ShotRequest`: a cache key
    from the beat template and the participants' sheet versions, endpoint, prompt, references
    (9 at most), duration, aspect ratio and resolution.
  - `hyperlab.ts`: the adapter.
- `tools/video/`:
  - `fal.ts`: a fetch-based queue client with all endpoint ids and field names in one config.
  - `refs.ts`: character reference sheets for each sheet version.
  - `bake.ts`: the offline path, with `--dry-run` writing a manifest and cost estimate, plus
    `--max-usd` and concurrency limits.
  - `server.ts`: the realtime proxy (`POST /shot`, `GET /shot/:id`, a cache by key, a budget cap)
    with a `--mock` mode that returns a placeholder clip.
- `web/src/video/`: a `VideoDirector` with modes off, baked, realtime and mock (for example
  `#video=mock`).
  - It plays clips in a skippable letterboxed overlay; the 3D cinematic always plays as the fallback.
  - It saves the run's datom log and graph with the game.
  - It adds a debug panel listing beats, mutations and requests.

### E. Presentation of A and B (web, after A–C merge)
- Dialogue played in 3D: lines anchored over the speaker, shot/reverse-shot cuts, gestures, and
  moods in poses. The card then holds only the choice.
- Rolls shown with who rolled and why; visible tells staged on the figures and props (a rifle
  glint, clean boots, too many footprints).
- A parchment map screen drawn from `hud().map`, and a 3D fork in the road with a signpost.
- NPC companions with their own looks, walking with the caravan.

## Notes

- A software-rendered playthrough once captured a black frame on the Cinder Ford store screen.
  Two re-runs rendered it correctly, and an in-page probe over 20 purchases found nothing near
  the camera. Look again if it shows up on real hardware.
- Re-run `npm run simulate` after A and B land, and keep outcomes close to today's balance.

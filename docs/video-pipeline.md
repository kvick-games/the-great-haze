# Video pipeline: gameplay events to Hyperlab clips

The game records what happens to its people as a story, and turns the moments that matter into shot requests. There are two ways to get video for them:

1. **Local, pre-baked (primary):** curated scenarios rendered on the `lucifer-comfy` worker (RTX 3080 Ti, 12 GiB) through Hyperlab Rebuild's H3 manifest scripts. Free per clip.
2. **fal, realtime or bulk (secondary, minimal):** the MiniMax H3 Max API through a local proxy. Costs money, off by default, mock-tested only.

The 3D cinematic is always the fallback: video is off unless the URL says otherwise, and a late, missing or broken clip just lets the game carry on.

Nothing here edits Hyperlab, reads its data, or calls a live Hyperlab or fal. Every live step is behind an explicit flag and defaults to a dry run.

## The story layer (`src/story/`, pure TypeScript)

| Module | What it holds |
| --- | --- |
| `datoms.ts` | `DatomLog`: an append-only `[entity, attribute, value, tx, added]` log with `transact`, `entity(asOf)`, `history`, `asOf(tx)`, stable JSON. Ether record shapes and slot links. |
| `characters.ts` | Character, prop and environment specs; the look model (ordered signatures give visual versions and slot keys such as `state_variants/wounded-v2`, `outfit_variants/bloodied-v3`). |
| `mutations.ts` | `chronicle(before, after, choice)`: diffs two game states into typed mutations (`join`, `death`, `departure`, `turning`, `wound`, `heal`, `maim`, `fog`, `costume`, `prop-gained`, `look`...) and a `Beat` with stakes. Life-altering ones carry `lifeAltering: true`. |
| `recorder.ts` | `StoryRecorder`: chronicles every choice into the log; serialises with the save. |
| `graph.ts` | Beats to a `hyperlab.sequence` v2 file: entities bound to datoms, complete state snapshots, transitions whose actions are `move_character`, `set_presence`, `equip_prop`, `set_flag`, `set_fact`... |
| `shots.ts` | `shotForBeat`: a request with a prompt, at most 9 reference slots, duration, and a cache key from template plus each participant's visual version. |
| `hyperlab.ts` | `planExport`: the ordered REST plan, and `runPlan` over any transport. |

`src/game/` never imports `src/story/`; `test/story.test.ts` enforces that and the purity rules.

### How a life event flows

- **A death at camp** is a game state change (`alive: false`, `fate`). `chronicle` classifies it (`death`, `departure` or `turning` from the fate text), emits a `death` mutation plus a `look` mutation (the dead look), and transacts `char/status` and the new visual version into the log. In the graph the mutation becomes `set_presence(false)` (location null), plus `unequip_prop`/`place_prop` for what they carried and a `set_fact` naming the event. The shot for that beat cites the dead look's variant slot and the character's `hero` slot as references.
- **A costume change** (bloodied after a hit, bandaged after medicine) becomes a `costume` mutation. It writes `look/costume`, bumps the visual version, and gives a new `outfit_variants/<label>-v<n>` slot on the *same* character datom. In the graph it is an `equip_prop`/`set_flag` transition on the same instance; in the shot the new slot rides along with `hero`, so the face stays the same and the clothes change.

## Primary route: curated scenarios on lucifer

Three short, mostly linear scenarios are cut from real seeded runs of the real engine (`tools/video/scenarios/defs.ts`). Each has a main line of 4 or 5 beats and one two-way fork (2 beats).

| Scenario | Pin | Main beats | Fork |
| --- | --- | --- | --- |
| `stranger-trap` "The girl on the road" | samaritan, seed 3, beats 24-28 (27 skipped) | a lost child is bait; a second trap at the stalled train; Dov wounded and bloodied; the leader's clothes stained | drive on without stopping |
| `night-death` "Abel at the fire" | samaritan, seed 72, beats 59-63 | Abel's wound closes at camp; the red orchard; Abel reaches stage 3; the mercy kill (death); the leader recovers | let him walk into the Haze (departure) |
| `companion-turns` "Juniper" | samaritan, seed 39, beats 55-59 (56 skipped) | a lost girl joins; the toll gate; the fog sickness, a wound and a stained dress; the Hollowed fought off | leave her on the road |

Together: 19 shots (main 13, fork 6), 119 seconds of video, 62 reference stills (some shared). The engine is deterministic, so the pins always replay identically. If merged game content moves them, `test/story.test.ts` fails with "re-run tools/video/scenarios/search.ts", which prints fresh pins:

```
node tools/video/scenarios/search.ts a|b|c 250
```

### Commands (all dry-run by default)

```
npm run video:export -- --scenario stranger-trap
```

prints the ordered plan and writes `artifacts/video/scenarios/<id>.{plan,main.h3-manifest,fork.h3-manifest}.json`. `node tools/video/h3-manifest.ts` writes just the manifests for all three.

The plan, in order:

1. **API stages** (sent only with `--live --base-url http://127.0.0.1:8487`, loopback only): register the project; a content node plus `ether-datom/publish` per character (looks as `state_variants`/`outfit_variants` slots on the same datom); one *unqueued* still-image job per reference slot. Base slots (`hero`, `front_view`, `three_quarter`) use `comfy-workflows/MiniMax_H3_T2I`; later looks use `comfy-workflows/qwen_image_2_1_image_edit` on the approved hero, so the face and build stay put. `--run-stills` adds a `run-now` per still, pinned to `lucifer-comfy`.
2. **Approve the stills** in Hyperlab and bind each to its datom slot. Base stills first.
3. **Resolve placeholders** into a manifest Hyperlab accepts:
   ```
   node tools/video/hyperlab-export.ts --scenario stranger-trap \
     --resolve artifacts/video/scenarios/stranger-trap.main.h3-manifest.json \
     --set project_id=... --set graph_id=... --set guide_id=... --set guide_revision=... \
     --set guide_fingerprint=... --set ref_image_size=... --slot-map slots.json
   ```
   The guide fields come from the live prompt guide (the script rejects a stale fingerprint). `slots.json` maps `datom_id:slot_key` to the resolved image. It exits non-zero and lists anything unresolved.
4. **Hyperlab's own scripts**, run from the Hyperlab repo without modification:
   ```
   pwsh -NoProfile -File scripts/apply_h3_manifest.ps1 -ManifestPath <resolved.json>            # preview
   pwsh -NoProfile -File scripts/apply_h3_manifest.ps1 -ManifestPath <resolved.json> -Apply
   pwsh -NoProfile -File scripts/run_h3_manifest.ps1   -ManifestPath <resolved.json> -ValidateOnly
   pwsh -NoProfile -File scripts/run_h3_manifest.ps1   -ManifestPath <resolved.json>
   ```
   The runner never pauses or reorders the shared queue, waits while the user has it paused, and stops on the first failure.

### Manifest shape

Generated by `tools/video/h3-manifest.ts`, matching what `apply_h3_manifest.ps1` reads:

- top level: `project_id`, `graph_id` (placeholders), `service_id: comfy-workflows/MiniMax_H3_R2V`, `prompt_guide`, `common` (`width: 864`, `height: 480`, `h3_turbo_enabled: true`), `shots`.
- per shot: `node_id`, `label`, `x`, `y`, `input_images`, `reference_video` (empty), `ref_image_size`, `prompt_lines`, `overrides` (`duration` 5 to 8, fixed `seed`).
- additive fields Hyperlab's scripts ignore: `references` (the datom slots, the source of truth; `input_images` is derived from them at resolve time), `meta`, `x_great_haze.execution_target_id: lucifer-comfy`.
- at most 6 reference images per shot (identity first, then the base hero for anyone drawn in a variant look), sized for a 12 GiB card.
- prompts follow the integrated multimodal description form: `integrated_multimodal_description:`, a `[Shot 1]` line naming each person with `(Image N)`, then `overall_soundscape:` and `non_diegetic_music:`. Quoted lines in the game text become `<d>[English] ...</d>` tags (at most 2).

### Cost and time

Local generation costs no API money. The docs I could read do not give a per-shot time on lucifer, so measure the first shot before queueing all 19 (the runner logs to `H3_RUNNER_LOG.jsonl` beside the manifest). With Turbo at 8 steps on a 3080 Ti, expect minutes per 5 to 8 second clip rather than seconds.

## Secondary route: fal (bulk bake and realtime)

Everything here is behind flags and dry-run first. The key comes only from the `FAL_KEY` environment variable at call time; it is never logged, written to a file or sent to the page, and errors are scrubbed.

```
npm run video:bake                       # dry run: manifest + cost estimate (default)
npm run video:bake -- --live --max-usd 20   # needs FAL_KEY; refuses without a cap
npm run video:server -- --mock           # local proxy with placeholder clips, no key, no spend
npm run video:server -- --max-usd 5      # live proxy, hard budget
```

The static bake enumerates every scene, outcome and combat stage: 438 clips, 2359 s, about $94.36 at 768P or $58.97 at 480P (351 outcome clips). Prices are from `src/story/videoconfig.ts`; the 1080P figure is a guess. Endpoints are `minimax/h3-max/{reference,image,text}-to-video`.

In the browser:

```
#video=mock                              placeholder cards, no server
#video=baked@clips/baked.json            pre-baked clips by template key
#video=realtime@http://127.0.0.1:8787    the local proxy; two requests at a time
videoMin=minor|notable|life-altering     smallest beat that gets a clip (default notable)
videoWait=<ms>                           how long to hold the game for a late clip
videoSlow                                keep clip timing real under #fast (for screenshots)
```

Backquote (or Shift+V) opens the debug panel: beats, mutations, request status and estimated cost, a play button per clip, and downloads of the story, the `.hlseq.json` graph and the Hyperlab plan. The story and graph are saved with the game save (`great-haze:3d:v1:story`, `...:graph`).

`node tools/video/overlay-shot.mjs <outDir> "<hash>"` plays the built client in headless Chrome and screenshots the overlay and panel.

## Still to check live

Things I could not verify without touching Hyperlab or fal:

- Ether REST bodies: the content node shape, the publish response key, whether re-registering a project is idempotent, and whether publish keeps our deterministic datom ids.
- The still-job capability names (`text_to_image`, `image_edit`) and param keys (`width`, `height`, `input_image`) on the T2I and edit services.
- How slot images get bound to a datom slot and approved (there is no API step for it in the plan; it is a manual stage).
- The R2V params beyond the ones set here (`width`, `height`, `duration`, `h3_turbo_enabled`), notably `h3_audio_mode`, the speaker fields for dialogue, `ref_image_size`, and how the manifest's `input_images` relate to datom slot receipts. `apply_h3_manifest.ps1` reads `input_images`; the slot references are carried alongside.
- **Pinning to `lucifer-comfy`:** `run-now` takes an `execution_target_id`, but I could not confirm that `run_h3_manifest.ps1` passes one. Check the script for a parameter, or pin the jobs after apply.
- The fal side: response key names, the `duration` key on the reference route, and the 1080P price.

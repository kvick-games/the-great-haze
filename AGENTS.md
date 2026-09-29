# The Great Haze

This is a Dream Engine game project. The working title is provisional.

- Read `docs/game-brief.md` before game work. Initial setup contains no gameplay.
- Read the ecosystem `AGENTS.md` and `Apps/DT_DreamEngine/AGENTS.md` from the local Dreamatron checkout before editing scenes, objects, or game systems. On this workstation the ecosystem is `D:\Dreamatron`.
- Follow Dream Engine's native Studio authoring contract: persisted scene/prefab/component properties, stable identities, and preserved instance overrides.
- Keep `project.dtproject` as the single project authority. Use shared project-format transaction APIs for registry changes.
- Keep runtime dependencies in the shared engine checkout; do not copy the engine into this repository.
- Make meaningful local Git checkpoint commits. The authorized origin is https://github.com/kvick-games/the-great-haze.git.
- Use DT_Backup for backup operations. New project backup selection is opt-in.
- The simulation core in `src/game/` has tests: run `npm test`, `npm run typecheck`, and `npm run validate` (manifests and referenced paths) before committing. `web/` is a Three.js prototype client over the same core; check it with `npm run web:build` and `npm run web:smoke`. Read `docs/design.md` for the systems and `docs/game-brief.md` for the original request. Keep `src/game/` free of engine, rendering, and Node imports.
- The next round of work (dialogue, route map and forks, caravan visuals, companions, and the Hyperlab/fal video pipeline) is planned in `docs/handoff-video-experiment.md`. Start there.
- Game documentation lives in the DT_Design wiki of `project.dtproject`: open it in DT_Design under Wiki, "The Great Haze: Start here". `documentation-index.json` lists stable page ids. Edit pages with `python D:\Dreamatron\Apps\DT_Design\scripts\dtwiki.py --project <this project.dtproject> ...`, never by hand.
- Never commit or force-add anything under `artifacts/`, `outputs/` or `.hyperlab/` (generated images, video, audio, renders). The repo is public and those folders are ignored on purpose. Image or video generation runs must not create commits at all.
- The adaptive soundtrack is described in `docs/music.md`. The web build takes the music host from a DreamEngine checkout (`DREAMENGINE_DIR` or the ecosystem layout) and falls back to silence. After editing the score, run `node tools/music-register.ts`; `node tools/music-render.ts` renders and checks it offline (WAVs go to gitignored `artifacts/music/`).

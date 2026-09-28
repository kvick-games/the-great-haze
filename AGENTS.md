# The Great Haze

This is a Dream Engine game project. The working title is provisional.

- Read `docs/game-brief.md` before game work. Initial setup contains no gameplay.
- Read the ecosystem `AGENTS.md` and `Apps/DT_DreamEngine/AGENTS.md` from the local Dreamatron checkout before editing scenes, objects, or game systems. On this workstation the ecosystem is `D:\Dreamatron`.
- Follow Dream Engine's native Studio authoring contract: persisted scene/prefab/component properties, stable identities, and preserved instance overrides.
- Keep `project.dtproject` as the single project authority. Use shared project-format transaction APIs for registry changes.
- Keep runtime dependencies in the shared engine checkout; do not copy the engine into this repository.
- Make meaningful local Git checkpoint commits. The authorized origin is https://github.com/kvick-games/the-great-haze.git.
- Use DT_Backup for backup operations. New project backup selection is opt-in.
- The simulation core in `src/game/` has tests: run `npm test`, `npm run typecheck`, and `npm run validate` (manifests and referenced paths) before committing. Read `docs/design.md` for the systems and `docs/game-brief.md` for the original request. Keep `src/game/` free of engine, rendering, and Node imports.

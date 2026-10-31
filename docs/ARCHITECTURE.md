# Architecture

```
src/
  core/          App shell (screen flow, pause/quit, settings), shared types, stage contract
  engine/        Babylon imports, engine host + quality, materials, merged-mesh helper, menu scene
  physics/       Deterministic platformer physics (pure TS, unit tested)
  controls/      Keyboard + multi-touch input merged into one state
  characters/    Original hero definitions and procedural 3D character/animal models
  animations/    Procedural rig animator: idle, blink, walk, run, jump, fall, land, wave,
                 interact, rescue, celebrate
  environment/   Town scenery builder (sky, hills, ground, platforms, canal, houses, trees,
                 flowers, playground, checkpoints, finish arch)
  effects/       Pooled particle bursts (sparkles, dust, confetti, splash)
  levels/        Stage registry (15 stages, lazy-loaded), generic StageRuntime, level data
    stage1/      Welcome to Labrador Town: layout per age mode + entry point
  progression/   Save data (localStorage, sanitised), reward rules
  audio/         Web Audio music sequencer and sound effects, optional speech hints
  localization/  English and Bahasa Melayu
  ui/            HUD, menus, modals, icons, styles
tests/
  unit/          physics, progression, localisation
  integration/   Stage 1 layout reachability and registry
  gameplay/      Playwright end-to-end run in Chromium
```

## Key decisions

- **Original, procedural 3D art.** Characters and scenery are built from rounded meshes at
  runtime, so there are no third-party model licences and nothing to download beyond the code
  (≈ 430 kB gzipped total). GLB assets can be dropped in later through the same `Rig` contract.
- **Draw-call budget.** Each character body part and each scenery prop is merged into one
  vertex-coloured mesh; repeated props are GPU instances. Shadows, outlines and glow switch off
  in the fast graphics mode, which is chosen automatically on weaker devices and if the frame
  rate stays below ~38 fps.
- **Physics on a fixed 120 Hz step**, independent of frame rate, with coyote time, jump
  buffering, variable jump height, one-way platforms, moving platforms and bounce pads.
- **Lazy stages.** `levels/registry.ts` lists all 15 stages; only those with a `load()` are
  playable, and each loads as its own chunk.
- **No mid-stage saves.** Only completed-stage results are stored. Quitting, refreshing or
  closing mid-stage always restarts the stage from the beginning, and the Quit dialog says so.
- **Child safety.** No ads, purchases, chat, accounts or personal data. Storage holds only
  settings and progress.

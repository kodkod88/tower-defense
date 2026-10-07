# MVP Backlog

The durable task list. The lead loads it into the team's shared task list and keeps the status here current, since teammates aren't restored on `/resume`.

Status: `[ ]` todo · `[~]` in progress · `[x]` done. Each task is one self-contained deliverable plus its tests.

## architect: `src/core/`

- [x] **C1** Define MVP types in `types.ts`: Enemy, Tower, Projectile, MapDef, WaveDef, and a PlayerIntent union. Log them in DECISIONS.md. _deps: none_
- [x] **C2** Seeded RNG utility (`core/rng.ts`) with tests proving determinism. _deps: none_
- [x] **C3** Event bus (`core/events.ts`), typed and synchronous, with tests. _deps: C1_
- [x] **C4** `step()` pipeline: run systems in a fixed order (waves → movement → targeting → projectiles → economy → win/lose). _deps: C1, G1–G6 stubs_
- [x] **C5** Intent API: `applyIntent(state, intent)` for place tower and start wave, with validation. _deps: C1, G6_
- [x] **C6** Wire `main.ts` to load data, apply UI intents, and run the loop. _deps: C4, C5, R1_

## gameplay-dev: `src/entities/`, `src/systems/`

- [x] **G1** Enemy factory and movement along path waypoints (`systems/movement.ts`). _deps: C1_
- [x] **G2** Tower factory and targeting: nearest enemy in range, with a cooldown (`systems/targeting.ts`). _deps: C1_
- [x] **G3** Projectiles: travel, hit, damage, enemy death (`systems/projectiles.ts`). _deps: G1, G2_
- [x] **G4** Wave spawner: spawns enemies from a WaveDef over time (`systems/waves.ts`). _deps: C1, C2_
- [x] **G5** Leak handling and win/lose: an enemy reaching the end costs lives; 0 lives means lost; all waves cleared means won. _deps: G1, G4_
- [x] **G6** Economy: kill bounty, tower cost check, placement validity (not on the path, not overlapping) (`systems/economy.ts`). _deps: C1_

## render-ui-dev: `src/render/`, `src/ui/`

- [x] **R1** Render the map: grass, path, and placement grid. _deps: C1, D3_
- [x] **R2** Render enemies (with health bars), towers, and projectiles. _deps: G1–G3_
- [x] **R3** HUD: money, lives, wave number, and a "Start wave" button. _deps: C1_
- [x] **R4** Input: tower selection and click-to-place with a valid/invalid preview. Emits PlayerIntent. _deps: C5, G6_
- [x] **R5** Win and lose overlays with restart. _deps: G5_

## content-designer: `src/data/`

- [x] **D1** Two enemy types (fast-weak and slow-tanky): hp, speed, bounty. _deps: C1_
- [x] **D2** Two tower types (rapid and heavy): cost, range, damage, fire rate. _deps: C1_
- [x] **D3** One map: size, grid, and path waypoints. _deps: C1_
- [x] **D4** Five waves with a rising difficulty curve, plus a data-validation test. _deps: D1, C1_
- [x] **D5** Balance pass: a headless test simulating waves with a scripted tower layout, so the game is winnable but not trivial. _deps: G1–G6, D1–D4_

## qa-reviewer: `tests/` (cross-module)

- [x] **Q1** Determinism test: the same seed and intents produce an identical final state. _deps: C2, C4_
- [x] **Q2** Integration test: a full game simulated headless to a win and to a loss. _deps: C4, G5, D4_
- [x] **Q3** Review each completed area against CLAUDE.md rules and report issues to the owner. _ongoing_
- [x] **Q4** Edge cases: placing with no money, placing on the path, overlapping towers, two towers killing one enemy in the same tick. _deps: G3, G6_
- [x] **Q5** Final MVP review and a playtest checklist. _deps: all_

# UI polish (post-MVP)

Visual upgrade across the map, sprites, HUD, feedback effects, and theme. Game logic is unchanged: render/ui stay read-only on `GameState`, and every effect lives in UI-side state.

## render-ui-dev: `src/render/`, `src/ui/`, `index.html`

- [x] **U1** Theme: one palette and type scale shared by canvas drawing and the DOM (CSS custom properties in `index.html` plus a `render/theme.ts` mirror). _deps: none_
- [x] **U2** Map art: textured grass, a path with edges and a border, and clear spawn and exit markers. Static layers are pre-rendered once to an offscreen canvas. _deps: U1_
- [x] **U3** Sprites: distinct tower designs per type (rapid vs heavy), enemy designs per type (runner vs tank), and projectiles that match their tower. _deps: U1_
- [x] **U4** HUD and toolbar: icons for money, lives and wave; tower cards showing cost, range, damage and fire rate; a styled win/lose overlay. _deps: U1_
- [x] **U5** Feedback effects driven by the runner's event bus: hit flash, death puff, floating `+$bounty`, muzzle flash, and a lives-lost flash. _deps: U3, C7_

## architect: `src/main.ts`

- [x] **C7** Pass `runner.bus` to `mountUI` (one line in `main.ts`) once U5 adds the optional `events` dependency. _deps: render's `UIDeps.events`_

## qa-reviewer

- [x] **Q6** Review U1–U5 and C7: state is never mutated, the frame budget holds in wave 5, the browser playtest still passes, and screenshots look right. _deps: U1–U5, C7_

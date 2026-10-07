# Decisions

Architecture and shared-type decisions, newest first. Maintained by the architect (`core`).

Format: `## YYYY-MM-DD: Title`, then **Context**, **Decision**, and **Impact** (which modules and owners are affected).

## 2026-10-07: UI subscribes read-only to runner.bus for effects (C7)

**Context:** render U5 added optional `UIDeps.events` so the UI can play hit, kill and leak effects from each step's events.
**Decision:** `main.ts` passes `events: runner.bus` to `mountUI` and calls `ui.frame(now)` with the rAF timestamp so effects age on frame time. The UI only subscribes to the bus; it never emits or mutates state. Effects are cosmetic and the simulation is unaffected (determinism unchanged).
**Impact:** render (effects now live in the browser); gameplay, content and qa are unaffected.

## 2026-10-07: Hardening after qa review of C1–C3

**Context:** qa approved C1–C3 with minor notes.
**Decision:**

- **Seeds:** `normalizeSeed(seed)` in `rng.ts` stores `Math.trunc(seed) >>> 0` and throws `RangeError` on NaN/Infinity. `createInitialState` stores the normalized seed, so seeds 1.9 and 1 give identical games and `-1` becomes `0xffffffff`.
- **RNG:** `nextInt` throws `RangeError` unless min and max are integers with min <= max. A test pins the first three outputs for seed 1, so any algorithm change breaks the test on purpose (it would invalidate recorded replays).
- **Event bus:** each `on`/`onAny` call creates its own subscription, so registering the same handler twice needs two unsubscribes. A throwing handler is caught and reported to `createEventBus({ onError })` (default `console.error`), and later handlers and events still run.
  **Impact:** none for callers using valid seeds and bounds; render/ui listeners get error isolation.

## 2026-10-07: Runner owns the fixed timestep, intent queue and event bus; main.ts is thin (C6)

**Context:** main.ts needs a frame loop, an intent queue for the UI and event dispatch, and that logic should be testable without a DOM.
**Decision:** `src/core/runner.ts` exports `createRunner(content, seed?)` with `getState()`, `dispatch(intent)` (queued until the next step), `update(elapsedMs)` (fixed 60 Hz steps, frame gap capped at `MAX_FRAME_MS` = 250, epsilon for float drift) and `bus` (receives each step's events right after that step). `main.ts` only does `createRunner(content from src/data)` → `mountUI(canvas, {content, getState, dispatch, canPlace})` → a requestAnimationFrame loop that calls `runner.update` and then `ui.frame()`. `canPlace` is not passed: mountUI defaults to gameplay's `canPlaceTower`, which keeps the rejection reason for the hover label (an earlier boolean adapter in main.ts was removed).
**Impact:** render (mountUI is called with exactly these deps; subscribe to effects through `runner.bus` if needed, and ask core to pass it in), content (`content` from `src/data/index.ts` is what ships), qa (playtest via `npm run dev`).

## 2026-10-07: step() takes intents; applyIntent delegates to gameplay checks (C4, C5)

**Context:** The UI's intents and the systems must both run inside one deterministic step, so that replays and Q1 work.
**Decision:**

- `step(state, content, intents = [], systems = SYSTEMS)`, in this order: clear events → apply intents in order → `tick + 1` → run `SYSTEMS` (only while `status === 'playing'`). `SYSTEMS` = waves → movement (which calls gameplay's `resolveLeaks`) → targeting → projectiles → economy → winLose. Intent events land in the same step's `events`. A replay is `(initial state, intents keyed by tick)`. The 4th argument lets tests inject systems. (A temporary overload `step(state, content, systems)` was removed once gameplay's pipeline test migrated.) **Intents run before the status check on purpose:** a `startWave` intent sets `status: 'playing'`, so the systems run in that same tick and the wave's first spawn happens on the tick the player pressed Start. Placement during 'ready' also takes effect immediately.
- `src/core/intents.ts`: `applyIntent(state, intent, content)` and `applyIntents(state, intents, content)`. `placeTower` uses gameplay's `canPlaceTower`/`placeTower`; `startWave` uses `canStartWave`/`startWave`. A failed check returns the unchanged state plus an `intentRejected {intent, reason}` event. `placeTower` is rejected with `'gameOver'` by core itself when status is 'won' or 'lost', before the placement check runs (qa bug: towers could be bought after the game ended). `restart` returns `createInitialState(content, state.seed)`: a full reset (status 'ready', wave `{index -1, active false}`, no entities, starting money and lives, rng re-seeded, nextId 1). Status is 'ready', so no systems run that tick, and the only difference from a fresh game is `tick: 1`. Intents queued after a restart in the same tick apply to the new game.
- `core/loop.ts` and `core/intents.ts` import from `src/systems` (core → systems at runtime; systems import only core types, rng and grid, so there's no cycle).
  **Impact:** main.ts (C6) queues UI intents and passes them to the next `step`; render's `UIDeps.dispatch` should push to that queue; qa (Q1 and Q2 can script intents per tick); gameplay (their check and apply functions are now on the intent path, so keep their signatures stable).

## 2026-10-07: C1 final: settled naming conflicts, placement result, grid helpers (C1 frozen)

**Context:** gameplay and content sent C1 requirements that conflicted with each other and with the draft; qa reviewed the draft.
**Decision:**

- **System signature is `(state, content) => state`**, not `(state, dtMs)`. The step is fixed (`DT_SECONDS` = 1/60), so systems use the constants in `types.ts` instead of a dt argument. Systems read stats and the map from `content` (`content.enemies[type]`, `content.towers[type]`, `content.map`); defs are **not** copied into state, except the per-instance fields on `Enemy` (`maxHp`, `speed`).
- **Placement:** `canPlaceTower(state, content, towerType, cell: GridCell) => PlacementResult` where `PlacementResult = {ok:true} | {ok:false, reason: PlacementRejectReason}` and the reasons are `'unknownTowerType' | 'insufficientFunds' | 'outOfBounds' | 'onPath' | 'overlap'` (camelCase, matching event names). Placement is by **grid cell**, not by free position; the tower's `pos` is `cellCenter(cell, tileSize)`. `IntentRejectReason` = the placement reasons plus `'waveInProgress' | 'noMoreWaves' | 'gameOver'` (`'invalidPlacement'` removed; nobody used it).
- **Path coordinates:** `MapDef.path` stays in **world pixels** (gameplay's distance math needs it). Content may author waypoints in tiles and convert them with `tilePathToWorld(tiles, tileSize)` from the new `src/core/grid.ts`, which maps each tile to its cell center. `grid.ts` also exports `cellCenter`, `worldToCell` and `isInBounds`. `pathWidth` is required.
- **Field names stay as drafted** (render and qa already use them): `EnemyDef.maxHp` (not hp), `livesCost` (not leakDamage), and `name` and `radius` are required. `TowerDef.projectileSpeed` is required. `SpawnGroup {enemy, count, interval, delay}` is in **seconds** (not ms, so `delay: 0` is explicit). `GameContent.startingMoney` / `startingLives` are required. Ids are plain `string` (`EnemyTypeId`, `TowerTypeId`), keyed in `Record`s, so 'runner', 'tank', 'rapid' and 'heavy' all work.
- **Wave indexing:** `wave.index` and the `waveStarted`/`waveCleared` `waveIndex` are both **0-based** (-1 before the first wave). UI shows `index + 1`.
- **C1 is frozen.** Any further shared-type change goes to the lead first, with the affected owners listed.
  **Impact:** gameplay (signature, `canPlaceTower` arguments and reasons), content (field names, seconds, `tilePathToWorld`), render (no change), qa (no change).

## 2026-10-07: Event bus is a UI-side dispatcher over GameState.events (C3)

**Context:** UI/effects want to react to kills, leaks, and rejections without diffing state, but the simulation must stay pure.
**Decision:** `src/core/events.ts` exports `createEventBus()` with `on(type, handler)` (payload narrowed by type), `onAny`, `emit`, `emitAll`, and `clear`; each subscription returns an unsubscribe function. Dispatch is synchronous in subscription order, typed handlers first. Systems never call the bus: they append to `GameState.events`, and `main.ts` runs `bus.emitAll(state.events)` after each step.
**Impact:** render/ui (subscribe via the bus that main.ts creates); gameplay is unaffected.

## 2026-10-07: Seeded RNG is a pure uint32 in GameState (C2)

**Context:** Simulation must be deterministic; `Math.random` is banned in logic.
**Decision:** `src/core/rng.ts` implements mulberry32 as pure functions over a uint32 state: `seedRng(seed)`, `nextFloat(rng) => [value, nextRng]`, `nextInt(rng, min, max)`, and `randomFloat(state) => [value, newState]`. The state lives in `GameState.rng`; the original seed in `GameState.seed` (for restart).
**Impact:** gameplay (G4 or any randomness must thread `state.rng` through these), qa (Q1).

## 2026-10-07: MVP shared types (C1)

**Context:** Every teammate is blocked on a common data model; it should not need to change later.
**Decision:**

- **Units:** world pixels, origin top-left. Content (`src/data`) uses seconds and px/second; runtime timers are integer ticks. `TICKS_PER_SECOND = 60`, `FIXED_DT_MS`, `DT_SECONDS`.
- **Content:** `EnemyDef` (maxHp, speed, bounty, livesCost, radius, color?), `TowerDef` (cost, range, damage, fireRate shots/s, projectileSpeed, color?), `MapDef` (cols, rows, tileSize, `path: Vec2[]` waypoints in world px, pathWidth), `WaveDef` (`groups: SpawnGroup[]` run in parallel, each `{enemy, count, interval, delay}`; optional `reward`). Bundle: `GameContent { enemies: Record<id, EnemyDef>, towers: Record<id, TowerDef>, map, waves, startingMoney, startingLives }`. `src/data` should export one `GameContent`.
- **Runtime:** `Enemy` (id, type, pos, hp, maxHp, speed, waypointIndex, distance), `Tower` (id, type, cell, pos = cell center, cooldownTicks, targetId), `Projectile` (homing: id, towerId, targetId, pos, damage, speed). Ids come from `GameState.nextId` and are never reused.
- **GameState:** plain serializable data: status (`ready|playing|won|lost`), tick, money, lives, `wave: WaveState {index (-1 before first), active, elapsedTicks, spawned[] per group}`, enemies, towers, projectiles, seed, rng, nextId, `events: GameEvent[]`.
- **Events:** `GameEvent` union records what happened in the latest step (waveStarted/Cleared, enemySpawned/Killed/Leaked, towerPlaced, projectileFired/Hit, intentRejected, gameWon/Lost). `step` clears it at the start. Systems communicate through it, e.g. projectiles emits `enemyKilled` with bounty and economy pays it; movement emits `enemyLeaked` and win/lose deducts lives. The C3 event bus dispatches these to UI listeners.
- **Intents:** `PlayerIntent = placeTower {towerType, cell: GridCell} | startWave | restart`. Rejections are reported as `intentRejected` events with an `IntentRejectReason`.
- **Systems:** `type System = (state: GameState, content: GameContent) => GameState`, pure, never mutating input. `step(state, content)` now takes content; `createInitialState(content, seed?)`.
- `createInitialState(content, seed?)`: content is **required** (qa review: a silent empty fallback could produce an instant win or hang). Tests use the fixture below.
- Test fixture `tests/core/fixtures.ts` exports `makeTestContent(overrides?)` for anyone's tests.
  **Impact:** all owners. HUD: wave number = `wave.index + 1`, in progress = `wave.active`, total = `content.waves.length`.

// Shared types. Owned by the architect: changes go through `core` and are logged in docs/DECISIONS.md.
//
// Units used everywhere:
// - Distances and positions are world pixels. (0,0) is the top-left of the map; +y points down.
// - Content definitions (src/data) express time in SECONDS and speed in PIXELS PER SECOND.
// - Runtime state expresses time as integer TICKS (see TICKS_PER_SECOND) so it stays exact.
// - All state is plain serializable data (no classes, functions, Maps, or Sets) so it can be
//   deep-compared in determinism tests and structured-cloned.

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------

/** Simulation updates per second. */
export const TICKS_PER_SECOND = 60;
/** Fixed simulation step in milliseconds (60 updates per second). */
export const FIXED_DT_MS = 1000 / TICKS_PER_SECOND;
/** Fixed simulation step in seconds. Multiply per-second rates by this each tick. */
export const DT_SECONDS = 1 / TICKS_PER_SECOND;

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

export interface Vec2 {
  x: number;
  y: number;
}

/** A cell on the placement grid. col = floor(x / tileSize), row = floor(y / tileSize). */
export interface GridCell {
  col: number;
  row: number;
}

// ---------------------------------------------------------------------------
// Content definitions (authored in src/data, read-only at runtime)
// ---------------------------------------------------------------------------

/** Key into GameContent.enemies, e.g. 'runner'. */
export type EnemyTypeId = string;
/** Key into GameContent.towers, e.g. 'rapid'. */
export type TowerTypeId = string;

export interface EnemyDef {
  id: EnemyTypeId;
  name: string;
  maxHp: number;
  /** Pixels per second along the path. */
  speed: number;
  /** Money awarded when killed. */
  bounty: number;
  /** Lives lost when this enemy reaches the end of the path. */
  livesCost: number;
  /** Collision/draw radius in pixels. */
  radius: number;
  /** Optional CSS color hint for the renderer. */
  color?: string;
}

export interface TowerDef {
  id: TowerTypeId;
  name: string;
  cost: number;
  /** Targeting range in pixels, measured from the tower center. */
  range: number;
  /** Damage per projectile hit. */
  damage: number;
  /** Shots per second. */
  fireRate: number;
  /** Projectile speed in pixels per second. */
  projectileSpeed: number;
  /** Optional CSS color hint for the renderer. */
  color?: string;
}

export interface MapDef {
  id: string;
  name: string;
  /** Grid dimensions. World size is cols * tileSize by rows * tileSize pixels. */
  cols: number;
  rows: number;
  /** Size of one square grid cell in pixels. */
  tileSize: number;
  /**
   * Path waypoints in world pixels, from spawn (first) to exit (last). Enemies walk straight
   * segments between consecutive waypoints. Must have at least 2 points.
   */
  path: Vec2[];
  /** Visual and blocking width of the path in pixels. Cells the path overlaps are not buildable. */
  pathWidth: number;
}

/** A batch of identical enemies inside a wave. */
export interface SpawnGroup {
  enemy: EnemyTypeId;
  count: number;
  /** Seconds between consecutive spawns in this group. */
  interval: number;
  /** Seconds after the wave starts before this group's first spawn. */
  delay: number;
}

export interface WaveDef {
  /** Groups run in parallel, each on its own delay/interval timeline. */
  groups: SpawnGroup[];
  /** Money awarded when the wave is cleared (all spawned and none alive). Default 0. */
  reward?: number;
}

/** Everything src/data exports as one bundle. */
export interface GameContent {
  enemies: Record<EnemyTypeId, EnemyDef>;
  towers: Record<TowerTypeId, TowerDef>;
  map: MapDef;
  /** Played in order. Winning = clearing the last one. */
  waves: WaveDef[];
  startingMoney: number;
  startingLives: number;
}

// ---------------------------------------------------------------------------
// Runtime entities
// ---------------------------------------------------------------------------

/** Unique per game, allocated from GameState.nextId. Never reused. */
export type EntityId = number;

export interface Enemy {
  id: EntityId;
  type: EnemyTypeId;
  pos: Vec2;
  hp: number;
  maxHp: number;
  /** Pixels per second (copied from the def so future slow effects can modify it). */
  speed: number;
  /** Index into MapDef.path of the waypoint the enemy is currently walking toward. */
  waypointIndex: number;
  /** Total distance walked along the path in pixels. Higher = closer to the exit. */
  distance: number;
}

export interface Tower {
  id: EntityId;
  type: TowerTypeId;
  cell: GridCell;
  /** Center of the cell in world pixels. */
  pos: Vec2;
  /** Ticks until the tower may fire again. 0 = ready. */
  cooldownTicks: number;
  /** Enemy currently targeted, if any. */
  targetId: EntityId | null;
}

/** Homing projectile: flies toward its target's current position each tick. */
export interface Projectile {
  id: EntityId;
  towerId: EntityId;
  targetId: EntityId;
  pos: Vec2;
  damage: number;
  /** Pixels per second. */
  speed: number;
}

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------

/**
 * ready   - before the first wave is started (player may build).
 * playing - at least one wave started; between waves the status stays 'playing'.
 * won     - last wave cleared with lives > 0.
 * lost    - lives reached 0.
 */
export type GameStatus = 'ready' | 'playing' | 'won' | 'lost';

export interface WaveState {
  /** Index into GameContent.waves of the current (or most recent) wave. -1 before the first. */
  index: number;
  /** True while the current wave still has enemies to spawn or alive on the map. */
  active: boolean;
  /** Ticks since the current wave started. */
  elapsedTicks: number;
  /** Enemies spawned so far, per group of the current wave (same order as WaveDef.groups). */
  spawned: number[];
}

/** Why a tower can't go on a cell. Returned by gameplay's canPlaceTower. */
export type PlacementRejectReason =
  'unknownTowerType' | 'insufficientFunds' | 'outOfBounds' | 'onPath' | 'overlap';

export type PlacementResult = { ok: true } | { ok: false; reason: PlacementRejectReason };

export type IntentRejectReason =
  PlacementRejectReason | 'waveInProgress' | 'noMoreWaves' | 'gameOver';

/**
 * Things that happened during the most recent step. Cleared at the start of every step.
 * `waveIndex` is 0-based, the same as WaveState.index (show `waveIndex + 1` to players).
 */
export type GameEvent =
  | { type: 'waveStarted'; waveIndex: number }
  | { type: 'waveCleared'; waveIndex: number; reward: number }
  | { type: 'enemySpawned'; enemyId: EntityId; enemyType: EnemyTypeId }
  | { type: 'enemyKilled'; enemyId: EntityId; enemyType: EnemyTypeId; bounty: number }
  | { type: 'enemyLeaked'; enemyId: EntityId; enemyType: EnemyTypeId; livesCost: number }
  | { type: 'towerPlaced'; towerId: EntityId; towerType: TowerTypeId; cell: GridCell; cost: number }
  | { type: 'projectileFired'; projectileId: EntityId; towerId: EntityId; targetId: EntityId }
  | { type: 'projectileHit'; projectileId: EntityId; targetId: EntityId; damage: number }
  | { type: 'intentRejected'; intent: PlayerIntent; reason: IntentRejectReason }
  | { type: 'gameWon' }
  | { type: 'gameLost' };

export type GameEventType = GameEvent['type'];

export interface GameState {
  status: GameStatus;
  /** Simulation ticks elapsed since the game was created. */
  tick: number;
  money: number;
  lives: number;
  wave: WaveState;
  enemies: Enemy[];
  towers: Tower[];
  projectiles: Projectile[];
  /** Seed the game was created with (used by 'restart'). */
  seed: number;
  /** Current seeded RNG state (uint32). Only advance it via src/core/rng.ts. */
  rng: number;
  /** Next EntityId to hand out. Increment after each allocation. */
  nextId: EntityId;
  /** Events produced during the most recent step (including intents applied in it). */
  events: GameEvent[];
}

// ---------------------------------------------------------------------------
// Player intents and systems
// ---------------------------------------------------------------------------

/** Player actions sent by src/ui to the core API. Applied at the start of a step. */
export type PlayerIntent =
  | { type: 'placeTower'; towerType: TowerTypeId; cell: GridCell }
  | { type: 'startWave' }
  | { type: 'restart' };

/**
 * A simulation system: pure function from state to a NEW state for one tick.
 * Must not mutate its input. Emit events by returning `events: [...state.events, e]`.
 */
export type System = (state: GameState, content: GameContent) => GameState;

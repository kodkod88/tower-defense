// Shared helpers for QA integration and edge-case tests (owned by qa).
import { step } from '../../src/core/loop';
import { createInitialState } from '../../src/core/state';
import type {
  GameContent,
  GameEvent,
  GameState,
  GridCell,
  PlayerIntent,
  TowerTypeId,
} from '../../src/core/types';
import { TICKS_PER_SECOND } from '../../src/core/types';
import { canPlaceTower, isCellOnPath } from '../../src/systems';
import { distanceToPath } from '../../src/systems/geometry';
import { cellCenter } from '../../src/core/grid';

export function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    for (const v of Object.values(obj)) deepFreeze(v);
  }
  return obj;
}

export function eventsOf<T extends GameEvent['type']>(
  state: GameState,
  type: T,
): Extract<GameEvent, { type: T }>[] {
  return state.events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
}

/** Intents to send on specific ticks (keyed by the tick number of the state they're applied to). */
export type Script = Record<number, PlayerIntent[]>;

export interface RunResult {
  final: GameState;
  /** Every state, index 0 = initial. Only kept when `keepHistory` is set. */
  history: GameState[];
  /** Every event from every step, in order. */
  events: GameEvent[];
}

/** Run until `maxTicks` or the game ends (plus `extraTicks` afterwards). Intents come from `script`. */
export function run(
  content: GameContent,
  opts: {
    seed?: number;
    script?: Script;
    maxTicks: number;
    keepHistory?: boolean;
    /** Called after every step; use it to assert invariants. */
    onStep?: (prev: GameState, next: GameState) => void;
    /** Return intents to send this tick (in addition to `script`). */
    policy?: (state: GameState) => PlayerIntent[];
  },
): RunResult {
  let state = createInitialState(content, opts.seed ?? 1);
  const history = opts.keepHistory ? [state] : [];
  const events: GameEvent[] = [];
  for (let i = 0; i < opts.maxTicks; i++) {
    const intents = [...(opts.script?.[state.tick] ?? []), ...(opts.policy?.(state) ?? [])];
    const next = step(state, content, intents);
    opts.onStep?.(state, next);
    events.push(...next.events);
    if (opts.keepHistory) history.push(next);
    state = next;
    if (state.status === 'won' || state.status === 'lost') break;
  }
  return { final: state, history, events };
}

/** Policy: start the next wave whenever none is active (and the game is not over). */
export function autoStartWaves(content: GameContent): (s: GameState) => PlayerIntent[] {
  return (s) =>
    (s.status === 'ready' || s.status === 'playing') &&
    !s.wave.active &&
    s.wave.index + 1 < content.waves.length
      ? [{ type: 'startWave' }]
      : [];
}

/** Buildable cells (off-path, in bounds) whose centre is within `maxDist` px of the path, nearest first. */
export function cellsNearPath(content: GameContent, maxDist: number): GridCell[] {
  const { map } = content;
  const cells: { cell: GridCell; d: number }[] = [];
  for (let row = 0; row < map.rows; row++) {
    for (let col = 0; col < map.cols; col++) {
      const cell = { col, row };
      if (isCellOnPath(map, cell)) continue;
      const d = distanceToPath(cellCenter(cell, map.tileSize), map.path);
      if (d <= maxDist) cells.push({ cell, d });
    }
  }
  return cells
    .sort((a, b) => a.d - b.d || a.cell.row - b.cell.row || a.cell.col - b.cell.col)
    .map((c) => c.cell);
}

/** placeTower intents for every cell, alternating tower types, skipping cells canPlaceTower rejects. */
export function buildIntents(
  state: GameState,
  content: GameContent,
  cells: readonly GridCell[],
  types: readonly TowerTypeId[],
): PlayerIntent[] {
  return cells
    .map((cell, i): PlayerIntent & { type: 'placeTower' } => ({
      type: 'placeTower',
      towerType: types[i % types.length]!,
      cell,
    }))
    .filter((it) => canPlaceTower(state, content, it.towerType, it.cell).ok);
}

export const SECONDS = (s: number) => Math.round(s * TICKS_PER_SECOND);

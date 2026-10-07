import {
  economySystem,
  movementSystem,
  projectilesSystem,
  targetingSystem,
  wavesSystem,
  winLoseSystem,
} from '../systems';
import { applyIntents } from './intents';
import type { GameContent, GameState, PlayerIntent, System } from './types';

/**
 * The systems step() runs each tick, in this fixed order:
 * waves → movement (includes leaks) → targeting → projectiles → economy → winLose.
 */
export const SYSTEMS: readonly System[] = [
  wavesSystem,
  movementSystem,
  targetingSystem,
  projectilesSystem,
  economySystem,
  winLoseSystem,
];

/** Run systems left to right, feeding each one's output into the next. */
export function runSystems(
  state: GameState,
  content: GameContent,
  systems: readonly System[],
): GameState {
  return systems.reduce((s, system) => system(s, content), state);
}

/**
 * Advance the simulation by one fixed step. Pure and deterministic: no DOM, no clocks, no Math.random.
 * Order: clear last step's events → apply this tick's intents → tick + 1 → run systems (only while
 * 'playing'). Intent events (towerPlaced, waveStarted, intentRejected) end up in this step's events.
 * Replays are exact: the same initial state plus the same intents on the same ticks give the same states.
 */
export function step(
  state: GameState,
  content: GameContent,
  intents: readonly PlayerIntent[] = [],
  systems: readonly System[] = SYSTEMS,
): GameState {
  const applied = applyIntents({ ...state, events: [] }, intents, content);
  const next: GameState = { ...applied, tick: applied.tick + 1 };
  return next.status === 'playing' ? runSystems(next, content, systems) : next;
}

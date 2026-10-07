// Drives the pure simulation at a fixed timestep. Holds the only mutable game handle: the current
// state, the queue of pending player intents, and the event bus. No DOM or clocks: the caller
// passes elapsed milliseconds (main.ts uses requestAnimationFrame timestamps).
import { createEventBus, type EventBus } from './events';
import { step } from './loop';
import { createInitialState } from './state';
import { FIXED_DT_MS, type GameContent, type GameState, type PlayerIntent } from './types';

/** Longest frame gap simulated at once (avoids a catch-up spiral after a background tab). */
export const MAX_FRAME_MS = 250;
/** Tolerance so float drift (e.g. two half-steps) doesn't drop a step. */
const EPSILON_MS = 1e-6;

export interface Runner {
  readonly content: GameContent;
  /** Bus that receives every step's GameState.events, in order, right after that step. */
  readonly bus: EventBus;
  getState(): Readonly<GameState>;
  /** Queue an intent; it is applied at the start of the next step. */
  dispatch(intent: PlayerIntent): void;
  /** Advance by elapsed real time; runs 0..n fixed steps. Returns the number of steps run. */
  update(elapsedMs: number): number;
}

export function createRunner(content: GameContent, seed?: number): Runner {
  const bus = createEventBus();
  let state = createInitialState(content, seed);
  let queue: PlayerIntent[] = [];
  let acc = 0;

  return {
    content,
    bus,
    getState: () => state,
    dispatch(intent) {
      queue = [...queue, intent];
    },
    update(elapsedMs) {
      acc += Math.min(Math.max(0, elapsedMs), MAX_FRAME_MS);
      let steps = 0;
      while (acc >= FIXED_DT_MS - EPSILON_MS) {
        const intents = queue;
        queue = [];
        state = step(state, content, intents);
        bus.emitAll(state.events);
        acc = Math.max(0, acc - FIXED_DT_MS);
        steps++;
      }
      return steps;
    },
  };
}

import type { GameEvent, GameState } from '../core/types';

/** Return a new state with `events` appended to this step's events. */
export function withEvents(state: GameState, events: readonly GameEvent[]): GameState {
  if (events.length === 0) return state;
  return { ...state, events: [...state.events, ...events] };
}

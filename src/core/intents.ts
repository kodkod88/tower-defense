// C5: the player intent API. Validates each intent with gameplay's checks and either applies it or
// records an intentRejected event. Pure and deterministic.
import { canPlaceTower, canStartWave, placeTower, startWave } from '../systems';
import { createInitialState } from './state';
import type { GameContent, GameState, IntentRejectReason, PlayerIntent } from './types';

function reject(state: GameState, intent: PlayerIntent, reason: IntentRejectReason): GameState {
  return { ...state, events: [...state.events, { type: 'intentRejected', intent, reason }] };
}

/** Apply one intent. Invalid intents leave the state unchanged except for an intentRejected event. */
export function applyIntent(
  state: GameState,
  intent: PlayerIntent,
  content: GameContent,
): GameState {
  switch (intent.type) {
    case 'placeTower': {
      // Core owns this rule: no building once the game is over, whatever the placement check says.
      if (state.status === 'won' || state.status === 'lost')
        return reject(state, intent, 'gameOver');
      const check = canPlaceTower(state, content, intent.towerType, intent.cell);
      if (!check.ok) return reject(state, intent, check.reason);
      return placeTower(state, content, intent.towerType, intent.cell);
    }
    case 'startWave': {
      const check = canStartWave(state, content);
      if (!check.ok) return reject(state, intent, check.reason);
      return startWave(state, content);
    }
    case 'restart':
      // Same seed => the restarted game replays identically. Keep the restart's own events empty.
      return createInitialState(content, state.seed);
  }
}

/** Apply intents in order. */
export function applyIntents(
  state: GameState,
  intents: readonly PlayerIntent[],
  content: GameContent,
): GameState {
  return intents.reduce((s, intent) => applyIntent(s, intent, content), state);
}

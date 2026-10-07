// G5: leaks cost lives; 0 lives = lost; last wave cleared with lives left = won.
import type { GameContent, GameState } from '../core/types';
import { withEvents } from './events';

/**
 * 1. Subtract livesCost of this step's enemyLeaked events (floored at 0).
 * 2. lives === 0 → 'lost' + gameLost (takes priority over winning in the same step).
 * 3. Last wave no longer active and no enemies left → 'won' + gameWon.
 * Only acts while status is 'playing'.
 */
export function winLoseSystem(state: GameState, content: GameContent): GameState {
  if (state.status !== 'playing') return state;
  let leaked = 0;
  for (const e of state.events) if (e.type === 'enemyLeaked') leaked += e.livesCost;
  const lives = Math.max(0, state.lives - leaked);
  const next = lives === state.lives ? state : { ...state, lives };

  if (lives <= 0) {
    return withEvents({ ...next, status: 'lost', lives: 0 }, [{ type: 'gameLost' }]);
  }
  const lastWave = content.waves.length - 1;
  if (next.wave.index >= lastWave && !next.wave.active && next.enemies.length === 0) {
    return withEvents({ ...next, status: 'won' }, [{ type: 'gameWon' }]);
  }
  return next;
}

import type { GameContent, GameState } from './types';
import { normalizeSeed, seedRng } from './rng';

/** Default seed when none is given. Any uint32 works. */
export const DEFAULT_SEED = 1;

/** Fresh game state for the given content. Pure: same content + seed => same state. */
export function createInitialState(content: GameContent, seed: number = DEFAULT_SEED): GameState {
  const s = normalizeSeed(seed);
  return {
    status: 'ready',
    tick: 0,
    money: content.startingMoney,
    lives: content.startingLives,
    wave: { index: -1, active: false, elapsedTicks: 0, spawned: [] },
    enemies: [],
    towers: [],
    projectiles: [],
    seed: s,
    rng: seedRng(s),
    nextId: 1,
    events: [],
  };
}

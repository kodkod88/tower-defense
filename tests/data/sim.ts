// Headless balance harness for tests/data. Drives the real step() with scripted intents only.
import { step } from '../../src/core/loop';
import { createInitialState } from '../../src/core/state';
import type {
  GameContent,
  GameState,
  GridCell,
  PlayerIntent,
  TowerTypeId,
} from '../../src/core/types';
import { TICKS_PER_SECOND } from '../../src/core/types';

export interface BuildOrder {
  tower: TowerTypeId;
  cell: GridCell;
}

export interface SimResult {
  status: GameState['status'];
  /** Index of the last wave started (0-based). */
  waveIndex: number;
  lives: number;
  money: number;
  towersBuilt: number;
  /** Lives remaining after each wave that finished. */
  livesAfterWave: number[];
}

/** Safety cap per wave so a broken system can't hang the test. */
const MAX_TICKS_PER_WAVE = 10 * 60 * TICKS_PER_SECOND;

/**
 * Plays the whole game: before each wave, place as many towers from `plan` (in order) as money
 * allows, then start the wave and run until it clears or the game ends.
 */
export function simulate(content: GameContent, plan: readonly BuildOrder[], seed = 1): SimResult {
  let state = createInitialState(content, seed);
  let next = 0;
  const livesAfterWave: number[] = [];

  while (state.status === 'ready' || state.status === 'playing') {
    const intents: PlayerIntent[] = [];
    let budget = state.money;
    while (next < plan.length) {
      const order = plan[next]!;
      const cost = content.towers[order.tower]!.cost;
      if (cost > budget) break;
      budget -= cost;
      intents.push({ type: 'placeTower', towerType: order.tower, cell: order.cell });
      next++;
    }
    intents.push({ type: 'startWave' });
    state = step(state, content, intents);
    const rejected = state.events.filter((e) => e.type === 'intentRejected');
    if (rejected.length > 0) throw new Error(`intent rejected: ${JSON.stringify(rejected)}`);

    let ticks = 0;
    while (state.status === 'playing' && state.wave.active) {
      state = step(state, content);
      if (++ticks > MAX_TICKS_PER_WAVE) throw new Error(`wave ${state.wave.index} never ended`);
    }
    livesAfterWave.push(state.lives);
  }

  return {
    status: state.status,
    waveIndex: state.wave.index,
    lives: state.lives,
    money: state.money,
    towersBuilt: state.towers.length,
    livesAfterWave,
  };
}

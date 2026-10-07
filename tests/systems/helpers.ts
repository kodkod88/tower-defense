// Small builders for gameplay tests.
import { createInitialState } from '../../src/core/state';
import type { Enemy, GameContent, GameState, Projectile, Tower } from '../../src/core/types';
import { createEnemy } from '../../src/entities/enemy';
import { createTower } from '../../src/entities/tower';
import { makeTestContent } from '../core/fixtures';

export { makeTestContent };

export function playing(content: GameContent, patch: Partial<GameState> = {}): GameState {
  return { ...createInitialState(content, 1), status: 'playing', nextId: 100, ...patch };
}

export function enemy(
  content: GameContent,
  id: number,
  patch: Partial<Enemy> = {},
  type = 'runner',
): Enemy {
  return { ...createEnemy(content, type, id), ...patch };
}

export function tower(
  content: GameContent,
  id: number,
  col: number,
  row: number,
  type = 'rapid',
  patch: Partial<Tower> = {},
): Tower {
  return { ...createTower(content, type, { col, row }, id), ...patch };
}

export function projectile(patch: Partial<Projectile> & Pick<Projectile, 'targetId'>): Projectile {
  return { id: 50, towerId: 1, pos: { x: 0, y: 0 }, damage: 1, speed: 600, ...patch };
}

/** Run `fn` n times, feeding output into input. */
export function repeat(state: GameState, n: number, fn: (s: GameState) => GameState): GameState {
  let s = state;
  for (let i = 0; i < n; i++) s = fn(s);
  return s;
}

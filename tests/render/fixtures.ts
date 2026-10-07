// Thin helpers over core's shared fixtures so render/UI tests use the real state factory.
import { createInitialState } from '../../src/core/state';
import type { GameContent, GameState } from '../../src/core/types';
import { makeTestContent } from '../core/fixtures';

export const makeContent = (overrides: Partial<GameContent> = {}): GameContent =>
  makeTestContent(overrides);

/** createInitialState(makeTestContent()) with field overrides. */
export function makeState(overrides: Partial<GameState> = {}): GameState {
  return { ...createInitialState(makeTestContent()), ...overrides };
}

/** Recursively freeze an object graph so any mutation by render/UI code throws in strict mode. */
export function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

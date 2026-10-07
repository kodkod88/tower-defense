import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../src/core/state';
import { makeTestContent } from './fixtures';

describe('createInitialState', () => {
  it('takes money and lives from content and starts before the first wave', () => {
    const s = createInitialState(makeTestContent({ startingMoney: 77, startingLives: 3 }), 42);
    expect(s.status).toBe('ready');
    expect(s.money).toBe(77);
    expect(s.lives).toBe(3);
    expect(s.wave.index).toBe(-1);
    expect(s.wave.active).toBe(false);
    expect(s.seed).toBe(42);
    expect(s.enemies).toEqual([]);
  });

  it('is deterministic and JSON-serializable', () => {
    const c = makeTestContent();
    const a = createInitialState(c, 7);
    expect(createInitialState(c, 7)).toEqual(a);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
  });

  it('stores a normalized uint32 seed and rejects non-finite seeds', () => {
    const c = makeTestContent();
    expect(createInitialState(c, 1.9)).toEqual(createInitialState(c, 1));
    expect(createInitialState(c, -1).seed).toBe(0xffffffff);
    expect(() => createInitialState(c, NaN)).toThrow(RangeError);
  });
});

import { describe, expect, it } from 'vitest';
import { nextFloat, nextInt, normalizeSeed, randomFloat, seedRng } from '../../src/core/rng';
import { createInitialState } from '../../src/core/state';
import { makeTestContent } from './fixtures';

/** First three nextFloat outputs for seed 1. Update only on a deliberate, logged algorithm change. */
const PINNED_SEED_1 = [0.18967728852294385, 0.31778763560578227, 0.7830808095168322];

function sequence(seed: number, n: number): number[] {
  let rng = seedRng(seed);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const [v, next] = nextFloat(rng);
    out.push(v);
    rng = next;
  }
  return out;
}

describe('rng', () => {
  it('produces the same sequence for the same seed', () => {
    expect(sequence(123, 100)).toEqual(sequence(123, 100));
  });

  it('produces different sequences for different seeds', () => {
    expect(sequence(1, 10)).not.toEqual(sequence(2, 10));
  });

  it('is pure: the same input state yields the same output', () => {
    const s = seedRng(99);
    expect(nextFloat(s)).toEqual(nextFloat(s));
  });

  it('stays in [0, 1) and keeps a uint32 state', () => {
    let rng = seedRng(5);
    for (let i = 0; i < 10_000; i++) {
      const [v, next] = nextFloat(rng);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      expect(Number.isInteger(next) && next >= 0 && next <= 0xffffffff).toBe(true);
      rng = next;
    }
  });

  it('nextInt covers an inclusive range', () => {
    let rng = seedRng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const [v, next] = nextInt(rng, 1, 3);
      seen.add(v);
      rng = next;
    }
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });

  it('randomFloat advances GameState.rng without mutating the input', () => {
    const s = createInitialState(makeTestContent(), 3);
    const [v, s2] = randomFloat(s);
    expect(v).toBe(nextFloat(s.rng)[0]);
    expect(s2.rng).not.toBe(s.rng);
    expect(s.rng).toBe(seedRng(3));
  });

  it('pins the first outputs for seed 1 (changing the algorithm breaks saved replays)', () => {
    expect(sequence(1, 3)).toEqual(PINNED_SEED_1);
  });

  it('nextInt rejects min > max and non-integer bounds', () => {
    expect(() => nextInt(seedRng(1), 5, 1)).toThrow(RangeError);
    expect(() => nextInt(seedRng(1), 0.5, 2)).toThrow(RangeError);
    expect(nextInt(seedRng(1), 4, 4)[0]).toBe(4);
  });

  it('normalizeSeed truncates and wraps to uint32, and rejects non-finite seeds', () => {
    expect(normalizeSeed(1.9)).toBe(1);
    expect(normalizeSeed(-1)).toBe(0xffffffff);
    expect(normalizeSeed(2 ** 32 + 5)).toBe(5);
    expect(() => normalizeSeed(NaN)).toThrow(RangeError);
    expect(() => normalizeSeed(Infinity)).toThrow(RangeError);
  });
});

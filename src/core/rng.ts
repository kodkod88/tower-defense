// Seeded, pure PRNG (mulberry32). State is a single uint32 stored in GameState.rng.
// Never use Math.random in simulation code; thread the state through these functions instead.
import type { GameState } from './types';

/** Canonical uint32 seed: truncates fractions and wraps into [0, 2^32). Throws on NaN/Infinity. */
export function normalizeSeed(seed: number): number {
  if (!Number.isFinite(seed)) throw new RangeError(`Seed must be a finite number, got ${seed}`);
  return Math.trunc(seed) >>> 0;
}

/** Initial RNG state for a seed (see normalizeSeed). */
export function seedRng(seed: number): number {
  return (normalizeSeed(seed) ^ 0x9e3779b9) >>> 0;
}

/** Next float in [0, 1) and the advanced RNG state. Pure. */
export function nextFloat(rng: number): [value: number, next: number] {
  const next = (rng + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, next];
}

/** Next integer in [min, max] (inclusive) and the advanced RNG state. Pure. */
export function nextInt(rng: number, min: number, max: number): [value: number, next: number] {
  if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
    throw new RangeError(`nextInt needs integers with min <= max, got [${min}, ${max}]`);
  }
  const [f, next] = nextFloat(rng);
  return [min + Math.floor(f * (max - min + 1)), next];
}

/** Convenience: draw a float in [0, 1) from a GameState. Returns the value and a new state. */
export function randomFloat(state: GameState): [value: number, state: GameState] {
  const [value, rng] = nextFloat(state.rng);
  return [value, { ...state, rng }];
}

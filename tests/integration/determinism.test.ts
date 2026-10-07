// Q1: determinism. Same content + seed (+ intents, once C5 lands) => identical state, tick by tick.
// Also guards two properties determinism depends on: state is plain serializable data, and
// step() never mutates its inputs (inputs are deep-frozen, so any mutation throws in strict mode).
import { describe, expect, it } from 'vitest';
import { step } from '../../src/core/loop';
import { createInitialState } from '../../src/core/state';
import { createRunner } from '../../src/core/runner';
import {
  FIXED_DT_MS,
  type GameContent,
  type GameState,
  type PlayerIntent,
} from '../../src/core/types';
import { content as realContent } from '../../src/data';
import { makeTestContent } from '../core/fixtures';
import { autoStartWaves, deepFreeze, run, type Script } from './helpers';

const TICKS = 60 * 30; // 30 simulated seconds

/** Run `ticks` steps and return every intermediate state (index 0 = initial). */
function simulate(content: GameContent, seed: number, ticks: number): GameState[] {
  const states = [createInitialState(content, seed)];
  for (let i = 0; i < ticks; i++) states.push(step(states[states.length - 1]!, content));
  return states;
}

describe('Q1 determinism', () => {
  it('same content and seed produce identical states at every tick', () => {
    const a = simulate(makeTestContent(), 42, TICKS);
    const b = simulate(makeTestContent(), 42, TICKS);
    expect(a.length).toBe(TICKS + 1);
    for (let i = 0; i < a.length; i++) expect(b[i], `tick ${i}`).toEqual(a[i]);
  });

  it('initial state records the seed and differs only in seed/rng across seeds', () => {
    const s1 = createInitialState(makeTestContent(), 1);
    const s2 = createInitialState(makeTestContent(), 2);
    expect(s1.seed).toBe(1);
    expect(s2.seed).toBe(2);
    expect(s1.rng).not.toBe(s2.rng);
    expect({ ...s1, seed: 0, rng: 0 }).toEqual({ ...s2, seed: 0, rng: 0 });
  });

  it('state stays plain serializable data (JSON round-trip is lossless)', () => {
    const states = simulate(makeTestContent(), 7, TICKS);
    for (const s of [states[0]!, states[TICKS / 2]!, states[TICKS]!]) {
      expect(JSON.parse(JSON.stringify(s))).toEqual(s);
    }
  });

  it('step never mutates its input state or the content', () => {
    const content = deepFreeze(makeTestContent());
    let state = deepFreeze(createInitialState(content, 3));
    for (let i = 0; i < TICKS; i++) {
      state = deepFreeze(step(state, content)); // throws TypeError if anything is mutated
    }
    expect(state.tick).toBe(TICKS);
  });

  it('tick advances by exactly one per step and events are per-step', () => {
    const content = makeTestContent();
    let state = createInitialState(content, 5);
    for (let i = 1; i <= 10; i++) {
      const prevEvents = state.events;
      state = step(state, content);
      expect(state.tick).toBe(i);
      // events from the previous step must not leak into this one
      for (const e of prevEvents) expect(state.events.some((x) => x === e)).toBe(false);
    }
  });
});

// --- with intents (C4/C5), real content -------------------------------------------------

describe('Q1 determinism with player intents', () => {
  const real = realContent;
  const script: Script = {
    0: [
      { type: 'placeTower', towerType: 'rapid', cell: { col: 6, row: 3 } },
      { type: 'placeTower', towerType: 'rapid', cell: { col: 2, row: 2 } }, // on path: rejected
      { type: 'startWave' },
    ],
    90: [{ type: 'startWave' }], // rejected: wave in progress
    400: [{ type: 'placeTower', towerType: 'heavy', cell: { col: 6, row: 11 } }],
  };
  const play = (seed: number) =>
    run(real, {
      seed,
      script,
      maxTicks: 60 * 120,
      keepHistory: true,
      policy: autoStartWaves(real),
    });

  it('same seed + same intents on the same ticks => identical state at every tick', () => {
    const a = play(9);
    const b = play(9);
    expect(a.history.length).toBeGreaterThan(1000);
    expect(b.history.length).toBe(a.history.length);
    for (let i = 0; i < a.history.length; i++)
      expect(b.history[i], `tick ${i}`).toEqual(a.history[i]);
    // the script actually exercised the systems
    expect(a.events.some((e) => e.type === 'enemyKilled')).toBe(true);
    expect(a.events.some((e) => e.type === 'intentRejected')).toBe(true);
  });

  it('a full game with intents never mutates frozen inputs', () => {
    const content = deepFreeze(structuredClone(real));
    let s = deepFreeze(createInitialState(content, 4));
    for (let i = 0; i < 60 * 90; i++) {
      s = deepFreeze(step(s, content, deepFreeze(script[s.tick] ?? autoStartWaves(content)(s))));
    }
    expect(s.tick).toBe(60 * 90);
  });

  it('the fixed-step runner produces exactly the states of direct step() calls', () => {
    const runner = createRunner(real, 3);
    let direct = createInitialState(real, 3);
    const intents: PlayerIntent[][] = [];
    for (let i = 0; i < 600; i++)
      intents.push(script[i] ?? (i === 200 ? [{ type: 'startWave' }] : []));
    for (let i = 0; i < 600; i++) {
      for (const it of intents[i]!) runner.dispatch(it);
      expect(runner.update(FIXED_DT_MS)).toBe(1);
      direct = step(direct, real, intents[i]!);
      expect(runner.getState(), `tick ${i}`).toEqual(direct);
    }
  });

  it('runner frame timing does not change the outcome (only how many steps run per frame)', () => {
    const frames = [5, 16.7, 33.4, 0, 250, 1000, 8, 16.6667];
    const a = createRunner(real, 2);
    const b = createRunner(real, 2);
    a.dispatch({ type: 'startWave' });
    b.dispatch({ type: 'startWave' });
    let stepsA = 0;
    let stepsB = 0;
    for (let i = 0; i < 400; i++) stepsA += a.update(FIXED_DT_MS);
    for (let f = 0; stepsB < stepsA; f++) stepsB += b.update(frames[f % frames.length]!);
    // b may overshoot by a few steps; advance a to match
    while (stepsA < stepsB) stepsA += a.update(FIXED_DT_MS);
    expect(b.getState()).toEqual(a.getState());
  });
});

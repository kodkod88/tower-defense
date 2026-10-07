import { describe, expect, it } from 'vitest';
import { applyIntent, applyIntents } from '../../src/core/intents';
import { createInitialState } from '../../src/core/state';
import type { GameState, PlayerIntent } from '../../src/core/types';
import { makeTestContent } from './fixtures';

const content = makeTestContent(); // path along row 2; rapid costs 50, heavy 100; 100 money
const fresh = (): GameState => createInitialState(content, 4);
const place = (towerType: string, col: number, row: number): PlayerIntent => ({
  type: 'placeTower',
  towerType,
  cell: { col, row },
});
const lastEvent = (s: GameState) => s.events[s.events.length - 1];

describe('applyIntent placeTower', () => {
  it('places an affordable tower on a free cell and charges for it', () => {
    const s = applyIntent(fresh(), place('rapid', 2, 0), content);
    expect(s.towers).toHaveLength(1);
    expect(s.towers[0]!.cell).toEqual({ col: 2, row: 0 });
    expect(s.money).toBe(50);
    expect(lastEvent(s)?.type).toBe('towerPlaced');
  });

  it.each([
    ['unknown tower type', place('laser', 2, 0)],
    ['a path cell', place('rapid', 2, 2)],
    ['out of bounds', place('rapid', 99, 0)],
  ])('rejects %s without changing anything but events', (_label, intent) => {
    const before = fresh();
    const s = applyIntent(before, intent, content);
    expect({ ...s, events: [] }).toEqual(before);
    expect(lastEvent(s)).toMatchObject({ type: 'intentRejected', intent });
  });

  it('rejects an occupied cell and an unaffordable tower', () => {
    const s = applyIntents(fresh(), [place('rapid', 2, 0), place('rapid', 2, 0)], content);
    expect(s.towers).toHaveLength(1);
    expect(lastEvent(s)?.type).toBe('intentRejected');
    const broke = applyIntent(s, place('heavy', 5, 0), content); // 50 money left, heavy costs 100
    expect(broke.towers).toHaveLength(1);
    expect(lastEvent(broke)).toMatchObject({ type: 'intentRejected', reason: 'insufficientFunds' });
  });
});

it.each(['won', 'lost'] as const)(
  'rejects placeTower with gameOver after the game is %s, without charging',
  (status) => {
    const over: GameState = { ...fresh(), status, money: 500 };
    const s = applyIntent(over, place('rapid', 4, 4), content);
    expect(s.towers).toEqual([]);
    expect(s.money).toBe(500);
    expect(s.events).toEqual([
      { type: 'intentRejected', intent: place('rapid', 4, 4), reason: 'gameOver' },
    ]);
  },
);

describe('applyIntent startWave', () => {
  it('starts the first wave', () => {
    const s = applyIntent(fresh(), { type: 'startWave' }, content);
    expect(s.status).toBe('playing');
    expect(s.wave).toMatchObject({ index: 0, active: true });
  });

  it('rejects starting while a wave is active, after the last wave, and when the game is over', () => {
    const start: PlayerIntent = { type: 'startWave' };
    const active = applyIntent(applyIntent(fresh(), start, content), start, content);
    expect(lastEvent(active)).toMatchObject({ reason: 'waveInProgress' });

    const done: GameState = {
      ...fresh(),
      status: 'playing',
      wave: { index: 1, active: false, elapsedTicks: 0, spawned: [] },
    };
    expect(lastEvent(applyIntent(done, start, content))).toMatchObject({ reason: 'noMoreWaves' });

    const lost: GameState = { ...fresh(), status: 'lost' };
    expect(lastEvent(applyIntent(lost, start, content))).toMatchObject({ reason: 'gameOver' });
  });
});

describe('applyIntent restart', () => {
  it('returns a fresh game with the same seed', () => {
    const played = applyIntents(fresh(), [place('rapid', 2, 0), { type: 'startWave' }], content);
    expect(applyIntent({ ...played, status: 'lost' }, { type: 'restart' }, content)).toEqual(
      fresh(),
    );
  });
});

it('never mutates its input', () => {
  const before = fresh();
  const snapshot = structuredClone(before);
  applyIntents(before, [place('rapid', 2, 0), { type: 'startWave' }, { type: 'restart' }], content);
  expect(before).toEqual(snapshot);
});

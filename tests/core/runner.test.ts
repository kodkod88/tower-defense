import { describe, expect, it } from 'vitest';
import { createRunner, MAX_FRAME_MS } from '../../src/core/runner';
import { step } from '../../src/core/loop';
import { createInitialState } from '../../src/core/state';
import { FIXED_DT_MS, type GameEventType } from '../../src/core/types';
import { makeTestContent } from './fixtures';

const content = makeTestContent();

describe('runner', () => {
  it('runs one step per fixed dt and carries the remainder', () => {
    const r = createRunner(content);
    expect(r.update(FIXED_DT_MS / 2)).toBe(0);
    expect(r.update(FIXED_DT_MS / 2)).toBe(1);
    expect(r.update(FIXED_DT_MS * 3)).toBe(3);
    expect(r.getState().tick).toBe(4);
  });

  it('clamps huge frame gaps and ignores negative ones', () => {
    const r = createRunner(content);
    expect(r.update(10_000)).toBe(15); // 250ms at 60Hz
    expect(MAX_FRAME_MS).toBe(250);
    expect(r.update(-50)).toBe(0);
  });

  it('applies queued intents on the next step only, and keeps them queued until a step runs', () => {
    const r = createRunner(content, 3);
    r.dispatch({ type: 'startWave' });
    r.update(0);
    expect(r.getState().status).toBe('ready');
    r.update(FIXED_DT_MS);
    expect(r.getState().status).toBe('playing');
    expect(r.getState()).toEqual(
      step(createInitialState(content, 3), content, [{ type: 'startWave' }]),
    );
  });

  it('emits every step event on the bus in order', () => {
    const r = createRunner(content);
    const seen: GameEventType[] = [];
    r.bus.onAny((e) => seen.push(e.type));
    r.dispatch({ type: 'placeTower', towerType: 'rapid', cell: { col: 2, row: 0 } });
    r.dispatch({ type: 'startWave' });
    r.update(FIXED_DT_MS);
    expect(seen).toEqual(['towerPlaced', 'waveStarted', 'enemySpawned']);
  });
});

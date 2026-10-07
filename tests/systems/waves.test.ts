import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../src/core/state';
import { canStartWave, dueCount, startWave, wavesSystem } from '../../src/systems/waves';
import { makeTestContent, repeat } from './helpers';

const content = makeTestContent();
// wave 0: 3 runners, interval 0.5s (30 ticks), delay 0, reward 10
// wave 1: 2 runners (0.5s) + 1 brute at delay 1s (60 ticks)
const fresh = () => createInitialState(content, 1);
const tick = (s: ReturnType<typeof fresh>) => wavesSystem(s, content);

describe('dueCount', () => {
  const g = { enemy: 'runner', count: 3, interval: 0.5, delay: 1 };
  it('spawns at delay + k * interval, capped at count', () => {
    expect(dueCount(g, 59)).toBe(0);
    expect(dueCount(g, 60)).toBe(1);
    expect(dueCount(g, 89)).toBe(1);
    expect(dueCount(g, 90)).toBe(2);
    expect(dueCount(g, 10_000)).toBe(3);
  });
  it('zero interval spawns the whole group at once; zero count spawns nothing', () => {
    expect(dueCount({ ...g, interval: 0, delay: 0 }, 0)).toBe(3);
    expect(dueCount({ ...g, count: 0 }, 10_000)).toBe(0);
  });
});

describe('canStartWave / startWave', () => {
  it('starts wave 0 from ready', () => {
    const s = startWave(fresh(), content);
    expect(s.status).toBe('playing');
    expect(s.wave).toEqual({ index: 0, active: true, elapsedTicks: 0, spawned: [0] });
    expect(s.events).toEqual([{ type: 'waveStarted', waveIndex: 0 }]);
  });
  it('rejects while a wave is active, after the last wave, and when the game is over', () => {
    const active = startWave(fresh(), content);
    expect(canStartWave(active, content)).toEqual({ ok: false, reason: 'waveInProgress' });
    expect(startWave(active, content)).toBe(active);
    const done = { ...active, wave: { ...active.wave, index: 1, active: false } };
    expect(canStartWave(done, content)).toEqual({ ok: false, reason: 'noMoreWaves' });
    expect(canStartWave({ ...fresh(), status: 'lost' }, content)).toEqual({
      ok: false,
      reason: 'gameOver',
    });
  });
});

describe('wavesSystem', () => {
  it('does nothing when no wave is active', () => {
    const s = fresh();
    expect(tick(s)).toBe(s);
  });

  it('spawns enemies on schedule with unique ids and events', () => {
    const s0 = startWave(fresh(), content);
    const s1 = tick(s0);
    expect(s1.enemies.map((e) => e.id)).toEqual([1]);
    expect(s1.events).toContainEqual({ type: 'enemySpawned', enemyId: 1, enemyType: 'runner' });
    expect(s1.wave.spawned).toEqual([1]);
    expect(s1.wave.elapsedTicks).toBe(1);
    expect(repeat(s0, 30, tick).enemies).toHaveLength(1);
    expect(repeat(s0, 31, tick).enemies).toHaveLength(2);
    const all = repeat(s0, 61, tick);
    expect(all.enemies.map((e) => e.id)).toEqual([1, 2, 3]);
    expect(all.nextId).toBe(4);
    expect(repeat(s0, 500, tick).enemies).toHaveLength(3); // never more than count
  });

  it('runs groups in parallel with their own delays', () => {
    const s0 = startWave(
      { ...fresh(), wave: { index: 0, active: false, elapsedTicks: 0, spawned: [] } },
      content,
    );
    const w1 = repeat(s0, 60, tick); // wave 1, elapsed 0..59: runners at 0 and 30
    expect(w1.wave.index).toBe(1);
    expect(w1.enemies.map((e) => e.type)).toEqual(['runner', 'runner']);
    const later = tick(w1); // elapsed 60 = brute delay
    expect(later.enemies.map((e) => e.type)).toEqual(['runner', 'runner', 'brute']);
  });

  it('stays active while enemies are alive, then clears with the reward', () => {
    const spawned = repeat(startWave(fresh(), content), 61, tick);
    expect(spawned.wave.active).toBe(true);
    const stillAlive = tick(spawned);
    expect(stillAlive.wave.active).toBe(true);
    const cleared = tick({ ...spawned, enemies: [], events: [] });
    expect(cleared.wave.active).toBe(false);
    expect(cleared.events).toEqual([{ type: 'waveCleared', waveIndex: 0, reward: 10 }]);
    expect(cleared.money).toBe(spawned.money); // economySystem pays
  });

  it('a wave with no groups clears on its first tick with reward 0 by default', () => {
    const c = makeTestContent({ waves: [{ groups: [] }] });
    const s = wavesSystem(startWave(createInitialState(c, 1), c), c);
    expect(s.wave.active).toBe(false);
    expect(s.events).toContainEqual({ type: 'waveCleared', waveIndex: 0, reward: 0 });
  });

  it('is deterministic and does not mutate the input', () => {
    const s0 = startWave(fresh(), content);
    const copy = structuredClone(s0);
    expect(repeat(s0, 100, tick)).toEqual(repeat(s0, 100, tick));
    expect(s0).toEqual(copy);
  });
});

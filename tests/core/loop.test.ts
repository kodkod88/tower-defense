import { describe, expect, it } from 'vitest';
import { runSystems, step } from '../../src/core/loop';
import { createInitialState } from '../../src/core/state';
import type { GameState, System } from '../../src/core/types';
import { makeTestContent } from './fixtures';

const content = makeTestContent();
const playing = (): GameState => ({ ...createInitialState(content), status: 'playing' });
const tag =
  (name: string): System =>
  (s) => ({ ...s, events: [...s.events, { type: 'waveStarted', waveIndex: name.length }] });

describe('step', () => {
  it('advances the tick without mutating the input state', () => {
    const before = createInitialState(content);
    const after = step(before, content);
    expect(after.tick).toBe(1);
    expect(before.tick).toBe(0);
  });

  it('clears the previous step events', () => {
    const s = { ...playing(), events: [{ type: 'gameWon' as const }] };
    expect(step(s, content, [], []).events).toEqual([]);
  });

  it('runs systems in the given order only while playing', () => {
    const systems = [tag('a'), tag('bb'), tag('ccc')];
    expect(
      step(playing(), content, [], systems).events.map(
        (e) => e.type === 'waveStarted' && e.waveIndex,
      ),
    ).toEqual([1, 2, 3]);
    expect(step(createInitialState(content), content, [], systems).events).toEqual([]);
    expect(step({ ...playing(), status: 'won' }, content, [], systems).events).toEqual([]);
  });
});

describe('runSystems', () => {
  it('threads each system output into the next', () => {
    const add: System = (s) => ({ ...s, money: s.money + 1 });
    const double: System = (s) => ({ ...s, money: s.money * 2 });
    expect(runSystems(playing(), content, [add, double]).money).toBe(
      (content.startingMoney + 1) * 2,
    );
  });
});

describe('step with the real systems and intents', () => {
  it('a startWave intent begins the wave and spawns its first enemy in the same tick', () => {
    const s = step(createInitialState(content), content, [{ type: 'startWave' }]);
    expect(s.status).toBe('playing');
    expect(s.wave.index).toBe(0);
    expect(s.events.map((e) => e.type)).toEqual(['waveStarted', 'enemySpawned']);
    expect(s.enemies).toHaveLength(1);
  });

  it('intents are applied before systems and their events are kept for this tick only', () => {
    const place = { type: 'placeTower' as const, towerType: 'rapid', cell: { col: 2, row: 0 } };
    const s1 = step(createInitialState(content), content, [place]);
    expect(s1.towers).toHaveLength(1);
    expect(s1.events.map((e) => e.type)).toEqual(['towerPlaced']);
    expect(step(s1, content).events).toEqual([]);
  });

  it('replaying the same intents on the same ticks is deterministic', () => {
    const script = new Map([
      [0, [{ type: 'placeTower' as const, towerType: 'rapid', cell: { col: 2, row: 0 } }]],
      [5, [{ type: 'startWave' as const }]],
    ]);
    const run = () => {
      let s = createInitialState(content, 9);
      for (let t = 0; t < 600; t++) s = step(s, content, script.get(t) ?? []);
      return s;
    };
    expect(run()).toEqual(run());
  });
});

describe('restart through step', () => {
  it('fully resets mid-wave state from state.seed (then runs one idle tick)', () => {
    let s = createInitialState(content, 11);
    s = step(s, content, [
      { type: 'placeTower', towerType: 'rapid', cell: { col: 2, row: 0 } },
      { type: 'startWave' },
    ]);
    for (let t = 0; t < 30; t++) s = step(s, content);
    expect(s.wave.active).toBe(true);
    const r = step(s, content, [{ type: 'restart' }]);
    expect(r).toEqual({ ...createInitialState(content, 11), tick: 1 });
    expect(r.wave).toEqual({ index: -1, active: false, elapsedTicks: 0, spawned: [] });
  });
});

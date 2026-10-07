// Q2: full games simulated headless through the real step() pipeline, real systems and real content.
// Balance is D5's job; here the win run gets a big budget so it tests integration, not tuning.
import { describe, expect, it } from 'vitest';
import { step } from '../../src/core/loop';
import { createInitialState } from '../../src/core/state';
import type { GameContent, GameEvent, GameState } from '../../src/core/types';
import { content as realContent } from '../../src/data';
import { autoStartWaves, buildIntents, cellsNearPath, run } from './helpers';

const MAX_TICKS = 60 * 60 * 20; // 20 simulated minutes: far longer than any real game

const totalEnemies = (c: GameContent) =>
  c.waves.reduce((n, w) => n + w.groups.reduce((m, g) => m + g.count, 0), 0);

const sum = (events: readonly GameEvent[], pick: (e: GameEvent) => number) =>
  events.reduce((n, e) => n + pick(e), 0);

/** Invariants that must hold across every single step of every game. */
function makeInvariantChecker(content: GameContent) {
  const resolved = new Map<number, 'killed' | 'leaked'>();
  return (prev: GameState, next: GameState) => {
    const ev = next.events;
    const ctx = `tick ${next.tick}`;
    expect(next.tick, ctx).toBe(prev.tick + 1);

    // Money accounting: every change is explained by an event.
    const spent = sum(ev, (e) => (e.type === 'towerPlaced' ? e.cost : 0));
    const earned = sum(ev, (e) =>
      e.type === 'enemyKilled' ? e.bounty : e.type === 'waveCleared' ? e.reward : 0,
    );
    expect(next.money, ctx).toBe(prev.money - spent + earned);
    expect(next.money, ctx).toBeGreaterThanOrEqual(0);

    // Lives accounting.
    const leaked = sum(ev, (e) => (e.type === 'enemyLeaked' ? e.livesCost : 0));
    expect(next.lives, ctx).toBe(Math.max(0, prev.lives - leaked));

    // Each enemy is resolved (killed or leaked) at most once, and then gone.
    for (const e of ev) {
      if (e.type !== 'enemyKilled' && e.type !== 'enemyLeaked') continue;
      expect(resolved.has(e.enemyId), `${ctx}: enemy ${e.enemyId} resolved twice`).toBe(false);
      resolved.set(e.enemyId, e.type === 'enemyKilled' ? 'killed' : 'leaked');
    }
    for (const e of next.enemies) {
      expect(resolved.has(e.id), `${ctx}: resolved enemy ${e.id} still on map`).toBe(false);
      expect(e.hp, ctx).toBeGreaterThan(0);
    }

    // Ids are unique and below nextId.
    const ids = [...next.enemies, ...next.towers, ...next.projectiles].map((x) => x.id);
    expect(new Set(ids).size, ctx).toBe(ids.length);
    for (const id of ids) expect(id, ctx).toBeLessThan(next.nextId);

    // Status only moves forward.
    const order = { ready: 0, playing: 1, won: 2, lost: 2 } as const;
    expect(order[next.status], ctx).toBeGreaterThanOrEqual(order[prev.status]);
    if (prev.status === 'won' || prev.status === 'lost') expect(next.status, ctx).toBe(prev.status);

    // Wave index stays within content.
    expect(next.wave.index, ctx).toBeLessThan(content.waves.length);
  };
}

function eventCount(events: readonly GameEvent[], type: GameEvent['type']) {
  return events.filter((e) => e.type === type).length;
}

/** After the game ends, stepping (with or without intents) must change nothing but tick/events. */
function expectFrozenAfterEnd(final: GameState, content: GameContent) {
  let s = final;
  for (let i = 0; i < 120; i++) {
    s = step(s, content, i === 0 ? [{ type: 'startWave' }] : []);
  }
  const strip = ({ tick: _t, events: _e, ...rest }: GameState) => rest;
  expect(strip(s)).toEqual(strip(final));
  expect(s.tick).toBe(final.tick + 120);
}

describe('Q2 full game: loss', () => {
  it('no towers + auto-started waves loses, with consistent accounting', () => {
    const content = realContent;
    const { final, events } = run(content, {
      maxTicks: MAX_TICKS,
      policy: autoStartWaves(content),
      onStep: makeInvariantChecker(content),
    });
    expect(final.status).toBe('lost');
    expect(final.lives).toBe(0);
    expect(eventCount(events, 'gameLost')).toBe(1);
    expect(eventCount(events, 'gameWon')).toBe(0);
    expect(eventCount(events, 'enemyKilled')).toBe(0);
    expect(final.money).toBe(
      content.startingMoney + sum(events, (e) => (e.type === 'waveCleared' ? e.reward : 0)),
    );
    expect(events.at(-1)).toEqual({ type: 'gameLost' });
    expectFrozenAfterEnd(final, content);
  });

  it('a single huge leak cannot push lives below zero', () => {
    const content: GameContent = { ...realContent, startingLives: 1 };
    const { final } = run(content, {
      maxTicks: MAX_TICKS,
      policy: autoStartWaves(content),
      onStep: makeInvariantChecker(content),
    });
    expect(final.status).toBe('lost');
    expect(final.lives).toBe(0);
    expect(final.wave.index).toBe(0);
  });
});

describe('Q2 full game: win', () => {
  it('a dense defence clears all waves and wins, with consistent accounting', () => {
    const content: GameContent = { ...realContent, startingMoney: 1_000_000 };
    const initial = createInitialState(content, 1);
    const build = buildIntents(initial, content, cellsNearPath(content, content.map.tileSize * 2), [
      'rapid',
      'heavy',
    ]);
    expect(build.length).toBeGreaterThan(20);

    const { final, events } = run(content, {
      maxTicks: MAX_TICKS,
      script: { 0: build },
      policy: autoStartWaves(content),
      onStep: makeInvariantChecker(content),
    });

    expect(final.status).toBe('won');
    expect(final.lives).toBeGreaterThan(0);
    expect(final.wave.index).toBe(content.waves.length - 1);
    expect(final.enemies).toHaveLength(0);
    expect(eventCount(events, 'gameWon')).toBe(1);
    expect(eventCount(events, 'gameLost')).toBe(0);
    expect(eventCount(events, 'waveStarted')).toBe(content.waves.length);
    expect(eventCount(events, 'waveCleared')).toBe(content.waves.length);
    expect(eventCount(events, 'towerPlaced')).toBe(build.length);
    expect(eventCount(events, 'intentRejected')).toBe(0);
    // every spawned enemy was resolved exactly once
    expect(eventCount(events, 'enemySpawned')).toBe(totalEnemies(content));
    expect(eventCount(events, 'enemyKilled') + eventCount(events, 'enemyLeaked')).toBe(
      totalEnemies(content),
    );
    expect(events.at(-1)).toEqual({ type: 'gameWon' });
    expectFrozenAfterEnd(final, content);
  });

  it('restart after a finished game returns to a fresh ready state', () => {
    const content = realContent;
    const { final } = run(content, { maxTicks: MAX_TICKS, policy: autoStartWaves(content) });
    expect(final.status).toBe('lost');
    const restarted = step(final, content, [{ type: 'restart' }]);
    const fresh = step(createInitialState(content, final.seed), content);
    expect(restarted).toEqual(fresh);
    expect(restarted.status).toBe('ready');
    expect(restarted.money).toBe(content.startingMoney);
  });
});

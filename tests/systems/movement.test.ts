import { describe, expect, it } from 'vitest';
import { advanceEnemy, hasReachedExit, movementSystem } from '../../src/systems/movement';
import { enemy, makeTestContent, playing, repeat } from './helpers';

const content = makeTestContent(); // runner: 120 px/s = 2 px/tick; path (0,100) → (400,100)
const L = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
];

describe('advanceEnemy', () => {
  const base = enemy(content, 1, { pos: { x: 0, y: 0 } });
  it('moves along a segment and tracks distance', () => {
    const e = advanceEnemy(base, L, 4);
    expect(e.pos).toEqual({ x: 4, y: 0 });
    expect(e.distance).toBe(4);
    expect(e.waypointIndex).toBe(1);
  });
  it('carries leftover movement around a corner', () => {
    const e = advanceEnemy({ ...base, pos: { x: 9, y: 0 }, distance: 9 }, L, 3);
    expect(e.pos).toEqual({ x: 10, y: 2 });
    expect(e.waypointIndex).toBe(2);
    expect(e.distance).toBe(12);
  });
  it('can cross several waypoints in one step and stops at the exit', () => {
    const e = advanceEnemy(base, L, 100);
    expect(e.pos).toEqual({ x: 10, y: 10 });
    expect(e.distance).toBe(20);
    expect(hasReachedExit(e, L)).toBe(true);
  });
  it('arriving exactly on the last waypoint counts as reaching the exit', () => {
    const e = advanceEnemy(base, L, 20);
    expect(hasReachedExit(e, L)).toBe(true);
  });
  it('zero or negative step does not move', () => {
    expect(advanceEnemy(base, L, 0)).toEqual(base);
    expect(advanceEnemy(base, L, -5)).toEqual(base);
  });
  it('does not mutate the input enemy', () => {
    const copy = structuredClone(base);
    advanceEnemy(base, L, 15);
    expect(base).toEqual(copy);
  });
});

describe('movementSystem', () => {
  it('moves each enemy by speed * DT_SECONDS', () => {
    const s = playing(content, {
      enemies: [enemy(content, 1), enemy(content, 2, {}, 'brute')],
    });
    const next = movementSystem(s, content);
    expect(next.enemies[0]!.pos.x).toBeCloseTo(2);
    expect(next.enemies[1]!.pos.x).toBeCloseTo(40 / 60);
    expect(s.enemies[0]!.pos.x).toBe(0); // input untouched
  });

  it('a runner takes 200 ticks to walk 400 px and then leaks', () => {
    const s = playing(content, { enemies: [enemy(content, 1)] });
    const before = repeat(s, 199, (x) => movementSystem(x, content));
    expect(before.enemies).toHaveLength(1);
    const after = movementSystem(before, content);
    expect(after.enemies).toHaveLength(0);
  });

  it('removes enemies at the exit with an enemyLeaked event but leaves lives to winLose', () => {
    const s = playing(content, {
      enemies: [
        enemy(content, 1, { pos: { x: 399, y: 100 }, distance: 399 }),
        enemy(content, 2, { pos: { x: 399, y: 100 }, distance: 399 }, 'brute'),
        enemy(content, 3),
      ],
    });
    const next = movementSystem(s, content);
    expect(next.enemies.map((e) => e.id)).toEqual([2, 3]);
    expect(next.events).toEqual([
      { type: 'enemyLeaked', enemyId: 1, enemyType: 'runner', livesCost: 1 },
    ]);
    expect(next.lives).toBe(s.lives);
  });

  it('returns the same state when there are no enemies', () => {
    const s = playing(content);
    expect(movementSystem(s, content)).toBe(s);
  });
});

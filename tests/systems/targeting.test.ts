import { describe, expect, it } from 'vitest';
import { findNearestInRange, targetingSystem } from '../../src/systems/targeting';
import { enemy, makeTestContent, playing, repeat, tower } from './helpers';

const content = makeTestContent(); // rapid: range 100, 4 shots/s → 15 ticks
// Tower at cell (5,1) → center (220, 60). Path at y=100 is 40 px away.

describe('findNearestInRange', () => {
  const at = (id: number, x: number, y = 100, hp = 10) => enemy(content, id, { pos: { x, y }, hp });
  const from = { x: 220, y: 60 };
  it('picks the closest enemy', () => {
    expect(findNearestInRange(from, 100, [at(1, 150), at(2, 230), at(3, 300)])?.id).toBe(2);
  });
  it('breaks ties by lowest id regardless of order', () => {
    expect(findNearestInRange(from, 100, [at(9, 200), at(4, 240)])?.id).toBe(4);
  });
  it('includes enemies exactly at range and excludes ones beyond it', () => {
    expect(findNearestInRange({ x: 0, y: 0 }, 100, [at(1, 100, 0)])?.id).toBe(1);
    expect(findNearestInRange({ x: 0, y: 0 }, 100, [at(1, 100.01, 0)])).toBeNull();
  });
  it('ignores dead enemies and handles an empty list', () => {
    expect(findNearestInRange(from, 100, [at(1, 220, 100, 0)])).toBeNull();
    expect(findNearestInRange(from, 100, [])).toBeNull();
  });
});

describe('targetingSystem', () => {
  it('fires at the nearest enemy: projectile, cooldown, event, nextId', () => {
    const s = playing(content, {
      towers: [tower(content, 1, 5, 1)],
      enemies: [enemy(content, 2, { pos: { x: 220, y: 100 } })],
    });
    const next = targetingSystem(s, content);
    expect(next.projectiles).toEqual([
      { id: 100, towerId: 1, targetId: 2, pos: { x: 220, y: 60 }, damage: 2, speed: 400 },
    ]);
    expect(next.towers[0]).toMatchObject({ cooldownTicks: 15, targetId: 2 });
    expect(next.nextId).toBe(101);
    expect(next.events).toEqual([
      { type: 'projectileFired', projectileId: 100, towerId: 1, targetId: 2 },
    ]);
    expect(s.projectiles).toEqual([]); // input untouched
  });

  it('fires exactly every cooldownTicksFor(def) ticks', () => {
    const s = playing(content, {
      towers: [tower(content, 1, 5, 1)],
      enemies: [enemy(content, 2, { pos: { x: 220, y: 100 } })],
    });
    expect(repeat(s, 15, (x) => targetingSystem(x, content)).projectiles).toHaveLength(1);
    expect(repeat(s, 16, (x) => targetingSystem(x, content)).projectiles).toHaveLength(2);
    expect(repeat(s, 31, (x) => targetingSystem(x, content)).projectiles).toHaveLength(3);
  });

  it('ticks cooldown down and clears the target when nothing is in range', () => {
    const s = playing(content, {
      towers: [tower(content, 1, 5, 1, 'rapid', { cooldownTicks: 5, targetId: 99 })],
      enemies: [enemy(content, 2, { pos: { x: 0, y: 100 } })],
    });
    const next = targetingSystem(s, content);
    expect(next.towers[0]).toMatchObject({ cooldownTicks: 4, targetId: null });
    expect(next.projectiles).toEqual([]);
    expect(next.events).toEqual([]);
  });

  it('tracks a target while cooling down without firing', () => {
    const s = playing(content, {
      towers: [tower(content, 1, 5, 1, 'rapid', { cooldownTicks: 3 })],
      enemies: [enemy(content, 2, { pos: { x: 220, y: 100 } })],
    });
    const next = targetingSystem(s, content);
    expect(next.towers[0]).toMatchObject({ cooldownTicks: 2, targetId: 2 });
    expect(next.projectiles).toEqual([]);
  });

  it('gives each tower firing in the same tick a unique projectile id', () => {
    const s = playing(content, {
      towers: [tower(content, 1, 5, 1), tower(content, 2, 6, 1, 'heavy')],
      enemies: [enemy(content, 3, { pos: { x: 240, y: 100 } })],
    });
    const next = targetingSystem(s, content);
    expect(next.projectiles.map((p) => [p.id, p.towerId, p.damage])).toEqual([
      [100, 1, 2],
      [101, 2, 20],
    ]);
    expect(next.nextId).toBe(102);
  });

  it('returns the same state when there are no towers', () => {
    const s = playing(content, { enemies: [enemy(content, 1)] });
    expect(targetingSystem(s, content)).toBe(s);
  });
});

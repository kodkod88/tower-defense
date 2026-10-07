import { describe, expect, it } from 'vitest';
import { projectilesSystem } from '../../src/systems/projectiles';
import { enemy, makeTestContent, playing, projectile } from './helpers';

const content = makeTestContent(); // runner: 10 hp, radius 8, bounty 5
const target = (patch = {}) => enemy(content, 2, { pos: { x: 200, y: 100 }, ...patch });

describe('projectilesSystem', () => {
  it('flies speed * DT_SECONDS toward the target', () => {
    const s = playing(content, {
      enemies: [target()],
      projectiles: [projectile({ targetId: 2, pos: { x: 200, y: 0 }, speed: 600 })],
    });
    const next = projectilesSystem(s, content);
    expect(next.projectiles[0]!.pos).toEqual({ x: 200, y: 10 });
    expect(next.enemies[0]!.hp).toBe(10);
    expect(next.events).toEqual([]);
  });

  it('homes toward the target current position', () => {
    const s = playing(content, {
      enemies: [target({ pos: { x: 300, y: 0 } })],
      projectiles: [projectile({ targetId: 2, pos: { x: 0, y: 0 }, speed: 600 })],
    });
    expect(projectilesSystem(s, content).projectiles[0]!.pos).toEqual({ x: 10, y: 0 });
  });

  it('hits within the enemy radius, deals damage, and is removed', () => {
    const s = playing(content, {
      enemies: [target()],
      projectiles: [projectile({ id: 7, targetId: 2, pos: { x: 200, y: 85 }, damage: 3 })], // ends 5px away, radius 8
    });
    const next = projectilesSystem(s, content);
    expect(next.enemies[0]!.hp).toBe(7);
    expect(next.projectiles).toEqual([]);
    expect(next.events).toEqual([
      { type: 'projectileHit', projectileId: 7, targetId: 2, damage: 3 },
    ]);
  });

  it('kills at exactly zero hp, removing the enemy with a bounty event', () => {
    const s = playing(content, {
      enemies: [target({ hp: 3 }), enemy(content, 3, { pos: { x: 50, y: 100 } })],
      projectiles: [projectile({ id: 7, targetId: 2, pos: { x: 200, y: 100 }, damage: 3 })],
    });
    const next = projectilesSystem(s, content);
    expect(next.enemies.map((e) => e.id)).toEqual([3]);
    expect(next.events).toContainEqual({
      type: 'enemyKilled',
      enemyId: 2,
      enemyType: 'runner',
      bounty: 5,
    });
    expect(next.money).toBe(s.money); // economySystem pays
  });

  it('two hits in one tick both land and the enemy dies once', () => {
    const s = playing(content, {
      enemies: [target()],
      projectiles: [
        projectile({ id: 7, targetId: 2, pos: { x: 200, y: 100 }, damage: 6 }),
        projectile({ id: 8, targetId: 2, pos: { x: 201, y: 100 }, damage: 6 }),
      ],
    });
    const next = projectilesSystem(s, content);
    expect(next.enemies).toEqual([]);
    expect(next.events.filter((e) => e.type === 'projectileHit')).toHaveLength(2);
    expect(next.events.filter((e) => e.type === 'enemyKilled')).toHaveLength(1);
  });

  it('overkill: a projectile whose target already died this tick fizzles without a hit', () => {
    const s = playing(content, {
      enemies: [target()],
      projectiles: [
        projectile({ id: 7, targetId: 2, pos: { x: 200, y: 100 }, damage: 20 }),
        projectile({ id: 8, targetId: 2, pos: { x: 200, y: 100 }, damage: 20 }),
      ],
    });
    const next = projectilesSystem(s, content);
    expect(next.projectiles).toEqual([]);
    expect(next.events.map((e) => e.type)).toEqual(['projectileHit', 'enemyKilled']);
  });

  it('removes projectiles whose target no longer exists', () => {
    const s = playing(content, {
      enemies: [],
      projectiles: [projectile({ targetId: 42 })],
    });
    const next = projectilesSystem(s, content);
    expect(next.projectiles).toEqual([]);
    expect(next.events).toEqual([]);
  });

  it('does not mutate the input', () => {
    const s = playing(content, {
      enemies: [target()],
      projectiles: [projectile({ targetId: 2, pos: { x: 200, y: 100 }, damage: 4 })],
    });
    const copy = structuredClone(s);
    projectilesSystem(s, content);
    expect(s).toEqual(copy);
  });

  it('returns the same state when there are no projectiles', () => {
    const s = playing(content, { enemies: [target()] });
    expect(projectilesSystem(s, content)).toBe(s);
  });
});

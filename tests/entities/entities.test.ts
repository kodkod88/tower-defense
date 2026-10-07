import { describe, expect, it } from 'vitest';
import {
  cooldownTicksFor,
  createEnemy,
  createProjectile,
  createTower,
  getEnemyDef,
  getTowerDef,
} from '../../src/entities';
import { makeTestContent } from '../core/fixtures';

const content = makeTestContent();

describe('createEnemy', () => {
  it('starts at the first waypoint with full hp, walking toward waypoint 1', () => {
    const e = createEnemy(content, 'brute', 7);
    expect(e).toEqual({
      id: 7,
      type: 'brute',
      pos: { x: 0, y: 100 },
      hp: 60,
      maxHp: 60,
      speed: 40,
      waypointIndex: 1,
      distance: 0,
    });
  });
  it('copies the start position instead of aliasing the map path', () => {
    const e = createEnemy(content, 'runner', 1);
    expect(e.pos).not.toBe(content.map.path[0]);
  });
  it('throws on unknown types and empty paths', () => {
    expect(() => createEnemy(content, 'ghost', 1)).toThrow(/ghost/);
    const noPath = makeTestContent({ map: { ...content.map, path: [] } });
    expect(() => createEnemy(noPath, 'runner', 1)).toThrow();
  });
});

describe('createTower / cooldownTicksFor', () => {
  it('centers the tower on its cell and is ready to fire', () => {
    const t = createTower(content, 'rapid', { col: 3, row: 1 }, 9);
    expect(t).toEqual({
      id: 9,
      type: 'rapid',
      cell: { col: 3, row: 1 },
      pos: { x: 140, y: 60 },
      cooldownTicks: 0,
      targetId: null,
    });
  });
  it('throws on unknown tower types', () => {
    expect(() => createTower(content, 'laser', { col: 0, row: 0 }, 1)).toThrow(/laser/);
  });
  it('converts fire rate to ticks between shots', () => {
    expect(cooldownTicksFor(getTowerDef(content, 'rapid'))).toBe(15); // 4/s
    expect(cooldownTicksFor(getTowerDef(content, 'heavy'))).toBe(120); // 0.5/s
    expect(cooldownTicksFor({ ...getTowerDef(content, 'rapid'), fireRate: 1000 })).toBe(1);
    expect(cooldownTicksFor({ ...getTowerDef(content, 'rapid'), fireRate: 0 })).toBe(
      Number.MAX_SAFE_INTEGER,
    );
  });
});

describe('createProjectile', () => {
  it('leaves from the tower center with the def damage and speed', () => {
    const t = createTower(content, 'heavy', { col: 1, row: 1 }, 2);
    const p = createProjectile(t, getTowerDef(content, 'heavy'), 5, 11);
    expect(p).toEqual({
      id: 11,
      towerId: 2,
      targetId: 5,
      pos: { x: 60, y: 60 },
      damage: 20,
      speed: 250,
    });
    expect(p.pos).not.toBe(t.pos);
  });
});

describe('def lookups', () => {
  it('return defs or throw', () => {
    expect(getEnemyDef(content, 'runner').bounty).toBe(5);
    expect(() => getEnemyDef(content, 'nope')).toThrow();
    expect(() => getTowerDef(content, 'nope')).toThrow();
  });
});

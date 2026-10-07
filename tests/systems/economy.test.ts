import { describe, expect, it } from 'vitest';
import { canPlaceTower, economySystem, isCellOnPath, placeTower } from '../../src/systems/economy';
import { makeTestContent, playing, tower } from './helpers';

const content = makeTestContent();
// 10x6 grid of 40px; path along y=100 with width 40 → band y∈(80,120) = exactly row 2.

describe('economySystem', () => {
  it('pays bounties and wave rewards from this step’s events', () => {
    const s = playing(content, {
      money: 10,
      events: [
        { type: 'enemyKilled', enemyId: 1, enemyType: 'runner', bounty: 5 },
        { type: 'enemyKilled', enemyId: 2, enemyType: 'brute', bounty: 15 },
        { type: 'waveCleared', waveIndex: 0, reward: 10 },
        { type: 'enemyLeaked', enemyId: 3, enemyType: 'runner', livesCost: 1 },
      ],
    });
    expect(economySystem(s, content).money).toBe(40);
  });
  it('returns the same state when nothing was earned', () => {
    const s = playing(content);
    expect(economySystem(s, content)).toBe(s);
  });
});

describe('isCellOnPath', () => {
  it('blocks cells inside the band and allows cells touching its edge', () => {
    expect(isCellOnPath(content.map, { col: 0, row: 2 })).toBe(true);
    expect(isCellOnPath(content.map, { col: 9, row: 2 })).toBe(true);
    expect(isCellOnPath(content.map, { col: 4, row: 1 })).toBe(false);
    expect(isCellOnPath(content.map, { col: 4, row: 3 })).toBe(false);
  });
  it('handles diagonal paths and corners', () => {
    const map = {
      ...content.map,
      pathWidth: 10,
      path: [
        { x: 0, y: 0 },
        { x: 200, y: 200 },
        { x: 200, y: 0 },
      ],
    };
    expect(isCellOnPath(map, { col: 2, row: 2 })).toBe(true); // diagonal crosses it
    expect(isCellOnPath(map, { col: 4, row: 0 })).toBe(true); // within 5px of x=200 leg
    expect(isCellOnPath(map, { col: 3, row: 0 })).toBe(false);
    expect(isCellOnPath(map, { col: 0, row: 4 })).toBe(false);
    expect(isCellOnPath(map, { col: 5, row: 1 })).toBe(true); // vertical leg x=200 runs along its left edge
  });
});

describe('canPlaceTower', () => {
  const s = playing(content, { money: 100 });
  it('accepts a free, affordable, off-path cell', () => {
    expect(canPlaceTower(s, content, 'heavy', { col: 4, row: 1 })).toEqual({ ok: true });
  });
  it('rejects unknown tower types', () => {
    expect(canPlaceTower(s, content, 'laser', { col: 4, row: 1 })).toEqual({
      ok: false,
      reason: 'unknownTowerType',
    });
  });
  it('rejects out-of-bounds and fractional cells', () => {
    for (const cell of [
      { col: -1, row: 0 },
      { col: 10, row: 0 },
      { col: 0, row: 6 },
      { col: 1.5, row: 0 },
    ]) {
      expect(canPlaceTower(s, content, 'rapid', cell)).toEqual({
        ok: false,
        reason: 'outOfBounds',
      });
    }
  });
  it('rejects cells on the path', () => {
    expect(canPlaceTower(s, content, 'rapid', { col: 3, row: 2 })).toEqual({
      ok: false,
      reason: 'onPath',
    });
  });
  it('rejects cells already holding a tower', () => {
    const occupied = { ...s, towers: [tower(content, 1, 4, 1)] };
    expect(canPlaceTower(occupied, content, 'rapid', { col: 4, row: 1 })).toEqual({
      ok: false,
      reason: 'overlap',
    });
    expect(canPlaceTower(occupied, content, 'rapid', { col: 5, row: 1 })).toEqual({ ok: true });
  });
  it('rejects when money is short, allows exact money', () => {
    expect(canPlaceTower({ ...s, money: 99 }, content, 'heavy', { col: 4, row: 1 })).toEqual({
      ok: false,
      reason: 'insufficientFunds',
    });
    expect(canPlaceTower({ ...s, money: 0 }, content, 'rapid', { col: 4, row: 1 })).toEqual({
      ok: false,
      reason: 'insufficientFunds',
    });
    expect(canPlaceTower({ ...s, money: 100 }, content, 'heavy', { col: 4, row: 1 }).ok).toBe(true);
  });
  it('reports placement problems before money', () => {
    expect(canPlaceTower({ ...s, money: 0 }, content, 'rapid', { col: 3, row: 2 })).toEqual({
      ok: false,
      reason: 'onPath',
    });
  });
});

describe('placeTower', () => {
  it('pays, adds a centered tower, advances nextId, emits towerPlaced', () => {
    const s = playing(content, { money: 120, nextId: 5 });
    const next = placeTower(s, content, 'rapid', { col: 4, row: 1 });
    expect(next.money).toBe(70);
    expect(next.towers).toEqual([
      {
        id: 5,
        type: 'rapid',
        cell: { col: 4, row: 1 },
        pos: { x: 180, y: 60 },
        cooldownTicks: 0,
        targetId: null,
      },
    ]);
    expect(next.nextId).toBe(6);
    expect(next.events).toEqual([
      { type: 'towerPlaced', towerId: 5, towerType: 'rapid', cell: { col: 4, row: 1 }, cost: 50 },
    ]);
    expect(s.towers).toEqual([]);
  });
  it('returns the input state unchanged when invalid', () => {
    const s = playing(content, { money: 10 });
    expect(placeTower(s, content, 'rapid', { col: 4, row: 1 })).toBe(s);
    expect(placeTower(s, content, 'rapid', { col: 4, row: 2 })).toBe(s);
  });
});

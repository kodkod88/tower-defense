import { describe, expect, it } from 'vitest';
import { content } from '../../src/data';
import {
  createRenderMemory,
  IDLE_AIM,
  resolveAim,
  syncRenderMemory,
} from '../../src/render/renderer';
import {
  enemyArchetype,
  enemyHeading,
  recoilAmount,
  towerArchetype,
} from '../../src/render/sprites';

describe('archetypes', () => {
  it('maps known ids directly', () => {
    expect(towerArchetype('rapid')).toBe('rapid');
    expect(towerArchetype('heavy')).toBe('heavy');
    expect(enemyArchetype('runner')).toBe('runner');
    expect(enemyArchetype('tank')).toBe('tank');
  });

  it('falls back on stats for unknown ids', () => {
    expect(towerArchetype('sniper', { fireRate: 0.5 })).toBe('heavy');
    expect(towerArchetype('gatling', { fireRate: 6 })).toBe('rapid');
    expect(towerArchetype('ghost')).toBe('rapid');
    expect(enemyArchetype('brute', { radius: 14 })).toBe('tank');
    expect(enemyArchetype('imp', { radius: 6 })).toBe('runner');
    expect(enemyArchetype('ghost')).toBe('runner');
  });

  it('gives the real content distinct designs per type', () => {
    expect(towerArchetype('rapid', content.towers.rapid)).not.toBe(
      towerArchetype('heavy', content.towers.heavy),
    );
    expect(enemyArchetype('runner', content.enemies.runner)).not.toBe(
      enemyArchetype('tank', content.enemies.tank),
    );
  });
});

describe('enemyHeading', () => {
  const map = {
    path: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ],
  };

  it('points toward the current waypoint', () => {
    expect(enemyHeading({ pos: { x: 10, y: 0 }, waypointIndex: 1 }, map)).toBeCloseTo(0);
    expect(enemyHeading({ pos: { x: 100, y: 10 }, waypointIndex: 2 }, map)).toBeCloseTo(
      Math.PI / 2,
    );
  });

  it('uses the segment direction when standing on the waypoint', () => {
    expect(enemyHeading({ pos: { x: 100, y: 100 }, waypointIndex: 2 }, map)).toBeCloseTo(
      Math.PI / 2,
    );
  });

  it('clamps out-of-range waypoint indices and handles an empty path', () => {
    expect(enemyHeading({ pos: { x: 100, y: 50 }, waypointIndex: 9 }, map)).toBeCloseTo(
      Math.PI / 2,
    );
    expect(enemyHeading({ pos: { x: 1, y: 1 }, waypointIndex: 0 }, { path: [] })).toBe(0);
  });
});

describe('recoilAmount', () => {
  const def = content.towers.heavy!; // 0.8 shots/s -> 75 tick cooldown

  it('is 1 right after firing and 0 once a quarter of the cooldown has passed', () => {
    expect(recoilAmount({ cooldownTicks: 75 }, def)).toBe(1);
    expect(recoilAmount({ cooldownTicks: 56 }, def)).toBe(0);
    expect(recoilAmount({ cooldownTicks: 0 }, def)).toBe(0);
    const mid = recoilAmount({ cooldownTicks: 66 }, def);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });

  it('is 0 for an unknown def', () => {
    expect(recoilAmount({ cooldownTicks: 10 }, undefined)).toBe(0);
  });
});

describe('resolveAim', () => {
  it('aims at the target, else keeps the previous angle, else idles upward', () => {
    expect(resolveAim({ x: 0, y: 0 }, { x: 0, y: 5 }, 1)).toBeCloseTo(Math.PI / 2);
    expect(resolveAim({ x: 0, y: 0 }, undefined, 1.25)).toBe(1.25);
    expect(resolveAim({ x: 0, y: 0 }, undefined, undefined)).toBe(IDLE_AIM);
  });
});

describe('render memory', () => {
  it('remembers aims per memory and clears them when the tick goes backwards (restart)', () => {
    const mem = createRenderMemory();
    syncRenderMemory(mem, 10);
    mem.aim.set(1, 0.5);
    syncRenderMemory(mem, 11);
    expect(mem.aim.get(1)).toBe(0.5);
    syncRenderMemory(mem, 0);
    expect(mem.aim.size).toBe(0);
    expect(mem.tick).toBe(0);
  });

  it('keeps separate memories independent', () => {
    const a = createRenderMemory();
    const b = createRenderMemory();
    a.aim.set(1, 1);
    syncRenderMemory(b, 0);
    expect(a.aim.get(1)).toBe(1);
  });
});

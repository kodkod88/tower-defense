import { describe, expect, it } from 'vitest';
import { enemies, runner, tank } from '../../src/data/enemies';

describe('enemies', () => {
  it('keys match ids', () => {
    for (const [key, def] of Object.entries(enemies)) expect(def.id).toBe(key);
  });

  it('all stats are positive integers where they should be', () => {
    for (const e of Object.values(enemies)) {
      expect(e.name.length).toBeGreaterThan(0);
      expect(e.maxHp).toBeGreaterThan(0);
      expect(e.speed).toBeGreaterThan(0);
      expect(e.radius).toBeGreaterThan(0);
      expect(Number.isInteger(e.bounty) && e.bounty > 0).toBe(true);
      expect(Number.isInteger(e.livesCost) && e.livesCost > 0).toBe(true);
    }
  });

  it('has a fast-weak and a slow-tanky type', () => {
    expect(Object.keys(enemies)).toHaveLength(2);
    expect(runner.speed).toBeGreaterThan(tank.speed);
    expect(tank.maxHp).toBeGreaterThan(runner.maxHp);
    expect(tank.bounty).toBeGreaterThan(runner.bounty);
  });
});

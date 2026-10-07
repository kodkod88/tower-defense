import { describe, expect, it } from 'vitest';
import { heavy, rapid, towers } from '../../src/data/towers';
import { enemies } from '../../src/data/enemies';

describe('towers', () => {
  it('keys match ids', () => {
    for (const [key, def] of Object.entries(towers)) expect(def.id).toBe(key);
  });

  it('all stats are positive', () => {
    for (const t of Object.values(towers)) {
      expect(t.name.length).toBeGreaterThan(0);
      expect(Number.isInteger(t.cost) && t.cost > 0).toBe(true);
      expect(t.range).toBeGreaterThan(0);
      expect(t.damage).toBeGreaterThan(0);
      expect(t.fireRate).toBeGreaterThan(0);
      expect(t.projectileSpeed).toBeGreaterThan(0);
    }
  });

  it('projectiles outrun every enemy', () => {
    const fastest = Math.max(...Object.values(enemies).map((e) => e.speed));
    for (const t of Object.values(towers)) expect(t.projectileSpeed).toBeGreaterThan(fastest * 2);
  });

  it('has a rapid and a heavy type with distinct roles', () => {
    expect(Object.keys(towers)).toHaveLength(2);
    expect(rapid.fireRate).toBeGreaterThan(heavy.fireRate);
    expect(heavy.damage).toBeGreaterThan(rapid.damage);
    expect(heavy.range).toBeGreaterThan(rapid.range);
    expect(rapid.cost).toBeLessThan(heavy.cost);
  });
});

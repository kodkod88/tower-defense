import { describe, expect, it } from 'vitest';
import {
  COLORS,
  enemyColor,
  enemyRadius,
  healthColor,
  healthFraction,
  towerColor,
} from '../../src/render/draw';
import { makeContent } from './fixtures';

describe('healthFraction', () => {
  it('is hp / maxHp clamped to [0, 1]', () => {
    expect(healthFraction(15, 30)).toBe(0.5);
    expect(healthFraction(-5, 30)).toBe(0);
    expect(healthFraction(40, 30)).toBe(1);
  });

  it('returns 0 for a non-positive maxHp', () => {
    expect(healthFraction(10, 0)).toBe(0);
  });
});

describe('healthColor', () => {
  it('goes green -> yellow -> red as health drops', () => {
    expect(healthColor(1)).toBe(COLORS.hpGood);
    expect(healthColor(0.5)).toBe(COLORS.hpMid);
    expect(healthColor(0.1)).toBe(COLORS.hpLow);
  });
});

describe('entity colors and radius', () => {
  const content = makeContent();

  it('uses the content color hint when present', () => {
    const c = makeContent();
    c.towers.rapid!.color = '#123456';
    expect(towerColor({ type: 'rapid' }, c)).toBe('#123456');
  });

  it('gives different fallback colors to different types', () => {
    expect(towerColor({ type: 'rapid' }, content)).not.toBe(towerColor({ type: 'heavy' }, content));
  });

  it('does not crash on unknown types', () => {
    expect(typeof enemyColor({ type: 'nope' }, content)).toBe('string');
    expect(enemyRadius({ type: 'nope' }, content)).toBe(8);
    expect(enemyRadius({ type: 'runner' }, content)).toBe(8);
  });
});

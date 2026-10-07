import { describe, expect, it } from 'vitest';
import { content } from '../../src/data';
import type { WaveDef } from '../../src/core/types';

const { waves, enemies, startingLives } = content;

const totalHp = (w: WaveDef) => w.groups.reduce((s, g) => s + g.count * enemies[g.enemy]!.maxHp, 0);
const totalLivesCost = (w: WaveDef) =>
  w.groups.reduce((s, g) => s + g.count * enemies[g.enemy]!.livesCost, 0);

describe('waves', () => {
  it('has exactly 5 waves', () => {
    expect(waves).toHaveLength(5);
  });

  it('every group references an existing enemy and has valid timing', () => {
    for (const w of waves) {
      expect(w.groups.length).toBeGreaterThan(0);
      for (const g of w.groups) {
        expect(enemies[g.enemy]).toBeDefined();
        expect(Number.isInteger(g.count) && g.count > 0).toBe(true);
        expect(g.interval).toBeGreaterThan(0);
        expect(g.delay).toBeGreaterThanOrEqual(0);
      }
      if (w.reward !== undefined) expect(w.reward).toBeGreaterThanOrEqual(0);
    }
  });

  it('difficulty (total enemy hp) strictly rises each wave', () => {
    for (let i = 1; i < waves.length; i++) {
      expect(totalHp(waves[i]!)).toBeGreaterThan(totalHp(waves[i - 1]!));
    }
  });

  it('building nothing survives wave 1 but loses by wave 2', () => {
    const w1 = totalLivesCost(waves[0]!);
    const w2 = totalLivesCost(waves[1]!);
    expect(w1).toBeLessThan(startingLives);
    expect(w1 + w2).toBeGreaterThanOrEqual(startingLives);
  });
});

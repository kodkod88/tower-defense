import { describe, expect, it } from 'vitest';
import {
  addEffect,
  drawEffects,
  EFFECT_TTL,
  effectProgress,
  hitFlashes,
  MAX_EFFECTS,
  pruneEffects,
  type Effect,
} from '../../src/render/effects';

const text = (born: number, ttl = 100): Effect => ({
  kind: 'floatText',
  pos: { x: 0, y: 0 },
  text: '+$5',
  color: '#fff',
  born,
  ttl,
});
const flash = (enemyId: number, born: number): Effect => ({
  kind: 'hitFlash',
  enemyId,
  born,
  ttl: 100,
});

describe('effect lifecycle', () => {
  it('spawns by appending and caps by dropping the oldest', () => {
    let list: Effect[] = [];
    for (let i = 0; i < 5; i++) list = addEffect(list, text(i), 3);
    expect(list.map((e) => e.born)).toEqual([2, 3, 4]);
    expect(addEffect([], text(0), 0)).toEqual([]);
  });

  it('does not mutate the input list', () => {
    const list = Object.freeze([text(0)]) as readonly Effect[];
    expect(() => addEffect(list, text(1))).not.toThrow();
    expect(list).toHaveLength(1);
  });

  it('has a sane default cap', () => {
    let list: Effect[] = [];
    for (let i = 0; i < MAX_EFFECTS + 50; i++) list = addEffect(list, text(i));
    expect(list).toHaveLength(MAX_EFFECTS);
    expect(list[0]!.born).toBe(50);
  });

  it('ages from 0 to 1 and clamps', () => {
    expect(effectProgress(text(100), 100)).toBe(0);
    expect(effectProgress(text(100), 150)).toBe(0.5);
    expect(effectProgress(text(100), 999)).toBe(1);
    expect(effectProgress(text(100), 50)).toBe(0);
    expect(effectProgress(text(0, 0), 0)).toBe(1);
  });

  it('expires effects at their ttl and keeps the same array when nothing expired', () => {
    const list = [text(0, 100), text(50, 100)];
    expect(pruneEffects(list, 99)).toBe(list);
    expect(pruneEffects(list, 100).map((e) => e.born)).toEqual([50]);
    expect(pruneEffects(list, 1000)).toEqual([]);
  });

  it('every effect kind has a positive default ttl', () => {
    for (const v of Object.values(EFFECT_TTL)) expect(v).toBeGreaterThan(0);
  });
});

describe('hitFlashes', () => {
  it('maps enemies to the strongest live flash intensity', () => {
    const m = hitFlashes([flash(1, 0), flash(1, 50), flash(2, 0), text(0)], 60);
    expect(m.get(1)).toBeCloseTo(0.9);
    expect(m.get(2)).toBeCloseTo(0.4);
    expect(hitFlashes([flash(1, 0)], 100).has(1)).toBe(false);
  });
});

describe('drawEffects', () => {
  it('draws every kind without throwing and resets globalAlpha', () => {
    const target: Record<string, unknown> = { globalAlpha: 1 };
    const ctx = new Proxy(target, {
      get: (t, k) =>
        k in t
          ? t[k as string]
          : typeof k === 'string' && k.startsWith('create')
            ? () => ({ addColorStop: () => undefined })
            : () => undefined,
      set: (t, k, v) => {
        t[k as string] = v;
        return true;
      },
    }) as unknown as CanvasRenderingContext2D;
    const pos = { x: 10, y: 10 };
    const all: Effect[] = [
      flash(1, 0),
      { kind: 'spark', pos, color: '#fff', seed: 1, born: 0, ttl: 100 },
      { kind: 'puff', pos, radius: 8, color: '#f00', seed: 2, born: 0, ttl: 100 },
      { kind: 'muzzle', pos, angle: 1, size: 6, born: 0, ttl: 100 },
      text(0),
    ];
    expect(() => drawEffects(ctx, all, 50)).not.toThrow();
    expect(target.globalAlpha).toBe(1);
  });
});

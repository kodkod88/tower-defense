import { describe, expect, it } from 'vitest';
import type { MapDef } from '../../src/core/types';
import { content } from '../../src/data';
import {
  createMapLayerCache,
  endDirection,
  grassCell,
  hash2,
  samplePath,
  valueNoise,
  type LayerFactory,
} from '../../src/render/mapArt';
import { deepFreeze } from './fixtures';

describe('hash2 / valueNoise', () => {
  it('is deterministic and in [0, 1)', () => {
    for (let i = 0; i < 200; i++) {
      const h = hash2(i, i * 7 - 50, i % 3);
      expect(h).toBe(hash2(i, i * 7 - 50, i % 3));
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
      const n = valueNoise(i * 0.37, i * 1.3, 4, 1);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });

  it('varies with coordinates and salt', () => {
    const values = new Set<number>();
    for (let x = 0; x < 10; x++) for (let y = 0; y < 10; y++) values.add(hash2(x, y));
    expect(values.size).toBe(100);
    expect(hash2(3, 4, 0)).not.toBe(hash2(3, 4, 1));
  });

  it('matches the lattice hash at integer lattice points', () => {
    expect(valueNoise(8, 12, 4, 5)).toBeCloseTo(hash2(2, 3, 5), 12);
  });
});

describe('grassCell', () => {
  it('is identical across calls (same look every load)', () => {
    expect(grassCell(5, 9, 40)).toEqual(grassCell(5, 9, 40));
  });

  it('keeps decorations inside the cell and gives a hex base color', () => {
    for (let col = 0; col < 24; col++) {
      for (let row = 0; row < 16; row++) {
        const c = grassCell(col, row, 40);
        expect(c.color).toMatch(/^#[0-9a-f]{6}$/);
        for (const d of c.decorations) {
          expect(d.x).toBeGreaterThanOrEqual(0);
          expect(d.x).toBeLessThanOrEqual(40);
          expect(d.y).toBeGreaterThanOrEqual(0);
          expect(d.y).toBeLessThanOrEqual(40);
        }
      }
    }
  });

  it('produces some variety (not every cell the same)', () => {
    const colors = new Set<string>();
    let flowers = 0;
    for (let col = 0; col < 24; col++) {
      for (let row = 0; row < 16; row++) {
        const c = grassCell(col, row, 40);
        colors.add(c.color);
        flowers += c.decorations.filter((d) => d.kind === 'flower').length;
      }
    }
    expect(colors.size).toBeGreaterThan(20);
    expect(flowers).toBeGreaterThan(0);
  });
});

describe('path helpers', () => {
  const path = [
    { x: 0, y: 0 },
    { x: 20, y: 0 },
    { x: 20, y: 10 },
  ];

  it('samples points along each segment with its direction', () => {
    const s = samplePath(path, 5);
    expect(s.map((p) => p.p)).toEqual([
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
      { x: 15, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 5 },
    ]);
    expect(s[0]!.dir).toEqual({ x: 1, y: 0 });
    expect(s[5]!.dir).toEqual({ x: 0, y: 1 });
    expect(samplePath(path, 0)).toEqual([]);
  });

  it('gives entry and exit directions with a fallback for degenerate paths', () => {
    expect(endDirection(path, 'start')).toEqual({ x: 1, y: 0 });
    expect(endDirection(path, 'end')).toEqual({ x: 0, y: 1 });
    expect(endDirection([{ x: 1, y: 1 }], 'start')).toEqual({ x: 1, y: 0 });
  });
});

describe('createMapLayerCache', () => {
  function fakeFactory() {
    let created = 0;
    const factory: LayerFactory = () => {
      created++;
      const ctx = new Proxy(
        {},
        {
          get: (_t, key) =>
            typeof key === 'string' && key.startsWith('create')
              ? () => ({ addColorStop: () => undefined })
              : () => undefined,
          set: () => true,
        },
      );
      return { getContext: () => ctx } as unknown as ReturnType<LayerFactory>;
    };
    return { factory, created: () => created };
  }

  it('renders the static layer once per map and reuses it', () => {
    const f = fakeFactory();
    const cache = createMapLayerCache(f.factory);
    const map = deepFreeze(structuredClone(content.map)) as MapDef;
    const a = cache.get(map);
    expect(a).not.toBeNull();
    expect(cache.get(map)).toBe(a);
    expect(f.created()).toBe(1);
    cache.get({ ...map });
    expect(f.created()).toBe(2);
  });

  it('returns null when no offscreen canvas can be made', () => {
    expect(createMapLayerCache(() => null).get(content.map)).toBeNull();
  });
});

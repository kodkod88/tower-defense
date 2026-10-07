import { describe, expect, it } from 'vitest';
import { map } from '../../src/data/map';
import { isCellOnPath } from '../../src/systems/economy';

// Cells the path runs through, per segment (inclusive of both ends), minus the 6 shared corners.
const PATH_TILES = 6 + 11 + 8 + 9 + 8 + 10 + 5 - 6;

const width = map.cols * map.tileSize;
const height = map.rows * map.tileSize;

describe('map', () => {
  it('has positive dimensions that fill the 960x640 canvas', () => {
    expect(map.cols).toBeGreaterThan(0);
    expect(map.rows).toBeGreaterThan(0);
    expect(map.tileSize).toBeGreaterThan(0);
    expect(map.pathWidth).toBeGreaterThan(0);
    expect(width).toBe(960);
    expect(height).toBe(640);
  });

  it('has at least 2 waypoints, all inside map bounds', () => {
    expect(map.path.length).toBeGreaterThanOrEqual(2);
    for (const p of map.path) {
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(width);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(height);
    }
  });

  it('starts and ends on the map border', () => {
    const onBorder = (p: { x: number; y: number }) =>
      p.x === 0 || p.y === 0 || p.x === width || p.y === height;
    expect(onBorder(map.path[0]!)).toBe(true);
    expect(onBorder(map.path[map.path.length - 1]!)).toBe(true);
  });

  it('uses axis-aligned, non-degenerate segments', () => {
    for (let i = 0; i < map.path.length - 1; i++) {
      const a = map.path[i]!;
      const b = map.path[i + 1]!;
      expect(a.x === b.x || a.y === b.y).toBe(true);
      expect(a.x === b.x && a.y === b.y).toBe(false);
    }
  });

  it('leaves most of the grid buildable (same rule as placement: isCellOnPath)', () => {
    let blocked = 0;
    for (let col = 0; col < map.cols; col++) {
      for (let row = 0; row < map.rows; row++) {
        if (isCellOnPath(map, { col, row })) blocked++;
      }
    }
    // The path is one tile wide: exactly the cells it passes through are blocked.
    expect(blocked).toBe(PATH_TILES);
    expect(blocked).toBeLessThan((map.cols * map.rows) / 4);
  });
});

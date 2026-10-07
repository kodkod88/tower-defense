import { describe, expect, it } from 'vitest';
import {
  cellCenter,
  cellOrigin,
  clientToCanvas,
  pixelToCell,
  sameCell,
} from '../../src/render/grid';

const map = { tileSize: 40, cols: 24, rows: 16 };

describe('clientToCanvas', () => {
  it('offsets by the rect origin', () => {
    const rect = { left: 10, top: 20, width: 960, height: 640 };
    expect(clientToCanvas(110, 70, rect, 960, 640)).toEqual({ x: 100, y: 50 });
  });

  it('scales when the canvas is displayed at a different CSS size', () => {
    const rect = { left: 0, top: 0, width: 480, height: 320 };
    expect(clientToCanvas(240, 160, rect, 960, 640)).toEqual({ x: 480, y: 320 });
  });

  it('does not divide by zero for a zero-size rect', () => {
    const rect = { left: 0, top: 0, width: 0, height: 0 };
    expect(clientToCanvas(5, 6, rect, 960, 640)).toEqual({ x: 5, y: 6 });
  });
});

describe('pixelToCell', () => {
  it('maps pixels to the containing cell', () => {
    expect(pixelToCell({ x: 0, y: 0 }, map)).toEqual({ col: 0, row: 0 });
    expect(pixelToCell({ x: 39.9, y: 40 }, map)).toEqual({ col: 0, row: 1 });
    expect(pixelToCell({ x: 959, y: 639 }, map)).toEqual({ col: 23, row: 15 });
  });

  it('returns null outside the grid', () => {
    expect(pixelToCell({ x: -1, y: 5 }, map)).toBeNull();
    expect(pixelToCell({ x: 5, y: -0.1 }, map)).toBeNull();
    expect(pixelToCell({ x: 960, y: 5 }, map)).toBeNull();
    expect(pixelToCell({ x: 5, y: 640 }, map)).toBeNull();
  });

  it('returns null for a non-positive tile size', () => {
    expect(pixelToCell({ x: 5, y: 5 }, { ...map, tileSize: 0 })).toBeNull();
  });
});

describe('cellCenter / cellOrigin / sameCell', () => {
  it('round-trips through pixelToCell', () => {
    const cell = { col: 3, row: 7 };
    expect(cellCenter(cell, 40)).toEqual({ x: 140, y: 300 });
    expect(cellOrigin(cell, 40)).toEqual({ x: 120, y: 280 });
    expect(pixelToCell(cellCenter(cell, 40), map)).toEqual(cell);
  });

  it('compares cells by value and treats null as never equal', () => {
    expect(sameCell({ col: 1, row: 2 }, { col: 1, row: 2 })).toBe(true);
    expect(sameCell({ col: 1, row: 2 }, { col: 2, row: 1 })).toBe(false);
    expect(sameCell(null, null)).toBe(false);
  });
});

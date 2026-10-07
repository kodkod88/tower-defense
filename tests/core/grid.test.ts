import { describe, expect, it } from 'vitest';
import { cellCenter, isInBounds, tilePathToWorld, worldToCell } from '../../src/core/grid';

describe('grid helpers', () => {
  it('cellCenter returns the middle of the cell', () => {
    expect(cellCenter({ col: 0, row: 0 }, 40)).toEqual({ x: 20, y: 20 });
    expect(cellCenter({ col: 3, row: 2 }, 40)).toEqual({ x: 140, y: 100 });
  });

  it('worldToCell floors and round-trips with cellCenter', () => {
    expect(worldToCell({ x: 39.9, y: 40 }, 40)).toEqual({ col: 0, row: 1 });
    expect(worldToCell({ x: -1, y: 0 }, 40)).toEqual({ col: -1, row: 0 });
    const cell = { col: 7, row: 5 };
    expect(worldToCell(cellCenter(cell, 40), 40)).toEqual(cell);
  });

  it('isInBounds rejects edges, negatives, and fractions', () => {
    expect(isInBounds({ col: 0, row: 0 }, 24, 16)).toBe(true);
    expect(isInBounds({ col: 23, row: 15 }, 24, 16)).toBe(true);
    expect(isInBounds({ col: 24, row: 0 }, 24, 16)).toBe(false);
    expect(isInBounds({ col: 0, row: -1 }, 24, 16)).toBe(false);
    expect(isInBounds({ col: 0.5, row: 0 }, 24, 16)).toBe(false);
  });

  it('tilePathToWorld maps tile waypoints to cell centers', () => {
    expect(
      tilePathToWorld(
        [
          { col: -1, row: 2 },
          { col: 5, row: 2 },
        ],
        40,
      ),
    ).toEqual([
      { x: -20, y: 100 },
      { x: 220, y: 100 },
    ]);
  });
});

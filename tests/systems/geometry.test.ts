import { describe, expect, it } from 'vitest';
import {
  distance,
  distancePathToRect,
  distancePointToRect,
  distanceSegmentToRect,
  distanceSq,
  distanceToPath,
  distanceToSegment,
  moveToward,
  pathLength,
  pointAlongPath,
  segmentsIntersect,
} from '../../src/systems/geometry';

const L = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
];

describe('distance', () => {
  it('computes euclidean and squared distance', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(distanceSq({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(25);
  });
});

describe('distanceToSegment', () => {
  it('projects onto the interior', () => {
    expect(distanceToSegment({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(3);
  });
  it('clamps to endpoints', () => {
    expect(distanceToSegment({ x: -3, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(5);
    expect(distanceToSegment({ x: 13, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(5);
  });
  it('handles zero-length segments', () => {
    expect(distanceToSegment({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(5);
  });
});

describe('distanceToPath', () => {
  it('takes the nearest segment', () => {
    expect(distanceToPath({ x: 12, y: 5 }, L)).toBe(2);
    expect(distanceToPath({ x: 5, y: -1 }, L)).toBe(1);
  });
  it('handles empty and single-point paths', () => {
    expect(distanceToPath({ x: 0, y: 0 }, [])).toBe(Infinity);
    expect(distanceToPath({ x: 3, y: 4 }, [{ x: 0, y: 0 }])).toBe(5);
  });
});

describe('pathLength / pointAlongPath', () => {
  it('measures polyline length', () => {
    expect(pathLength(L)).toBe(20);
    expect(pathLength([{ x: 1, y: 1 }])).toBe(0);
  });
  it('interpolates across segments', () => {
    expect(pointAlongPath(L, 5)).toEqual({ x: 5, y: 0 });
    expect(pointAlongPath(L, 10)).toEqual({ x: 10, y: 0 });
    expect(pointAlongPath(L, 15)).toEqual({ x: 10, y: 5 });
  });
  it('clamps before the start and past the end', () => {
    expect(pointAlongPath(L, -4)).toEqual({ x: 0, y: 0 });
    expect(pointAlongPath(L, 999)).toEqual({ x: 10, y: 10 });
  });
  it('skips duplicate waypoints', () => {
    const dup = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ];
    expect(pointAlongPath(dup, 2)).toEqual({ x: 2, y: 0 });
  });
  it('clamps NaN to the start and Infinity to the end', () => {
    expect(pointAlongPath(L, NaN)).toEqual({ x: 0, y: 0 });
    expect(pointAlongPath(L, Infinity)).toEqual({ x: 10, y: 10 });
    expect(pointAlongPath(L, -Infinity)).toEqual({ x: 0, y: 0 });
  });
  it('rejects an empty path', () => {
    expect(() => pointAlongPath([], 1)).toThrow();
  });
});

describe('moveToward', () => {
  it('steps partway without overshooting', () => {
    expect(moveToward({ x: 0, y: 0 }, { x: 10, y: 0 }, 4)).toEqual({
      pos: { x: 4, y: 0 },
      arrived: false,
    });
  });
  it('snaps to the target when within one step', () => {
    expect(moveToward({ x: 0, y: 0 }, { x: 3, y: 0 }, 4)).toEqual({
      pos: { x: 3, y: 0 },
      arrived: true,
    });
  });
  it('treats negative and NaN steps as 0 (no backwards or NaN movement)', () => {
    const from = { x: 2, y: 0 };
    const to = { x: 10, y: 0 };
    expect(moveToward(from, to, -5)).toEqual({ pos: { x: 2, y: 0 }, arrived: false });
    expect(moveToward(from, to, NaN)).toEqual({ pos: { x: 2, y: 0 }, arrived: false });
    expect(moveToward(from, from, -1)).toEqual({ pos: { x: 2, y: 0 }, arrived: true });
  });
  it('does not mutate inputs', () => {
    const from = { x: 0, y: 0 };
    moveToward(from, { x: 10, y: 0 }, 4);
    expect(from).toEqual({ x: 0, y: 0 });
  });
});

describe('rect helpers', () => {
  const r = { x: 0, y: 0, w: 10, h: 10 };
  it('distancePointToRect is 0 inside/on edge and euclidean outside', () => {
    expect(distancePointToRect({ x: 5, y: 5 }, r)).toBe(0);
    expect(distancePointToRect({ x: 10, y: 3 }, r)).toBe(0);
    expect(distancePointToRect({ x: 13, y: 14 }, r)).toBe(5);
    expect(distancePointToRect({ x: 5, y: -2 }, r)).toBe(2);
  });
  it('segmentsIntersect handles crossing, touching, parallel, and disjoint', () => {
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }, { x: 4, y: 0 })).toBe(
      true,
    );
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 5 })).toBe(
      true,
    );
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 1 }, { x: 4, y: 1 })).toBe(
      false,
    );
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 3, y: 0 }, { x: 4, y: -5 })).toBe(
      false,
    );
  });
  it('distanceSegmentToRect is 0 when the segment passes through, even with both ends outside', () => {
    expect(distanceSegmentToRect({ x: -5, y: 5 }, { x: 15, y: 5 }, r)).toBe(0);
    expect(distanceSegmentToRect({ x: -5, y: -5 }, { x: 15, y: 15 }, r)).toBe(0);
  });
  it('distanceSegmentToRect measures the gap otherwise', () => {
    expect(distanceSegmentToRect({ x: -5, y: 13 }, { x: 15, y: 13 }, r)).toBe(3);
    // Diagonal segment passing near the (10,10) corner.
    expect(distanceSegmentToRect({ x: 20, y: 10 }, { x: 10, y: 20 }, r)).toBeCloseTo(
      Math.SQRT2 * 5,
    );
  });
  it('distancePathToRect takes the nearest segment', () => {
    const path = [
      { x: -20, y: 30 },
      { x: 30, y: 30 },
      { x: 30, y: -10 },
      { x: 12, y: -10 },
      { x: 12, y: 5 },
    ];
    expect(distancePathToRect(path, r)).toBe(2);
    expect(distancePathToRect([], r)).toBe(Infinity);
    expect(distancePathToRect([{ x: 5, y: 5 }], r)).toBe(0);
  });
});

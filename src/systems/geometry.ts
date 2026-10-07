// Pure 2D geometry helpers shared by movement, targeting, projectiles, and placement validity.
import type { Vec2 } from '../core/types';

export function distanceSq(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.sqrt(distanceSq(a, b));
}

/** Shortest distance from point `p` to the segment `a`–`b` (handles zero-length segments). */
export function distanceToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lenSq = abx * abx + aby * aby;
  if (lenSq === 0) return distance(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq));
  return distance(p, { x: a.x + t * abx, y: a.y + t * aby });
}

/** Shortest distance from `p` to a polyline path. Infinity for an empty path. */
export function distanceToPath(p: Vec2, path: readonly Vec2[]): number {
  if (path.length === 0) return Infinity;
  if (path.length === 1) return distance(p, path[0]!);
  let best = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    best = Math.min(best, distanceToSegment(p, path[i]!, path[i + 1]!));
  }
  return best;
}

/** Total length of a polyline path. */
export function pathLength(path: readonly Vec2[]): number {
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) total += distance(path[i]!, path[i + 1]!);
  return total;
}

/**
 * Position at arc-length `d` along the path. Clamped to [0, pathLength]:
 * negative distances and NaN return the start, distances past the end (incl. Infinity) return the last waypoint.
 */
export function pointAlongPath(path: readonly Vec2[], d: number): Vec2 {
  if (path.length === 0) throw new Error('pointAlongPath: empty path');
  const first = path[0]!;
  if (!(d > 0) || path.length === 1) return { x: first.x, y: first.y };
  let remaining = d;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    const seg = distance(a, b);
    if (remaining <= seg) {
      const t = seg === 0 ? 0 : remaining / seg;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    remaining -= seg;
  }
  const last = path[path.length - 1]!;
  return { x: last.x, y: last.y };
}

/**
 * Move `from` toward `to` by at most `maxStep`. Returns the new point and whether `to` was reached.
 * Negative or NaN steps are treated as 0 (never moves backwards).
 */
export function moveToward(from: Vec2, to: Vec2, maxStep: number): { pos: Vec2; arrived: boolean } {
  const step = maxStep > 0 ? maxStep : 0;
  const d = distance(from, to);
  if (d <= step) return { pos: { x: to.x, y: to.y }, arrived: true };
  const t = step / d;
  return {
    pos: { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t },
    arrived: false,
  };
}

/** Axis-aligned rectangle in world pixels. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Distance from `p` to the rectangle (0 if inside or on the edge). */
export function distancePointToRect(p: Vec2, r: Rect): number {
  const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.w));
  const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.h));
  return Math.sqrt(dx * dx + dy * dy);
}

function cross(o: Vec2, a: Vec2, b: Vec2): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/** True if segments p1–p2 and q1–q2 intersect (including touching). */
export function segmentsIntersect(p1: Vec2, p2: Vec2, q1: Vec2, q2: Vec2): boolean {
  const d1 = cross(q1, q2, p1);
  const d2 = cross(q1, q2, p2);
  const d3 = cross(p1, p2, q1);
  const d4 = cross(p1, p2, q2);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  const onSeg = (a: Vec2, b: Vec2, p: Vec2): boolean =>
    Math.min(a.x, b.x) <= p.x &&
    p.x <= Math.max(a.x, b.x) &&
    Math.min(a.y, b.y) <= p.y &&
    p.y <= Math.max(a.y, b.y);
  return (
    (d1 === 0 && onSeg(q1, q2, p1)) ||
    (d2 === 0 && onSeg(q1, q2, p2)) ||
    (d3 === 0 && onSeg(p1, p2, q1)) ||
    (d4 === 0 && onSeg(p1, p2, q2))
  );
}

function rectCorners(r: Rect): Vec2[] {
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.h },
    { x: r.x, y: r.y + r.h },
  ];
}

/** Shortest distance between segment a–b and a rectangle (0 if they touch or overlap). */
export function distanceSegmentToRect(a: Vec2, b: Vec2, r: Rect): number {
  if (distancePointToRect(a, r) === 0 || distancePointToRect(b, r) === 0) return 0;
  const c = rectCorners(r);
  for (let i = 0; i < 4; i++) {
    if (segmentsIntersect(a, b, c[i]!, c[(i + 1) % 4]!)) return 0;
  }
  return Math.min(
    distancePointToRect(a, r),
    distancePointToRect(b, r),
    ...c.map((corner) => distanceToSegment(corner, a, b)),
  );
}

/** Shortest distance between a polyline path and a rectangle. Infinity for an empty path. */
export function distancePathToRect(path: readonly Vec2[], r: Rect): number {
  if (path.length === 0) return Infinity;
  if (path.length === 1) return distancePointToRect(path[0]!, r);
  let best = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    best = Math.min(best, distanceSegmentToRect(path[i]!, path[i + 1]!, r));
  }
  return best;
}

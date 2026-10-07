// Pure screen <-> grid coordinate helpers. No DOM access, so they are unit-testable.
// World <-> cell math comes from core so the UI and the simulation always agree on cells.
import { cellCenter, isInBounds, worldToCell } from '../core/grid';
import type { GridCell, MapDef, Vec2 } from '../core/types';

export { cellCenter };

/** Minimal bounding-rect shape (matches DOMRect) so callers can pass canvas.getBoundingClientRect(). */
export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Convert a mouse event's client coordinates to canvas pixel coordinates,
 * accounting for CSS scaling of the canvas element.
 */
export function clientToCanvas(
  clientX: number,
  clientY: number,
  rect: RectLike,
  canvasWidth: number,
  canvasHeight: number,
): Vec2 {
  const sx = rect.width > 0 ? canvasWidth / rect.width : 1;
  const sy = rect.height > 0 ? canvasHeight / rect.height : 1;
  return { x: (clientX - rect.left) * sx, y: (clientY - rect.top) * sy };
}

/** World pixel -> grid cell, or null when outside the map grid. */
export function pixelToCell(
  p: Vec2,
  map: Pick<MapDef, 'tileSize' | 'cols' | 'rows'>,
): GridCell | null {
  if (map.tileSize <= 0) return null;
  const cell = worldToCell(p, map.tileSize);
  return isInBounds(cell, map.cols, map.rows) ? cell : null;
}

/** Top-left corner of a grid cell in world pixels. */
export function cellOrigin(cell: GridCell, tileSize: number): Vec2 {
  return { x: cell.col * tileSize, y: cell.row * tileSize };
}

export function sameCell(a: GridCell | null, b: GridCell | null): boolean {
  return a !== null && b !== null && a.col === b.col && a.row === b.row;
}

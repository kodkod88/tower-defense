// Grid <-> world conversions. Pure helpers shared by data, systems, and UI.
import type { GridCell, Vec2 } from './types';

/** World-pixel center of a grid cell. */
export function cellCenter(cell: GridCell, tileSize: number): Vec2 {
  return { x: (cell.col + 0.5) * tileSize, y: (cell.row + 0.5) * tileSize };
}

/** Grid cell containing a world point. May be out of bounds; check with isInBounds. */
export function worldToCell(pos: Vec2, tileSize: number): GridCell {
  return { col: Math.floor(pos.x / tileSize), row: Math.floor(pos.y / tileSize) };
}

export function isInBounds(cell: GridCell, cols: number, rows: number): boolean {
  return (
    Number.isInteger(cell.col) &&
    Number.isInteger(cell.row) &&
    cell.col >= 0 &&
    cell.row >= 0 &&
    cell.col < cols &&
    cell.row < rows
  );
}

/**
 * Convert a path authored in tile coordinates to world-pixel waypoints (MapDef.path).
 * Each tile point maps to that cell's center, so { col: 0, row: 2 } -> (tileSize/2, 2.5 * tileSize).
 * Fractional or negative values are allowed, e.g. col -1 to start the path off-screen.
 */
export function tilePathToWorld(tiles: readonly GridCell[], tileSize: number): Vec2[] {
  return tiles.map((t) => cellCenter(t, tileSize));
}

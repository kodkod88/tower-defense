// The single MVP map. Owned by content-designer.
import { tilePathToWorld } from '../core/grid';
import type { MapDef } from '../core/types';

const TILE = 40;
const COLS = 24; // 24 * 40 = 960 px, matches the canvas width in index.html
const ROWS = 16; // 16 * 40 = 640 px, matches the canvas height

/**
 * Snake path in tile coordinates: enters on the left edge at row 2, exits on the right edge at
 * row 13. col -0.5 and col COLS - 0.5 put the end points exactly on the map border (x = 0 and
 * x = 960), so enemies walk in and out of view.
 */
export const map: MapDef = {
  id: 'meadow',
  name: 'Meadow',
  cols: COLS,
  rows: ROWS,
  tileSize: TILE,
  pathWidth: TILE,
  path: tilePathToWorld(
    [
      { col: -0.5, row: 2 },
      { col: 5, row: 2 },
      { col: 5, row: 12 },
      { col: 12, row: 12 },
      { col: 12, row: 4 },
      { col: 19, row: 4 },
      { col: 19, row: 13 },
      { col: COLS - 0.5, row: 13 },
    ],
    TILE,
  ),
};

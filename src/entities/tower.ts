import { TICKS_PER_SECOND } from '../core/types';
import type { EntityId, GameContent, GridCell, Tower, TowerDef, TowerTypeId } from '../core/types';
import { cellCenter } from '../core/grid';
import { getTowerDef } from './defs';

/** New tower centered on `cell`, ready to fire immediately. Does not validate placement. */
export function createTower(
  content: GameContent,
  type: TowerTypeId,
  cell: GridCell,
  id: EntityId,
): Tower {
  getTowerDef(content, type);
  return {
    id,
    type,
    cell: { col: cell.col, row: cell.row },
    pos: cellCenter(cell, content.map.tileSize),
    cooldownTicks: 0,
    targetId: null,
  };
}

/** Ticks between shots for a tower def (at least 1). */
export function cooldownTicksFor(def: TowerDef): number {
  if (!(def.fireRate > 0)) return Number.MAX_SAFE_INTEGER;
  return Math.max(1, Math.round(TICKS_PER_SECOND / def.fireRate));
}

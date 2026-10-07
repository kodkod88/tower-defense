// G6: kill bounties, wave rewards, tower cost check, and placement validity.
import { isInBounds } from '../core/grid';
import type {
  GameContent,
  GameState,
  GridCell,
  MapDef,
  PlacementRejectReason,
  PlacementResult,
  TowerTypeId,
} from '../core/types';
import { createTower } from '../entities/tower';
import { distancePathToRect } from './geometry';
import type { Rect } from './geometry';
import { withEvents } from './events';

/** Pays out this step's enemyKilled bounties and waveCleared rewards. */
export function economySystem(state: GameState, _content: GameContent): GameState {
  let earned = 0;
  for (const e of state.events) {
    if (e.type === 'enemyKilled') earned += e.bounty;
    else if (e.type === 'waveCleared') earned += e.reward;
  }
  return earned === 0 ? state : { ...state, money: state.money + earned };
}

export function cellRect(map: MapDef, cell: GridCell): Rect {
  return {
    x: cell.col * map.tileSize,
    y: cell.row * map.tileSize,
    w: map.tileSize,
    h: map.tileSize,
  };
}

/**
 * True if any part of the cell lies strictly inside the path band (within pathWidth / 2 of the
 * path's center line). Cells that only touch the band's edge are not on the path.
 */
export function isCellOnPath(map: MapDef, cell: GridCell): boolean {
  return distancePathToRect(map.path, cellRect(map, cell)) < map.pathWidth / 2;
}

/** Why the cell itself can't take a tower (ignores tower type and money), or null if it can. */
export function cellBlockReason(
  state: GameState,
  content: GameContent,
  cell: GridCell,
): Extract<PlacementRejectReason, 'outOfBounds' | 'onPath' | 'overlap'> | null {
  const map = content.map;
  if (!isInBounds(cell, map.cols, map.rows)) return 'outOfBounds';
  if (isCellOnPath(map, cell)) return 'onPath';
  if (state.towers.some((t) => t.cell.col === cell.col && t.cell.row === cell.row)) {
    return 'overlap';
  }
  return null;
}

/**
 * Full validation for a placeTower intent. Checks in order: tower type, bounds, path, overlap,
 * money. Game status is not checked here (applyIntent rejects with 'gameOver').
 */
export function canPlaceTower(
  state: GameState,
  content: GameContent,
  towerType: TowerTypeId,
  cell: GridCell,
): PlacementResult {
  const def = content.towers[towerType];
  if (!def) return { ok: false, reason: 'unknownTowerType' };
  const blocked = cellBlockReason(state, content, cell);
  if (blocked) return { ok: false, reason: blocked };
  if (state.money < def.cost) return { ok: false, reason: 'insufficientFunds' };
  return { ok: true };
}

/** Place a tower: pay its cost, add it, emit towerPlaced. Returns state unchanged if canPlaceTower fails. */
export function placeTower(
  state: GameState,
  content: GameContent,
  towerType: TowerTypeId,
  cell: GridCell,
): GameState {
  if (!canPlaceTower(state, content, towerType, cell).ok) return state;
  const cost = content.towers[towerType]!.cost;
  const tower = createTower(content, towerType, cell, state.nextId);
  return withEvents(
    {
      ...state,
      money: state.money - cost,
      towers: [...state.towers, tower],
      nextId: state.nextId + 1,
    },
    [{ type: 'towerPlaced', towerId: tower.id, towerType, cell: tower.cell, cost }],
  );
}

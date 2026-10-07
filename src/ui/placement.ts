// Pure placement-preview and click logic for R4. No DOM.
import type {
  GameContent,
  GameState,
  GridCell,
  PlacementRejectReason,
  PlacementResult,
  PlayerIntent,
  TowerTypeId,
} from '../core/types';
import { canPlaceTower } from '../systems';

/**
 * Placement check. Defaults to gameplay's canPlaceTower (the same check applyIntent runs).
 * A boolean-returning adapter is still accepted for compatibility, but then no reason is shown.
 */
export type CanPlaceFn = (
  state: Readonly<GameState>,
  content: GameContent,
  towerType: TowerTypeId,
  cell: GridCell,
) => PlacementResult | boolean;

export type PreviewRejectReason = PlacementRejectReason | 'gameOver';
export type PreviewResult = { ok: true } | { ok: false; reason: PreviewRejectReason | null };

/** Placement preview: rejects once the game is over, otherwise defers to the placement check. */
export function previewPlacement(
  state: Readonly<GameState>,
  content: GameContent,
  towerType: TowerTypeId,
  cell: GridCell,
  canPlace: CanPlaceFn = canPlaceTower,
): PreviewResult {
  if (state.status === 'won' || state.status === 'lost') return { ok: false, reason: 'gameOver' };
  const r = canPlace(state, content, towerType, cell);
  if (typeof r === 'boolean') return r ? { ok: true } : { ok: false, reason: null };
  return r;
}

const REASON_TEXT: Record<PreviewRejectReason, string> = {
  unknownTowerType: 'Unknown tower',
  insufficientFunds: 'Not enough money',
  outOfBounds: 'Off the map',
  onPath: "Can't build on the path",
  overlap: 'Cell occupied',
  gameOver: 'Game over',
};

/** Short player-facing label for a rejected preview, or null when valid / no reason known. */
export function previewReasonText(result: PreviewResult): string | null {
  if (result.ok || result.reason === null) return null;
  return REASON_TEXT[result.reason];
}

/** Intent for a left click on `cell`, or null when nothing should be sent. */
export function clickIntent(
  selected: TowerTypeId | null,
  cell: GridCell | null,
  valid: boolean,
): PlayerIntent | null {
  if (!selected || !cell || !valid) return null;
  return { type: 'placeTower', towerType: selected, cell: { col: cell.col, row: cell.row } };
}

export interface TowerButton {
  id: TowerTypeId;
  label: string;
  hotkey: string;
  selected: boolean;
  affordable: boolean;
}

/** Toolbar model: one button per tower type, in content order, hotkeys 1..9. */
export function towerButtons(
  state: Readonly<GameState>,
  content: GameContent,
  selected: TowerTypeId | null,
): TowerButton[] {
  return Object.values(content.towers).map((def, i) => ({
    id: def.id,
    label: `${def.name} $${def.cost}`,
    hotkey: String(i + 1),
    selected: def.id === selected,
    affordable: state.money >= def.cost,
  }));
}

/** Tower id for a number hotkey ('1' -> first tower), or null. */
export function towerForHotkey(key: string, content: GameContent): TowerTypeId | null {
  const n = Number.parseInt(key, 10);
  if (!Number.isInteger(n) || n < 1 || String(n) !== key) return null;
  return Object.keys(content.towers)[n - 1] ?? null;
}

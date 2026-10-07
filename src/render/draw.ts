// Pure drawing helpers (no canvas access) so their math can be unit-tested.
import type { Enemy, GameContent, Tower } from '../core/types';
import { PALETTE, withAlpha } from './theme';

export const COLORS = {
  grass: PALETTE.grass,
  grassAlt: PALETTE.grassLight,
  gridLine: 'rgba(255,240,200,0.05)',
  pathEdge: PALETTE.dirtDark,
  path: PALETTE.dirt,
  spawn: PALETTE.success,
  exit: PALETTE.danger,
  hpBack: 'rgba(20,10,6,0.85)',
  hpGood: PALETTE.success,
  hpMid: PALETTE.gold,
  hpLow: PALETTE.danger,
  projectile: '#fff3b0',
  previewValid: withAlpha(PALETTE.success, 0.35),
  previewInvalid: withAlpha(PALETTE.danger, 0.4),
  rangeValid: 'rgba(255,240,200,0.10)',
  rangeInvalid: withAlpha(PALETTE.danger, 0.12),
  rangeStroke: 'rgba(255,240,200,0.45)',
} as const;

const FALLBACK_ENEMY_COLORS = ['#e57373', '#ba68c8', '#4dd0e1', '#ff8a65'];
const FALLBACK_TOWER_COLORS = ['#42a5f5', '#ffa726', '#ab47bc', '#26a69a'];

/** Health in [0, 1]; safe for maxHp <= 0 and overkill. */
export function healthFraction(hp: number, maxHp: number): number {
  if (maxHp <= 0) return 0;
  return Math.min(1, Math.max(0, hp / maxHp));
}

export function healthColor(fraction: number): string {
  if (fraction > 0.6) return COLORS.hpGood;
  if (fraction > 0.3) return COLORS.hpMid;
  return COLORS.hpLow;
}

/** Stable color for a type id: the content's hint if present, else a fallback by key order. */
function colorFor(
  id: string,
  defs: Record<string, { color?: string }>,
  fallback: readonly string[],
): string {
  const hint = defs[id]?.color;
  if (hint) return hint;
  const idx = Math.max(0, Object.keys(defs).indexOf(id));
  return fallback[idx % fallback.length]!;
}

export function enemyColor(enemy: Pick<Enemy, 'type'>, content: GameContent): string {
  return colorFor(enemy.type, content.enemies, FALLBACK_ENEMY_COLORS);
}

export function towerColor(tower: Pick<Tower, 'type'>, content: GameContent): string {
  return colorFor(tower.type, content.towers, FALLBACK_TOWER_COLORS);
}

/** Enemy draw radius: the def's radius, or a default when the type is unknown. */
export function enemyRadius(enemy: Pick<Enemy, 'type'>, content: GameContent): number {
  return content.enemies[enemy.type]?.radius ?? 8;
}

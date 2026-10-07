// Safe lookups into content definitions. Unknown ids are a content bug, so they throw.
import type { EnemyDef, EnemyTypeId, GameContent, TowerDef, TowerTypeId } from '../core/types';

export function getEnemyDef(content: GameContent, type: EnemyTypeId): EnemyDef {
  const def = content.enemies[type];
  if (!def) throw new Error(`Unknown enemy type: ${type}`);
  return def;
}

export function getTowerDef(content: GameContent, type: TowerTypeId): TowerDef {
  const def = content.towers[type];
  if (!def) throw new Error(`Unknown tower type: ${type}`);
  return def;
}

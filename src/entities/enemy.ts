import type { EnemyTypeId, EntityId, Enemy, GameContent } from '../core/types';
import { getEnemyDef } from './defs';

/** New enemy at the first path waypoint, walking toward the second. */
export function createEnemy(content: GameContent, type: EnemyTypeId, id: EntityId): Enemy {
  const def = getEnemyDef(content, type);
  const start = content.map.path[0];
  if (!start) throw new Error('Map path is empty');
  return {
    id,
    type,
    pos: { x: start.x, y: start.y },
    hp: def.maxHp,
    maxHp: def.maxHp,
    speed: def.speed,
    waypointIndex: 1,
    distance: 0,
  };
}

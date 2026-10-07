import type { EntityId, Projectile, Tower, TowerDef } from '../core/types';

/** New homing projectile leaving the tower's center toward `targetId`. */
export function createProjectile(
  tower: Tower,
  def: TowerDef,
  targetId: EntityId,
  id: EntityId,
): Projectile {
  return {
    id,
    towerId: tower.id,
    targetId,
    pos: { x: tower.pos.x, y: tower.pos.y },
    damage: def.damage,
    speed: def.projectileSpeed,
  };
}

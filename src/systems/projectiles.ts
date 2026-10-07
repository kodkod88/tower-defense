// G3: homing projectiles travel toward their target, deal damage on hit, and dead enemies are removed.
import { DT_SECONDS } from '../core/types';
import type { Enemy, GameContent, GameEvent, GameState, Projectile } from '../core/types';
import { getEnemyDef } from '../entities/defs';
import { distance, moveToward } from './geometry';
import { withEvents } from './events';

/**
 * Per projectile, in array order:
 * - target gone or already dead this tick: the projectile fizzles (removed, no hit);
 * - otherwise it moves speed * DT_SECONDS toward the target's current position and hits if it
 *   arrives or ends within the target's radius.
 * Hits subtract damage. Enemies at hp <= 0 are removed once, with one enemyKilled event carrying
 * the bounty (economySystem pays it).
 */
export function projectilesSystem(state: GameState, content: GameContent): GameState {
  if (state.projectiles.length === 0) return state;
  const hp = new Map<number, number>(state.enemies.map((e) => [e.id, e.hp]));
  const byId = new Map<number, Enemy>(state.enemies.map((e) => [e.id, e]));
  const events: GameEvent[] = [];
  const flying: Projectile[] = [];

  for (const p of state.projectiles) {
    const target = byId.get(p.targetId);
    const targetHp = hp.get(p.targetId);
    if (!target || targetHp === undefined || targetHp <= 0) continue;
    const { pos, arrived } = moveToward(p.pos, target.pos, p.speed * DT_SECONDS);
    const radius = getEnemyDef(content, target.type).radius;
    if (arrived || distance(pos, target.pos) <= radius) {
      hp.set(target.id, targetHp - p.damage);
      events.push({
        type: 'projectileHit',
        projectileId: p.id,
        targetId: target.id,
        damage: p.damage,
      });
    } else {
      flying.push({ ...p, pos });
    }
  }

  const enemies: Enemy[] = [];
  for (const e of state.enemies) {
    const newHp = hp.get(e.id)!;
    if (newHp <= 0) {
      const bounty = getEnemyDef(content, e.type).bounty;
      events.push({ type: 'enemyKilled', enemyId: e.id, enemyType: e.type, bounty });
    } else {
      enemies.push(newHp === e.hp ? e : { ...e, hp: newHp });
    }
  }

  return withEvents({ ...state, enemies, projectiles: flying }, events);
}

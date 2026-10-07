// G2: each tower targets the nearest enemy in range and fires a projectile when its cooldown is ready.
import type {
  Enemy,
  GameContent,
  GameEvent,
  GameState,
  Projectile,
  Tower,
  Vec2,
} from '../core/types';
import { getTowerDef } from '../entities/defs';
import { cooldownTicksFor } from '../entities/tower';
import { createProjectile } from '../entities/projectile';
import { distanceSq } from './geometry';
import { withEvents } from './events';

/**
 * Nearest living enemy whose center is within `range` of `from` (inclusive).
 * Ties go to the lowest id so the result is deterministic.
 */
export function findNearestInRange(
  from: Vec2,
  range: number,
  enemies: readonly Enemy[],
): Enemy | null {
  const rangeSq = range * range;
  let best: Enemy | null = null;
  let bestD = Infinity;
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    const d = distanceSq(from, e.pos);
    if (d > rangeSq) continue;
    if (d < bestD || (d === bestD && best !== null && e.id < best.id)) {
      best = e;
      bestD = d;
    }
  }
  return best;
}

/**
 * Per tower, in array order: tick the cooldown down, pick the nearest enemy in range,
 * and if ready, fire (spawn a projectile, reset the cooldown, emit projectileFired).
 */
export function targetingSystem(state: GameState, content: GameContent): GameState {
  if (state.towers.length === 0) return state;
  let nextId = state.nextId;
  const projectiles: Projectile[] = [];
  const events: GameEvent[] = [];
  const towers = state.towers.map((tower): Tower => {
    const def = getTowerDef(content, tower.type);
    const cooldownTicks = Math.max(0, tower.cooldownTicks - 1);
    const target = findNearestInRange(tower.pos, def.range, state.enemies);
    if (!target) return { ...tower, cooldownTicks, targetId: null };
    if (cooldownTicks > 0) return { ...tower, cooldownTicks, targetId: target.id };
    const p = createProjectile(tower, def, target.id, nextId++);
    projectiles.push(p);
    events.push({
      type: 'projectileFired',
      projectileId: p.id,
      towerId: tower.id,
      targetId: target.id,
    });
    return { ...tower, cooldownTicks: cooldownTicksFor(def), targetId: target.id };
  });
  return withEvents(
    { ...state, towers, nextId, projectiles: [...state.projectiles, ...projectiles] },
    events,
  );
}

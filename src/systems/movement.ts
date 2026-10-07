// G1: enemies walk along the map path. Enemies that reach the exit leak (see leaks.ts).
import { DT_SECONDS } from '../core/types';
import type { Enemy, GameContent, GameState, Vec2 } from '../core/types';
import { distance } from './geometry';
import { resolveLeaks } from './leaks';

/** Advance one enemy by `step` pixels along `path`. waypointIndex === path.length means it reached the exit. */
export function advanceEnemy(enemy: Enemy, path: readonly Vec2[], step: number): Enemy {
  let { x, y } = enemy.pos;
  let wi = enemy.waypointIndex;
  let walked = enemy.distance;
  let remaining = Math.max(0, step);
  while (remaining > 0 && wi < path.length) {
    const target = path[wi]!;
    const d = distance({ x, y }, target);
    if (d <= remaining) {
      x = target.x;
      y = target.y;
      remaining -= d;
      walked += d;
      wi++;
    } else {
      const t = remaining / d;
      x += (target.x - x) * t;
      y += (target.y - y) * t;
      walked += remaining;
      remaining = 0;
    }
  }
  return { ...enemy, pos: { x, y }, waypointIndex: wi, distance: walked };
}

export function hasReachedExit(enemy: Enemy, path: readonly Vec2[]): boolean {
  return enemy.waypointIndex >= path.length;
}

/** Moves every enemy by speed * DT_SECONDS, then removes enemies at the exit (enemyLeaked; winLoseSystem charges lives). */
export function movementSystem(state: GameState, content: GameContent): GameState {
  if (state.enemies.length === 0) return state;
  const path = content.map.path;
  const enemies = state.enemies.map((e) => advanceEnemy(e, path, e.speed * DT_SECONDS));
  return resolveLeaks({ ...state, enemies }, content);
}

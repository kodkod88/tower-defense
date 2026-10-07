// G5 (part): enemies that reached the exit are removed with an enemyLeaked event.
// Lives are deducted from those events by winLoseSystem (see DECISIONS.md, C1).
import type { GameContent, GameEvent, GameState } from '../core/types';
import { getEnemyDef } from '../entities/defs';
import { withEvents } from './events';

/** Remove enemies whose waypointIndex is past the last waypoint and emit enemyLeaked for each. */
export function resolveLeaks(state: GameState, content: GameContent): GameState {
  const pathLen = content.map.path.length;
  const events: GameEvent[] = [];
  const enemies = state.enemies.filter((e) => {
    if (e.waypointIndex < pathLen) return true;
    const livesCost = getEnemyDef(content, e.type).livesCost;
    events.push({ type: 'enemyLeaked', enemyId: e.id, enemyType: e.type, livesCost });
    return false;
  });
  if (events.length === 0) return state;
  return withEvents({ ...state, enemies }, events);
}

// G4: spawns enemies from the current WaveDef over time and detects when the wave is cleared.
import { TICKS_PER_SECOND } from '../core/types';
import type {
  Enemy,
  GameContent,
  GameEvent,
  GameState,
  IntentRejectReason,
  SpawnGroup,
} from '../core/types';
import { createEnemy } from '../entities/enemy';
import { withEvents } from './events';

export function secondsToTicks(seconds: number): number {
  return Math.max(0, Math.round(seconds * TICKS_PER_SECOND));
}

/** How many enemies of `group` should have spawned once `elapsedTicks` ticks have passed (spawn k happens at delay + k*interval). */
export function dueCount(group: SpawnGroup, elapsedTicks: number): number {
  const delay = secondsToTicks(group.delay);
  if (group.count <= 0 || elapsedTicks < delay) return 0;
  const interval = secondsToTicks(group.interval);
  if (interval === 0) return group.count;
  return Math.min(group.count, Math.floor((elapsedTicks - delay) / interval) + 1);
}

export type StartWaveCheck =
  | { ok: true }
  | {
      ok: false;
      reason: Extract<IntentRejectReason, 'gameOver' | 'waveInProgress' | 'noMoreWaves'>;
    };

export function canStartWave(state: GameState, content: GameContent): StartWaveCheck {
  if (state.status === 'won' || state.status === 'lost') return { ok: false, reason: 'gameOver' };
  if (state.wave.active) return { ok: false, reason: 'waveInProgress' };
  if (state.wave.index + 1 >= content.waves.length) return { ok: false, reason: 'noMoreWaves' };
  return { ok: true };
}

/** Start the next wave: status 'playing', reset wave timers, emit waveStarted. Unchanged state if not allowed. */
export function startWave(state: GameState, content: GameContent): GameState {
  if (!canStartWave(state, content).ok) return state;
  const index = state.wave.index + 1;
  const def = content.waves[index]!;
  return withEvents(
    {
      ...state,
      status: 'playing',
      wave: { index, active: true, elapsedTicks: 0, spawned: def.groups.map(() => 0) },
    },
    [{ type: 'waveStarted', waveIndex: index }],
  );
}

/**
 * While a wave is active: spawn every enemy that is due (groups in order), then advance
 * elapsedTicks. Once every group is fully spawned and no enemies remain, the wave ends with
 * a waveCleared event (economySystem pays the reward).
 */
export function wavesSystem(state: GameState, content: GameContent): GameState {
  if (!state.wave.active) return state;
  const def = content.waves[state.wave.index];
  if (!def) return { ...state, wave: { ...state.wave, active: false } };

  let nextId = state.nextId;
  const spawnedEnemies: Enemy[] = [];
  const events: GameEvent[] = [];
  const spawned = def.groups.map((group, g) => {
    const already = state.wave.spawned[g] ?? 0;
    const due = dueCount(group, state.wave.elapsedTicks);
    for (let k = already; k < due; k++) {
      const enemy = createEnemy(content, group.enemy, nextId++);
      spawnedEnemies.push(enemy);
      events.push({ type: 'enemySpawned', enemyId: enemy.id, enemyType: enemy.type });
    }
    return Math.max(already, due);
  });

  const enemies = [...state.enemies, ...spawnedEnemies];
  const allSpawned = def.groups.every((group, g) => spawned[g]! >= Math.max(0, group.count));
  const cleared = allSpawned && enemies.length === 0;
  if (cleared) {
    events.push({ type: 'waveCleared', waveIndex: state.wave.index, reward: def.reward ?? 0 });
  }

  return withEvents(
    {
      ...state,
      enemies,
      nextId,
      wave: {
        ...state.wave,
        active: !cleared,
        elapsedTicks: state.wave.elapsedTicks + 1,
        spawned,
      },
    },
    events,
  );
}

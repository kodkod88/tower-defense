// U5: turns game events from the runner's EventBus into UI-only effects. Effect state lives here,
// never in GameState. Without a bus, mountUI simply has no effects (everything else still works).
import type { EventBus } from '../core/events';
import type {
  EnemyTypeId,
  EntityId,
  GameContent,
  GameEvent,
  GameState,
  Tower,
  Vec2,
} from '../core/types';
import { enemyColor, enemyRadius, towerColor } from '../render/draw';
import { addEffect, EFFECT_TTL, MAX_EFFECTS, pruneEffects, type Effect } from '../render/effects';
import { towerArchetype } from '../render/sprites';
import { PALETTE } from '../render/theme';

/** What the event mapper needs to know about the world when an event arrives. */
export interface FeedbackLookup {
  /** Position and type of an enemy: current state first, else its last-seen position. */
  enemy(id: EntityId): { pos: Vec2; type: EnemyTypeId } | undefined;
  tower(id: EntityId): Tower | undefined;
}

/** Pure mapping from one game event to the effects it spawns. */
export function effectsForEvent(
  event: GameEvent,
  lookup: FeedbackLookup,
  content: GameContent,
  now: number,
): Effect[] {
  switch (event.type) {
    case 'projectileHit': {
      const out: Effect[] = [
        { kind: 'hitFlash', enemyId: event.targetId, born: now, ttl: EFFECT_TTL.hitFlash },
      ];
      const enemy = lookup.enemy(event.targetId);
      if (enemy) {
        out.push({
          kind: 'spark',
          pos: { ...enemy.pos },
          color: '#fff3b0',
          seed: event.projectileId,
          born: now,
          ttl: EFFECT_TTL.spark,
        });
      }
      return out;
    }
    case 'enemyKilled': {
      const enemy = lookup.enemy(event.enemyId);
      if (!enemy) return [];
      const pos = { ...enemy.pos };
      const out: Effect[] = [
        {
          kind: 'puff',
          pos,
          radius: enemyRadius({ type: event.enemyType }, content),
          color: enemyColor({ type: event.enemyType }, content),
          seed: event.enemyId,
          born: now,
          ttl: EFFECT_TTL.puff,
        },
      ];
      if (event.bounty > 0) {
        out.push({
          kind: 'floatText',
          pos,
          text: `+$${event.bounty}`,
          color: PALETTE.gold,
          born: now,
          ttl: EFFECT_TTL.floatText,
        });
      }
      return out;
    }
    case 'projectileFired': {
      const tower = lookup.tower(event.towerId);
      const target = lookup.enemy(event.targetId);
      if (!tower || !target) return [];
      const angle = Math.atan2(target.pos.y - tower.pos.y, target.pos.x - tower.pos.x);
      const heavy = towerArchetype(tower.type, content.towers[tower.type]) === 'heavy';
      const scale = content.map.tileSize / 40;
      const reach = (heavy ? 25 : 21) * scale;
      return [
        {
          kind: 'muzzle',
          pos: {
            x: tower.pos.x + Math.cos(angle) * reach,
            y: tower.pos.y + Math.sin(angle) * reach,
          },
          angle,
          size: (heavy ? 9 : 6) * scale,
          born: now,
          ttl: EFFECT_TTL.muzzle * (heavy ? 1.6 : 1),
        },
      ];
    }
    case 'towerPlaced': {
      const t = content.map.tileSize;
      const tower = lookup.tower(event.towerId);
      return [
        {
          kind: 'puff',
          pos: tower
            ? { ...tower.pos }
            : { x: (event.cell.col + 0.5) * t, y: (event.cell.row + 0.5) * t },
          radius: t * 0.35,
          color: tower ? towerColor(tower, content) : PALETTE.dirtLight,
          seed: event.towerId,
          born: now,
          ttl: EFFECT_TTL.puff,
        },
      ];
    }
    default:
      return [];
  }
}

export interface Feedback {
  /** Record the frame's state (last-seen enemy positions, restart detection). */
  observe(state: Readonly<GameState>): void;
  /** Live effects at `now`, with expired ones pruned. */
  effects(now: number): readonly Effect[];
  destroy(): void;
}

export interface FeedbackOptions {
  bus: EventBus;
  content: GameContent;
  getState: () => Readonly<GameState>;
  /** Called on every enemyLeaked event (HUD shake / stage flash). */
  onLivesLost?: () => void;
  /** Monotonic clock in ms. */
  clock?: () => number;
  cap?: number;
}

export function createFeedback(opts: FeedbackOptions): Feedback {
  const { bus, content, getState } = opts;
  const clock = opts.clock ?? (() => performance.now());
  const cap = opts.cap ?? MAX_EFFECTS;
  let list: readonly Effect[] = [];
  let lastSeen = new Map<EntityId, { pos: Vec2; type: EnemyTypeId }>();
  let synced: Readonly<GameState> | null = null;
  let lastTick = -1;

  // Remember enemies in the newest state so a kill in a later step can still find its position.
  function sync(state: Readonly<GameState>): void {
    if (state === synced) return;
    synced = state;
    if (state.tick < lastTick) {
      list = [];
      lastSeen = new Map();
    }
    lastTick = state.tick;
    for (const e of state.enemies) lastSeen.set(e.id, { pos: e.pos, type: e.type });
  }

  const lookup: FeedbackLookup = {
    enemy(id) {
      const live = getState().enemies.find((e) => e.id === id);
      return live ? { pos: live.pos, type: live.type } : lastSeen.get(id);
    },
    tower(id) {
      return getState().towers.find((t) => t.id === id);
    },
  };

  const off = bus.onAny((event) => {
    if (event.type === 'enemyLeaked') opts.onLivesLost?.();
    const spawned = effectsForEvent(event, lookup, content, clock());
    for (const e of spawned) list = addEffect(list, e, cap);
    sync(getState());
  });

  return {
    observe(state) {
      sync(state);
      // Rebuild so the map only holds enemies alive this frame (bounded memory).
      lastSeen = new Map(state.enemies.map((e) => [e.id, { pos: e.pos, type: e.type }]));
    },
    effects(now) {
      list = pruneEffects(list, now);
      return list;
    },
    destroy() {
      off();
      list = [];
      lastSeen.clear();
    },
  };
}

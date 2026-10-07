// Typed, synchronous event bus. The simulation itself never uses it: systems record events in
// GameState.events (pure data). The runner dispatches those events here after each step so UI,
// sound, and effects can react without reading the whole state.
import type { GameEvent, GameEventType } from './types';

export type EventOf<T extends GameEventType> = Extract<GameEvent, { type: T }>;
export type EventHandler<T extends GameEventType> = (event: EventOf<T>) => void;
export type Unsubscribe = () => void;

export interface EventBus {
  /** Subscribe to one event type. Returns an unsubscribe function for this subscription only. */
  on<T extends GameEventType>(type: T, handler: EventHandler<T>): Unsubscribe;
  /** Subscribe to every event. */
  onAny(handler: (event: GameEvent) => void): Unsubscribe;
  /**
   * Call matching handlers synchronously: typed handlers first, then onAny, each in subscription
   * order. A throwing handler is reported to `onError` and does not stop other handlers or events.
   */
  emit(event: GameEvent): void;
  /** Emit each event in order. */
  emitAll(events: readonly GameEvent[]): void;
  /** Remove all handlers. */
  clear(): void;
}

export interface EventBusOptions {
  /** Called when a handler throws. Default: console.error. */
  onError?: (error: unknown, event: GameEvent) => void;
}

interface Subscription {
  /** undefined = onAny. */
  type: GameEventType | undefined;
  handler: (event: GameEvent) => void;
}

export function createEventBus(options: EventBusOptions = {}): EventBus {
  const onError =
    options.onError ??
    ((error: unknown, event: GameEvent) =>
      console.error(`Event handler for '${event.type}' threw`, error));
  // Each subscription is its own object, so registering the same handler twice gives two
  // independent subscriptions and each unsubscribe removes only its own.
  let subs: Subscription[] = [];

  function subscribe(sub: Subscription): Unsubscribe {
    subs = [...subs, sub];
    return () => {
      subs = subs.filter((s) => s !== sub);
    };
  }

  function emit(event: GameEvent): void {
    // Snapshot so handlers that (un)subscribe during dispatch don't affect this emit.
    const snapshot = subs;
    const ordered = [
      ...snapshot.filter((s) => s.type === event.type),
      ...snapshot.filter((s) => s.type === undefined),
    ];
    for (const s of ordered) {
      try {
        s.handler(event);
      } catch (error) {
        onError(error, event);
      }
    }
  }

  return {
    on(type, handler) {
      return subscribe({ type, handler: handler as (event: GameEvent) => void });
    },
    onAny(handler) {
      return subscribe({ type: undefined, handler });
    },
    emit,
    emitAll(events) {
      for (const e of events) emit(e);
    },
    clear() {
      subs = [];
    },
  };
}

import { describe, expect, it, vi } from 'vitest';
import { createEventBus } from '../../src/core/events';
import type { GameEvent } from '../../src/core/types';

const killed: GameEvent = { type: 'enemyKilled', enemyId: 1, enemyType: 'runner', bounty: 5 };
const won: GameEvent = { type: 'gameWon' };

describe('event bus', () => {
  it('delivers only matching events, synchronously, with narrowed payloads', () => {
    const bus = createEventBus();
    const bounties: number[] = [];
    bus.on('enemyKilled', (e) => bounties.push(e.bounty));
    bus.emit(won);
    bus.emit(killed);
    expect(bounties).toEqual([5]);
  });

  it('calls handlers in subscription order, typed before onAny', () => {
    const bus = createEventBus();
    const order: string[] = [];
    bus.onAny(() => order.push('any'));
    bus.on('gameWon', () => order.push('a'));
    bus.on('gameWon', () => order.push('b'));
    bus.emit(won);
    expect(order).toEqual(['a', 'b', 'any']);
  });

  it('unsubscribe stops delivery', () => {
    const bus = createEventBus();
    const h = vi.fn();
    const off = bus.on('gameWon', h);
    const offAny = bus.onAny(h);
    off();
    offAny();
    bus.emit(won);
    expect(h).not.toHaveBeenCalled();
  });

  it('emitAll preserves order and clear removes everything', () => {
    const bus = createEventBus();
    const seen: string[] = [];
    bus.onAny((e) => seen.push(e.type));
    bus.emitAll([killed, won]);
    expect(seen).toEqual(['enemyKilled', 'gameWon']);
    bus.clear();
    bus.emit(won);
    expect(seen).toHaveLength(2);
  });

  it('handlers unsubscribing during emit do not skip others', () => {
    const bus = createEventBus();
    const seen: string[] = [];
    const off = bus.on('gameWon', () => {
      seen.push('first');
      off();
    });
    bus.on('gameWon', () => seen.push('second'));
    bus.emit(won);
    bus.emit(won);
    expect(seen).toEqual(['first', 'second', 'second']);
  });

  it('registering the same handler twice creates independent subscriptions', () => {
    const bus = createEventBus();
    const h = vi.fn();
    const off1 = bus.on('gameWon', h);
    bus.on('gameWon', h);
    off1();
    bus.emit(won);
    expect(h).toHaveBeenCalledTimes(1);
  });

  it('a throwing handler is reported and does not stop other handlers or events', () => {
    const errors: string[] = [];
    const bus = createEventBus({ onError: (_err, e) => errors.push(e.type) });
    const seen: string[] = [];
    bus.on('enemyKilled', () => {
      throw new Error('boom');
    });
    bus.on('enemyKilled', () => seen.push('after'));
    bus.onAny((e) => seen.push(e.type));
    bus.emitAll([killed, won]);
    expect(errors).toEqual(['enemyKilled']);
    expect(seen).toEqual(['after', 'enemyKilled', 'gameWon']);
  });

  it('defaults to console.error for throwing handlers', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bus = createEventBus();
    bus.on('gameWon', () => {
      throw new Error('boom');
    });
    expect(() => bus.emit(won)).not.toThrow();
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });
});

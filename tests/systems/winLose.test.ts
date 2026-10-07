import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../src/core/types';
import { winLoseSystem } from '../../src/systems/winLose';
import { enemy, makeTestContent, playing } from './helpers';

const content = makeTestContent(); // 2 waves
const leak = (livesCost: number, id = 1): GameEvent => ({
  type: 'enemyLeaked',
  enemyId: id,
  enemyType: 'runner',
  livesCost,
});
const midGame = { index: 0, active: true, elapsedTicks: 10, spawned: [1] };
const lastCleared = { index: 1, active: false, elapsedTicks: 500, spawned: [2, 1] };

describe('winLoseSystem', () => {
  it('deducts lives for every leak this step', () => {
    const s = playing(content, { lives: 10, wave: midGame, events: [leak(1, 1), leak(3, 2)] });
    const next = winLoseSystem(s, content);
    expect(next.lives).toBe(6);
    expect(next.status).toBe('playing');
  });

  it('loses at exactly 0 lives and floors overshoot at 0', () => {
    const exact = winLoseSystem(
      playing(content, { lives: 3, wave: midGame, events: [leak(3)] }),
      content,
    );
    expect(exact.status).toBe('lost');
    expect(exact.lives).toBe(0);
    expect(exact.events).toContainEqual({ type: 'gameLost' });
    const over = winLoseSystem(
      playing(content, { lives: 1, wave: midGame, events: [leak(3)] }),
      content,
    );
    expect(over.lives).toBe(0);
    expect(over.status).toBe('lost');
  });

  it('wins once the last wave is cleared and no enemies remain', () => {
    const next = winLoseSystem(playing(content, { wave: lastCleared }), content);
    expect(next.status).toBe('won');
    expect(next.events).toEqual([{ type: 'gameWon' }]);
  });

  it('losing takes priority over winning in the same step', () => {
    const s = playing(content, { lives: 1, wave: lastCleared, events: [leak(1)] });
    expect(winLoseSystem(s, content).status).toBe('lost');
  });

  it('a final leak that leaves lives > 0 still allows the win', () => {
    const s = playing(content, { lives: 5, wave: lastCleared, events: [leak(1)] });
    const next = winLoseSystem(s, content);
    expect(next).toMatchObject({ status: 'won', lives: 4 });
  });

  it('does not win early', () => {
    const between = { index: 0, active: false, elapsedTicks: 99, spawned: [3] };
    expect(winLoseSystem(playing(content, { wave: between }), content).status).toBe('playing');
    expect(
      winLoseSystem(playing(content, { wave: { ...lastCleared, active: true } }), content).status,
    ).toBe('playing');
    expect(
      winLoseSystem(playing(content, { wave: lastCleared, enemies: [enemy(content, 1)] }), content)
        .status,
    ).toBe('playing');
  });

  it('does nothing outside the playing status', () => {
    const s = { ...playing(content, { lives: 0, events: [leak(1)] }), status: 'ready' as const };
    expect(winLoseSystem(s, content)).toBe(s);
  });

  it('returns the same state when nothing happened', () => {
    const s = playing(content, { wave: midGame });
    expect(winLoseSystem(s, content)).toBe(s);
  });
});

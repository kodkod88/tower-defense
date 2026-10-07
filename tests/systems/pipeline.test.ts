// All six gameplay systems run through core's step() (default SYSTEMS, contract order).
import { describe, expect, it } from 'vitest';
import { step } from '../../src/core/loop';
import { createInitialState } from '../../src/core/state';
import type { GameContent, GameState } from '../../src/core/types';
import { placeTower, startWave } from '../../src/systems';
import { makeTestContent } from './helpers';

/** Start waves whenever possible and step until the game ends (or a tick cap). */
function play(state: GameState, content: GameContent, maxTicks = 20_000): GameState {
  let s = state;
  for (let i = 0; i < maxTicks && s.status !== 'won' && s.status !== 'lost'; i++) {
    if (!s.wave.active) s = startWave(s, content);
    s = step(s, content);
  }
  return s;
}

describe('gameplay pipeline', () => {
  it('a defended game is won, with bounties and rewards paid', () => {
    const content = makeTestContent({ startingMoney: 200 });
    let s = createInitialState(content, 1);
    s = placeTower(s, content, 'heavy', { col: 2, row: 1 });
    s = placeTower(s, content, 'rapid', { col: 3, row: 3 });
    expect(s.money).toBe(50);
    const end = play(s, content);
    expect(end.status).toBe('won');
    expect(end.lives).toBe(10);
    // 5 runners * 5 + 1 brute * 15 + wave-0 reward 10 = 50 earned
    expect(end.money).toBe(100);
    expect(end.enemies).toEqual([]);
  });

  it('an undefended game with few lives is lost', () => {
    const content = makeTestContent({ startingLives: 3 });
    const end = play(createInitialState(content, 1), content);
    expect(end.status).toBe('lost');
    expect(end.lives).toBe(0);
  });

  it('is deterministic', () => {
    const content = makeTestContent({ startingMoney: 200 });
    const s = placeTower(createInitialState(content, 7), content, 'rapid', { col: 3, row: 1 });
    expect(play(s, content)).toEqual(play(s, content));
  });
});

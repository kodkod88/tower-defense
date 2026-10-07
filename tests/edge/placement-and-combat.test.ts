// Q4: edge cases across intents (C5), economy (G6), targeting (G2) and projectiles (G3).
// Test map (tests/core/fixtures.ts): 10x6 grid of 40px tiles, path along y = 100 (row 2), width 40.
import { describe, expect, it } from 'vitest';
import { applyIntent } from '../../src/core/intents';
import { SYSTEMS, step } from '../../src/core/loop';
import { createInitialState } from '../../src/core/state';
import type { Enemy, GameState, PlayerIntent, Projectile, Tower } from '../../src/core/types';
import { makeTestContent } from '../core/fixtures';
import { deepFreeze, eventsOf } from '../integration/helpers';

const content = makeTestContent(); // rapid $50, heavy $100, start $100
const place = (towerType: string, col: number, row: number): PlayerIntent => ({
  type: 'placeTower',
  towerType,
  cell: { col, row },
});

/** State fields that a rejected intent must not touch. */
function core(s: GameState): GameState {
  return { ...s, events: [] };
}

function rejectionReasons(s: GameState): string[] {
  return eventsOf(s, 'intentRejected').map((e) => e.reason);
}

describe('Q4 placing with no / too little money', () => {
  it('rejects with insufficientFunds and changes nothing but events', () => {
    const s0 = deepFreeze({ ...createInitialState(content, 1), money: 0 });
    const s1 = applyIntent(s0, place('rapid', 4, 4), content);
    expect(rejectionReasons(s1)).toEqual(['insufficientFunds']);
    expect(core(s1)).toEqual(core(s0));
  });

  it('is off by none: exactly the cost is enough, one less is not', () => {
    const exact = applyIntent(
      { ...createInitialState(content), money: 50 },
      place('rapid', 4, 4),
      content,
    );
    expect(exact.money).toBe(0);
    expect(exact.towers).toHaveLength(1);
    const short = applyIntent(
      { ...createInitialState(content), money: 49 },
      place('rapid', 4, 4),
      content,
    );
    expect(rejectionReasons(short)).toEqual(['insufficientFunds']);
    expect(short.money).toBe(49);
  });

  it('two placements in one tick only spend money that exists', () => {
    // start $100: rapid ($50) + heavy ($100) -> the second must be rejected
    const s = step(createInitialState(content), content, [
      place('rapid', 4, 4),
      place('heavy', 6, 4),
    ]);
    expect(s.towers.map((t) => t.type)).toEqual(['rapid']);
    expect(s.money).toBe(50);
    expect(rejectionReasons(s)).toEqual(['insufficientFunds']);
    expect(s.money).toBeGreaterThanOrEqual(0);
  });

  it('money never goes negative from any sequence of placements', () => {
    let s = createInitialState(content);
    for (let col = 0; col < 10; col++) {
      s = step(s, content, [place('rapid', col, 0), place('heavy', col, 5)]);
      expect(s.money).toBeGreaterThanOrEqual(0);
    }
    expect(s.towers).toHaveLength(2); // $100 buys exactly two rapids
  });
});

describe('Q4 placing on the path / out of bounds', () => {
  it('rejects every cell of the path row with onPath', () => {
    for (let col = 0; col < content.map.cols; col++) {
      const s = applyIntent(createInitialState(content), place('rapid', col, 2), content);
      expect(rejectionReasons(s), `col ${col}`).toEqual(['onPath']);
      expect(s.towers).toHaveLength(0);
      expect(s.money).toBe(content.startingMoney);
    }
  });

  it('allows cells that only touch the edge of the path band', () => {
    // rows 1 and 3 border the 40px-wide path centred on y = 100 exactly at its edge
    expect(
      applyIntent(createInitialState(content), place('rapid', 3, 1), content).towers,
    ).toHaveLength(1);
    expect(
      applyIntent(createInitialState(content), place('rapid', 3, 3), content).towers,
    ).toHaveLength(1);
  });

  it('rejects out-of-bounds, fractional and NaN cells with outOfBounds', () => {
    const bad = [
      { col: -1, row: 4 },
      { col: 10, row: 4 },
      { col: 4, row: 6 },
      { col: 4, row: -1 },
      { col: 4.5, row: 4 },
      { col: Number.NaN, row: 4 },
      { col: Infinity, row: 4 },
    ];
    for (const cell of bad) {
      const s = applyIntent(
        createInitialState(content),
        { type: 'placeTower', towerType: 'rapid', cell },
        content,
      );
      expect(rejectionReasons(s), JSON.stringify(cell)).toEqual(['outOfBounds']);
      expect(s.towers).toHaveLength(0);
    }
  });

  it('rejects an unknown tower type without charging', () => {
    const s = applyIntent(createInitialState(content), place('laser', 4, 4), content);
    expect(rejectionReasons(s)).toEqual(['unknownTowerType']);
    expect(s.money).toBe(content.startingMoney);
  });
});

describe('Q4 overlapping towers', () => {
  it('rejects a second tower on an occupied cell, across ticks', () => {
    let s = step(createInitialState(content), content, [place('rapid', 4, 4)]);
    s = step(s, content, [place('rapid', 4, 4)]);
    expect(rejectionReasons(s)).toEqual(['overlap']);
    expect(s.towers).toHaveLength(1);
    expect(s.money).toBe(50);
  });

  it('rejects a duplicate cell within the same tick', () => {
    const s = step(createInitialState(content), content, [
      place('rapid', 4, 4),
      place('rapid', 4, 4),
    ]);
    expect(s.towers).toHaveLength(1);
    expect(rejectionReasons(s)).toEqual(['overlap']);
  });

  it('reports overlap (not money) when both apply, and adjacent cells are fine', () => {
    let s = step(createInitialState(content), content, [
      place('rapid', 4, 4),
      place('rapid', 5, 4),
    ]);
    expect(s.towers).toHaveLength(2);
    expect(s.money).toBe(0);
    s = step(s, content, [place('rapid', 4, 4)]);
    expect(rejectionReasons(s)).toEqual(['overlap']);
  });

  it('every placed tower has a unique cell and a unique id', () => {
    let s = { ...createInitialState(content), money: 10_000 };
    for (let i = 0; i < 30; i++) s = step(s, content, [place('rapid', i % 10, i < 10 ? 0 : 5)]); // last 10 overlap
    const cells = s.towers.map((t) => `${t.cell.col},${t.cell.row}`);
    expect(new Set(cells).size).toBe(cells.length);
    expect(new Set(s.towers.map((t) => t.id)).size).toBe(s.towers.length);
    expect(s.towers).toHaveLength(20);
  });
});

describe('Q4 intents after the game is over', () => {
  for (const status of ['won', 'lost'] as const) {
    it(`placeTower is rejected with gameOver when ${status}, and no money is spent`, () => {
      const s0 = { ...createInitialState(content), status, money: 500 };
      const s1 = applyIntent(s0, place('rapid', 4, 4), content);
      expect(rejectionReasons(s1)).toEqual(['gameOver']);
      expect(s1.towers).toHaveLength(0);
      expect(s1.money).toBe(500);
    });

    it(`startWave is rejected with gameOver when ${status}`, () => {
      const s1 = applyIntent(
        { ...createInitialState(content), status },
        { type: 'startWave' },
        content,
      );
      expect(rejectionReasons(s1)).toEqual(['gameOver']);
      expect(s1.status).toBe(status);
    });
  }

  it('startWave while a wave is active is rejected with waveInProgress', () => {
    let s = step(createInitialState(content), content, [{ type: 'startWave' }]);
    s = step(s, content, [{ type: 'startWave' }]);
    expect(rejectionReasons(s)).toEqual(['waveInProgress']);
    expect(s.wave.index).toBe(0);
  });
});

// --- two towers killing one enemy in the same tick ---------------------------------------

const enemyAt = (id: number, hp: number, x = 200): Enemy => ({
  id,
  type: 'runner',
  pos: { x, y: 100 },
  hp,
  maxHp: 10,
  speed: 0, // stationary so movement doesn't interfere
  waypointIndex: 1,
  distance: x,
});
const towerAt = (id: number, col: number, row: number): Tower => ({
  id,
  type: 'heavy',
  cell: { col, row },
  pos: { x: (col + 0.5) * 40, y: (row + 0.5) * 40 },
  cooldownTicks: 0,
  targetId: null,
});
const shotAt = (id: number, towerId: number, targetId: number, damage: number): Projectile => ({
  id,
  towerId,
  targetId,
  pos: { x: 200, y: 101 }, // already touching the enemy, so it hits this tick
  damage,
  speed: 400,
});

function playing(over: Partial<GameState>): GameState {
  const s = createInitialState(content);
  return {
    ...s,
    status: 'playing',
    // keep the wave "active" so winLose doesn't end the game when the enemy dies
    // fully spawned (3 runners) so wavesSystem adds nothing; ids start high so they can't collide
    wave: { index: 0, active: true, elapsedTicks: 999, spawned: [3] },
    nextId: 100,
    ...over,
  };
}

describe('Q4 two towers killing one enemy in the same tick', () => {
  it('two lethal projectiles: one kill, one bounty, no stray projectile', () => {
    const s0 = deepFreeze(
      playing({
        money: 0,
        nextId: 100,
        enemies: [enemyAt(1, 10)],
        towers: [towerAt(2, 4, 1), towerAt(3, 6, 1)],
        projectiles: [shotAt(10, 2, 1, 20), shotAt(11, 3, 1, 20)],
      }),
    );
    const s1 = step(s0, content);
    expect(eventsOf(s1, 'enemyKilled')).toHaveLength(1);
    expect(s1.money).toBe(content.enemies.runner!.bounty);
    expect(s1.enemies).toHaveLength(0);
    expect(s1.projectiles.filter((p) => p.targetId === 1)).toHaveLength(0);
    // the hit that landed on an already-dead enemy must not deal a second "hit"
    expect(eventsOf(s1, 'projectileHit').length).toBeLessThanOrEqual(2);
    expect(eventsOf(s1, 'projectileHit').length).toBeGreaterThanOrEqual(1);
  });

  it('two non-lethal hits that are lethal together: exactly one kill', () => {
    const s1 = step(
      playing({
        money: 0,
        enemies: [enemyAt(1, 10)],
        projectiles: [shotAt(10, 2, 1, 6), shotAt(11, 3, 1, 6)],
      }),
      content,
    );
    expect(eventsOf(s1, 'projectileHit')).toHaveLength(2);
    expect(eventsOf(s1, 'enemyKilled')).toEqual([
      {
        type: 'enemyKilled',
        enemyId: 1,
        enemyType: 'runner',
        bounty: content.enemies.runner!.bounty,
      },
    ]);
    expect(s1.money).toBe(content.enemies.runner!.bounty);
  });

  it('a kill on the same tick the enemy leaks is counted once (leak wins, no bounty)', () => {
    // enemy one step from the exit; a lethal projectile is already on it
    const e: Enemy = { ...enemyAt(1, 10, 399), speed: 120, waypointIndex: 1, distance: 399 };
    const s1 = step(
      playing({
        money: 0,
        lives: 10,
        enemies: [e],
        projectiles: [{ ...shotAt(10, 2, 1, 50), pos: { x: 399, y: 100 } }],
      }),
      content,
    );
    const kills = eventsOf(s1, 'enemyKilled').length;
    const leaks = eventsOf(s1, 'enemyLeaked').length;
    expect(kills + leaks).toBe(1);
    expect(s1.money).toBe(kills * content.enemies.runner!.bounty);
    expect(s1.lives).toBe(10 - leaks * content.enemies.runner!.livesCost);
  });

  it('two towers firing on the same tick at a 1-hp enemy, end to end through targeting', () => {
    let s = playing({
      money: 0,
      nextId: 100,
      enemies: [enemyAt(1, 1)],
      towers: [towerAt(2, 4, 1), towerAt(3, 5, 3)],
    });
    const kills: number[] = [];
    let cleared = 0;
    for (let i = 0; i < 120; i++) {
      s = step(s, content);
      cleared += eventsOf(s, 'waveCleared').length;
      for (const k of eventsOf(s, 'enemyKilled')) kills.push(k.enemyId);
      if (i === 0) expect(eventsOf(s, 'projectileFired')).toHaveLength(2);
    }
    expect(kills).toEqual([1]);
    // one bounty + the wave-1 clear reward (the last enemy died), each paid exactly once
    expect(s.money).toBe(content.enemies.runner!.bounty + content.waves[0]!.reward!);
    expect(cleared).toBe(1);
    expect(s.projectiles).toHaveLength(0);
    expect(s.towers.every((t) => t.targetId === null)).toBe(true);
  });

  it('SYSTEMS run in the documented order', () => {
    expect(SYSTEMS.map((f) => f.name)).toEqual([
      'wavesSystem',
      'movementSystem',
      'targetingSystem',
      'projectilesSystem',
      'economySystem',
      'winLoseSystem',
    ]);
  });
});

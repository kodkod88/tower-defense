// Small, stable GameContent for unit tests. Owned by core; anyone may import it.
// Map: 10x6 grid of 40px tiles, straight horizontal path along row 2 (y = 100).
import type { GameContent } from '../../src/core/types';

export function makeTestContent(overrides: Partial<GameContent> = {}): GameContent {
  return {
    enemies: {
      runner: {
        id: 'runner',
        name: 'Runner',
        maxHp: 10,
        speed: 120,
        bounty: 5,
        livesCost: 1,
        radius: 8,
      },
      brute: {
        id: 'brute',
        name: 'Brute',
        maxHp: 60,
        speed: 40,
        bounty: 15,
        livesCost: 3,
        radius: 14,
      },
    },
    towers: {
      rapid: {
        id: 'rapid',
        name: 'Rapid',
        cost: 50,
        range: 100,
        damage: 2,
        fireRate: 4,
        projectileSpeed: 400,
      },
      heavy: {
        id: 'heavy',
        name: 'Heavy',
        cost: 100,
        range: 140,
        damage: 20,
        fireRate: 0.5,
        projectileSpeed: 250,
      },
    },
    map: {
      id: 'test',
      name: 'Test Strip',
      cols: 10,
      rows: 6,
      tileSize: 40,
      path: [
        { x: 0, y: 100 },
        { x: 400, y: 100 },
      ],
      pathWidth: 40,
    },
    waves: [
      { groups: [{ enemy: 'runner', count: 3, interval: 0.5, delay: 0 }], reward: 10 },
      {
        groups: [
          { enemy: 'runner', count: 2, interval: 0.5, delay: 0 },
          { enemy: 'brute', count: 1, interval: 1, delay: 1 },
        ],
      },
    ],
    startingMoney: 100,
    startingLives: 10,
    ...overrides,
  };
}

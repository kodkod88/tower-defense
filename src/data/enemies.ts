// Enemy definitions. Owned by content-designer.
import type { EnemyDef } from '../core/types';

export const runner: EnemyDef = {
  id: 'runner',
  name: 'Runner',
  maxHp: 30,
  speed: 80,
  bounty: 5,
  livesCost: 1,
  radius: 10,
  color: '#e8c547',
};

export const tank: EnemyDef = {
  id: 'tank',
  name: 'Tank',
  maxHp: 180,
  speed: 40,
  bounty: 12,
  livesCost: 2,
  radius: 15,
  color: '#b0413e',
};

export const enemies: Record<string, EnemyDef> = {
  [runner.id]: runner,
  [tank.id]: tank,
};

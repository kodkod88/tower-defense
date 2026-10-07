// Tower definitions. Owned by content-designer.
import type { TowerDef } from '../core/types';

/** Cheap, short range, many small hits. Good against runners. */
export const rapid: TowerDef = {
  id: 'rapid',
  name: 'Rapid',
  cost: 50,
  range: 120,
  damage: 5,
  fireRate: 4,
  projectileSpeed: 480,
  color: '#4fa3e0',
};

/** Expensive, long range, big slow hits. Good against tanks. */
export const heavy: TowerDef = {
  id: 'heavy',
  name: 'Heavy',
  cost: 100,
  range: 160,
  damage: 45,
  fireRate: 0.8,
  projectileSpeed: 320,
  color: '#9b59b6',
};

export const towers: Record<string, TowerDef> = {
  [rapid.id]: rapid,
  [heavy.id]: heavy,
};

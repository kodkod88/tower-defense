// Wave definitions, played in order. Owned by content-designer.
import type { WaveDef } from '../core/types';

export const waves: WaveDef[] = [
  { groups: [{ enemy: 'runner', count: 8, interval: 1.0, delay: 0 }], reward: 20 },
  {
    groups: [
      { enemy: 'runner', count: 10, interval: 0.8, delay: 0 },
      { enemy: 'tank', count: 3, interval: 2.0, delay: 4 },
    ],
    reward: 30,
  },
  {
    groups: [
      { enemy: 'runner', count: 12, interval: 0.7, delay: 0 },
      { enemy: 'tank', count: 6, interval: 1.5, delay: 3 },
    ],
    reward: 40,
  },
  {
    groups: [
      { enemy: 'runner', count: 23, interval: 0.5, delay: 0 },
      { enemy: 'tank', count: 10, interval: 1.2, delay: 2 },
    ],
    reward: 50,
  },
  {
    groups: [
      { enemy: 'runner', count: 26, interval: 0.4, delay: 0 },
      { enemy: 'tank', count: 18, interval: 1.0, delay: 2 },
    ],
  },
];

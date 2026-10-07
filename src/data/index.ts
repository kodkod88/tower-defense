// Tower, enemy, wave, and map config. Owned by content-designer.
import type { GameContent } from '../core/types';
import { enemies } from './enemies';
import { map } from './map';
import { towers } from './towers';
import { waves } from './waves';

export { enemies, map, towers, waves };

export const content: GameContent = {
  enemies,
  towers,
  map,
  waves,
  startingMoney: 100,
  startingLives: 20,
};

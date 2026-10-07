// Pathing, targeting, waves, economy: pure logic only. Owned by gameplay-dev.
// Run order for step(): waves → movement → targeting → projectiles → economy → winLose.
export { wavesSystem, startWave, canStartWave, dueCount, secondsToTicks } from './waves';
export type { StartWaveCheck } from './waves';
export { movementSystem, advanceEnemy, hasReachedExit } from './movement';
export { resolveLeaks } from './leaks';
export { targetingSystem, findNearestInRange } from './targeting';
export { projectilesSystem } from './projectiles';
export {
  economySystem,
  canPlaceTower,
  placeTower,
  cellBlockReason,
  isCellOnPath,
  cellRect,
} from './economy';
export { winLoseSystem } from './winLose';

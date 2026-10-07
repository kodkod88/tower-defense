// QA (Q6): the HUD wave-progress bar over a real game. It must stay in [0, 1], never go backwards
// within a wave, and be null between waves.
import { describe, expect, it } from 'vitest';
import { content as realContent } from '../../src/data';
import { hudView, waveProgress } from '../../src/ui/hud';
import { createInitialState } from '../../src/core/state';
import type { GameContent, PlayerIntent } from '../../src/core/types';
import { autoStartWaves, buildIntents, cellsNearPath, run } from './helpers';

function denseBuild(content: GameContent): PlayerIntent[] {
  const cells = cellsNearPath(content, content.map.tileSize * 2);
  return buildIntents(createInitialState(content, 1), content, cells, ['rapid', 'heavy']);
}

describe('Q6 waveProgress over full games', () => {
  for (const [name, startingMoney, build, outcome] of [
    ['loss (no towers)', realContent.startingMoney, false, 'lost'],
    ['win (dense defence)', 1_000_000, true, 'won'],
  ] as const) {
    it(`${name}: in range, monotonic per wave, null when idle`, () => {
      const content = { ...realContent, startingMoney };
      let prevIndex = -2;
      let prevFrac = -1;
      const { final } = run(content, {
        maxTicks: 60 * 60 * 10,
        script: build ? { 0: denseBuild(content) } : {},
        policy: autoStartWaves(content),
        onStep: (_prev, s) => {
          const p = waveProgress(s, content);
          if (!s.wave.active) {
            expect(p).toBeNull();
            return;
          }
          expect(p).not.toBeNull();
          expect(p!.fraction).toBeGreaterThanOrEqual(0);
          expect(p!.fraction).toBeLessThanOrEqual(1);
          if (s.wave.index !== prevIndex) prevFrac = -1;
          expect(p!.fraction).toBeGreaterThanOrEqual(prevFrac);
          prevIndex = s.wave.index;
          prevFrac = p!.fraction;
          // playtest hooks keep their plain-text format every tick
          const v = hudView(s, content);
          expect(v.money).toMatch(/^\$\d+$/);
          expect(v.lives).toMatch(/^♥ \d+$/);
          expect(v.wave).toMatch(/^Wave \d+\/5$/);
        },
      });
      expect(final.status).toBe(outcome);
    });
  }
});

// QA (Q6): the renderer must never mutate GameState, across every entity mix a real game produces.
// Runs full games with the real content, deep-freezes each sampled state and draws it.
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../src/core/state';
import type { GameContent, GameState } from '../../src/core/types';
import { content as realContent } from '../../src/data';
import { render, type RenderView } from '../../src/render/renderer';
import { autoStartWaves, buildIntents, cellsNearPath, deepFreeze, run } from './helpers';

/**
 * Permissive 2D context stub. Any method returns another stub (so gradients, patterns, image
 * data and measureText-style results all work); property writes are stored. Counts calls.
 */
function stubCtx(): { ctx: CanvasRenderingContext2D; calls: () => number } {
  let count = 0;
  const make = (base: Record<string, unknown>): unknown => {
    const fn = function () {} as unknown as Record<string, unknown>;
    Object.assign(fn, base);
    return new Proxy(fn, {
      get(t, key) {
        if (key in t) return t[key as string];
        if (key === 'width') return 10;
        if (typeof key === 'symbol') return undefined;
        if (key === 'then') return undefined;
        return (..._a: unknown[]) => {
          count++;
          return make({});
        };
      },
      set(t, key, v) {
        t[key as string] = v;
        return true;
      },
      apply() {
        count++;
        return make({});
      },
    });
  };
  const ctx = make({ canvas: { width: 960, height: 640 } }) as CanvasRenderingContext2D;
  return { ctx, calls: () => count };
}

const views: RenderView[] = [
  { selectedTower: null, hoverCell: null, hoverValid: false },
  { selectedTower: 'rapid', hoverCell: { col: 0, row: 0 }, hoverValid: true },
  { selectedTower: 'heavy', hoverCell: { col: 3, row: 3 }, hoverValid: false, hoverReason: 'x' },
  { selectedTower: null, hoverCell: { col: 5, row: 5 }, hoverValid: false },
];

function renderAll(content: GameContent, history: GameState[]): number {
  const { ctx, calls } = stubCtx();
  history.forEach((s, i) => {
    const frozen = deepFreeze(structuredClone(s));
    const view = views[i % views.length]!;
    expect(() => render(ctx, frozen, content, view)).not.toThrow();
  });
  return calls();
}

describe('Q6 renderer is read-only over real games', () => {
  it('draws every 3rd state of a full winning game without mutating frozen state', () => {
    const content: GameContent = { ...realContent, startingMoney: 1_000_000 };
    const initial = createInitialState(content, 1);
    const build = buildIntents(initial, content, cellsNearPath(content, content.map.tileSize * 2), [
      'rapid',
      'heavy',
    ]);
    const { final, history } = run(content, {
      maxTicks: 60 * 60 * 10,
      script: { 0: build },
      policy: autoStartWaves(content),
      keepHistory: true,
    });
    expect(final.status).toBe('won');
    const sampled = history.filter((_, i) => i % 3 === 0 || i === history.length - 1);
    expect(renderAll(content, sampled)).toBeGreaterThan(0);
  });

  it('draws a losing game (no towers, leaks, lives hitting 0) without mutating state', () => {
    const content = realContent;
    const { final, history } = run(content, {
      maxTicks: 60 * 60 * 10,
      policy: autoStartWaves(content),
      keepHistory: true,
    });
    expect(final.status).toBe('lost');
    const sampled = history.filter((_, i) => i % 5 === 0 || i === history.length - 1);
    renderAll(content, sampled);
  });
});

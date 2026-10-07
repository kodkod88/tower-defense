import { describe, expect, it } from 'vitest';
import type { GameState } from '../../src/core/types';
import { createRenderMemory, IDLE_AIM, render } from '../../src/render/renderer';

const EMPTY = { selectedTower: null, hoverCell: null, hoverValid: false };
import { content as realContent } from '../../src/data';
import { deepFreeze, makeContent, makeState } from './fixtures';

/** Records method calls; property writes (fillStyle etc.) are accepted and ignored. */
function mockCtx(): { ctx: CanvasRenderingContext2D; calls: string[] } {
  const calls: string[] = [];
  const target = { canvas: { width: 960, height: 640 } } as Record<string, unknown>;
  const ctx = new Proxy(target, {
    get(t, key) {
      if (key in t) return t[key as string];
      if (key === 'measureText') return (text: string) => ({ width: text.length * 7 });
      if (typeof key === 'string' && key.startsWith('create')) {
        return (..._args: unknown[]) => {
          calls.push(key);
          return { addColorStop: () => undefined };
        };
      }
      return (..._args: unknown[]) => calls.push(String(key));
    },
    set(t, key, value) {
      t[key as string] = value;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

function busyState(): GameState {
  return makeState({
    status: 'playing',
    enemies: [
      {
        id: 1,
        type: 'runner',
        pos: { x: 50, y: 100 },
        hp: 10,
        maxHp: 30,
        speed: 90,
        waypointIndex: 1,
        distance: 50,
      },
    ],
    towers: [
      {
        id: 2,
        type: 'rapid',
        cell: { col: 2, row: 4 },
        pos: { x: 100, y: 180 },
        cooldownTicks: 0,
        targetId: 1,
      },
    ],
    projectiles: [
      { id: 3, towerId: 2, targetId: 1, pos: { x: 80, y: 150 }, damage: 5, speed: 400 },
    ],
  });
}

describe('render', () => {
  it('clears the canvas before drawing the frame', () => {
    const { ctx, calls } = mockCtx();
    render(ctx, makeState(), makeContent());
    expect(calls[0]).toBe('clearRect');
    expect(calls.length).toBeGreaterThan(1);
  });

  it('draws map, entities and preview without mutating deeply frozen state', () => {
    const { ctx, calls } = mockCtx();
    const state = deepFreeze(busyState());
    const view = {
      selectedTower: 'heavy',
      hoverCell: { col: 5, row: 5 },
      hoverValid: false,
      hoverReason: "Can't build on the path",
    };
    expect(() => render(ctx, state, makeContent(), view)).not.toThrow();
    expect(calls).toContain('fillRect');
    expect(calls).toContain('arc');
    expect(calls).toContain('stroke');
  });

  it('tolerates an unknown tower type in the view', () => {
    const { ctx } = mockCtx();
    const view = { selectedTower: 'ghost', hoverCell: { col: 0, row: 0 }, hoverValid: true };
    expect(() => render(ctx, makeState(), makeContent(), view)).not.toThrow();
  });

  it('shows the reason label only for an invalid preview', () => {
    const run = (hoverValid: boolean) => {
      const { ctx, calls } = mockCtx();
      const view = {
        selectedTower: 'rapid',
        hoverCell: { col: 5, row: 4 },
        hoverValid,
        hoverReason: 'Cell occupied',
      };
      render(ctx, makeState(), makeContent(), view);
      return calls;
    };
    expect(run(false)).toContain('fillText');
    expect(run(true)).not.toContain('fillText');
  });
});

describe('render with the real map (R1)', () => {
  const { map } = realContent;

  it('fits the 960x640 canvas declared in index.html', () => {
    expect(map.cols * map.tileSize).toBe(960);
    expect(map.rows * map.tileSize).toBe(640);
  });

  it('draws at least one grass tile per cell and strokes the path (no offscreen canvas in node)', () => {
    const { ctx, calls } = mockCtx();
    render(ctx, deepFreeze(makeState()), realContent);
    const tiles = calls.filter((c) => c === 'fillRect').length;
    expect(tiles).toBeGreaterThanOrEqual(map.cols * map.rows);
    expect(calls.filter((c) => c === 'lineTo').length).toBeGreaterThanOrEqual(map.path.length - 1);
  });
});

describe('render memory through render()', () => {
  it('keeps an idle turret aimed where it last pointed, and resets after a restart', () => {
    const memory = createRenderMemory();
    const { ctx } = mockCtx();
    const s = busyState();
    render(ctx, { ...s, tick: 5 }, makeContent(), { ...EMPTY, memory });
    const aimed = memory.aim.get(2);
    expect(aimed).toBeCloseTo(Math.atan2(100 - 180, 50 - 100));
    const idle = { ...s, tick: 6, towers: [{ ...s.towers[0]!, targetId: null }] };
    render(ctx, idle, makeContent(), { ...EMPTY, memory });
    expect(memory.aim.get(2)).toBe(aimed);
    render(ctx, { ...idle, tick: 0 }, makeContent(), { ...EMPTY, memory });
    expect(memory.aim.get(2)).toBe(IDLE_AIM);
  });
});

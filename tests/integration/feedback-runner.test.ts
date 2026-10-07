// QA (Q6): U5 feedback wired to the REAL runner and event bus over full games (C7 wiring).
// Effects must stay capped, never touch GameState, survive multi-step frames, and reset on restart.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRunner } from '../../src/core/runner';
import { createInitialState } from '../../src/core/state';
import type { GameContent, GameEvent } from '../../src/core/types';
import { FIXED_DT_MS } from '../../src/core/types';
import { content as realContent } from '../../src/data';
import { MAX_EFFECTS } from '../../src/render/effects';
import { render } from '../../src/render/renderer';
import { createFeedback } from '../../src/ui/feedback';
import { buildIntents, cellsNearPath, deepFreeze } from './helpers';

function stubCtx(): CanvasRenderingContext2D {
  const make = (base: Record<string, unknown>): unknown =>
    new Proxy(Object.assign(function () {}, base), {
      get: (t, k) =>
        k in t
          ? (t as Record<string | symbol, unknown>)[k]
          : typeof k === 'symbol' || k === 'then'
            ? undefined
            : k === 'width'
              ? 10
              : () => make({}),
      set: (t, k, v) => (((t as Record<string | symbol, unknown>)[k] = v), true),
    });
  return make({ canvas: { width: 960, height: 640 } }) as CanvasRenderingContext2D;
}

function setup(content: GameContent) {
  const runner = createRunner(content, 1);
  let now = 0;
  let leaks = 0;
  const fb = createFeedback({
    bus: runner.bus,
    content,
    getState: runner.getState,
    onLivesLost: () => leaks++,
    clock: () => now,
  });
  return {
    runner,
    fb,
    leaks: () => leaks,
    advance(ms: number) {
      now += ms;
      runner.update(ms);
    },
    get now() {
      return now;
    },
  };
}

describe('Q6 feedback effects on the real runner + bus', () => {
  // The real bus reports a throwing handler via console.error instead of rethrowing; fail on it.
  let errorSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('a full winning game keeps effects capped, spawns kill effects, and never mutates state', () => {
    const content: GameContent = { ...realContent, startingMoney: 1_000_000 };
    const s = setup(content);
    const events: GameEvent[] = [];
    s.runner.bus.onAny((e) => events.push(e));
    for (const it of buildIntents(
      createInitialState(content, 1),
      content,
      cellsNearPath(content, content.map.tileSize * 2),
      ['rapid', 'heavy'],
    ))
      s.runner.dispatch(it);

    const ctx = stubCtx();
    let maxLive = 0;
    let sawFloatText = false;
    let frames = 0;
    // Uneven frame sizes, including 250ms hitches (many steps and events per frame).
    const sizes = [16.7, 16.7, 33.3, 16.7, 250, 8, 16.7];
    while (s.runner.getState().status !== 'won' && frames < 200_000) {
      const st = s.runner.getState();
      if (!st.wave.active && st.wave.index + 1 < content.waves.length)
        s.runner.dispatch({ type: 'startWave' });
      s.advance(sizes[frames % sizes.length]!);
      const state = s.runner.getState();
      s.fb.observe(state);
      const fx = s.fb.effects(s.now);
      maxLive = Math.max(maxLive, fx.length);
      if (fx.some((e) => e.kind === 'floatText')) sawFloatText = true;
      if (frames % 7 === 0) {
        const frozen = deepFreeze(structuredClone(state));
        render(ctx, frozen, content, {
          selectedTower: null,
          hoverCell: null,
          hoverValid: false,
          effects: fx,
          now: s.now,
        });
      }
      frames++;
    }
    expect(s.runner.getState().status).toBe('won');
    expect(maxLive).toBeGreaterThan(0);
    expect(maxLive).toBeLessThanOrEqual(MAX_EFFECTS);
    expect(sawFloatText).toBe(true);
    expect(events.filter((e) => e.type === 'enemyKilled').length).toBeGreaterThan(0);
    // all effects expire once the game is quiet
    s.advance(5000);
    expect(s.fb.effects(s.now)).toHaveLength(0);
  });

  it('a losing game fires onLivesLost once per leak, and restart clears live effects', () => {
    const content = realContent;
    const s = setup(content);
    let leakEvents = 0;
    s.runner.bus.on('enemyLeaked', () => leakEvents++);
    let frames = 0;
    while (s.runner.getState().status !== 'lost' && frames < 200_000) {
      const st = s.runner.getState();
      if (!st.wave.active && st.wave.index + 1 < content.waves.length)
        s.runner.dispatch({ type: 'startWave' });
      s.advance(50);
      s.fb.observe(s.runner.getState());
      frames++;
    }
    expect(s.runner.getState().status).toBe('lost');
    expect(leakEvents).toBeGreaterThan(0);
    expect(s.leaks()).toBe(leakEvents);

    // Place a tower so there's a fresh effect, then restart within the effect's lifetime.
    s.runner.dispatch({ type: 'restart' });
    s.advance(FIXED_DT_MS);
    s.fb.observe(s.runner.getState());
    const cell = cellsNearPath(content, content.map.tileSize)[0]!;
    s.runner.dispatch({ type: 'placeTower', towerType: 'rapid', cell });
    s.advance(FIXED_DT_MS);
    s.fb.observe(s.runner.getState());
    expect(s.fb.effects(s.now).length).toBeGreaterThan(0);
    s.runner.dispatch({ type: 'restart' });
    s.advance(FIXED_DT_MS);
    s.fb.observe(s.runner.getState());
    expect(s.fb.effects(s.now)).toHaveLength(0);
  });

  it('destroy unsubscribes: later events spawn nothing and do not throw', () => {
    const s = setup(realContent);
    s.fb.destroy();
    s.runner.dispatch({ type: 'startWave' });
    for (let i = 0; i < 300; i++) s.advance(16.7);
    expect(s.fb.effects(s.now)).toHaveLength(0);
  });
});

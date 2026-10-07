import { describe, expect, it } from 'vitest';
import { hudView, waveProgress } from '../../src/ui/hud';
import { deepFreeze, makeContent, makeState } from '../render/fixtures';

const content = makeContent(); // 2 waves
const wave = (index: number, active = false) => ({ index, active, elapsedTicks: 0, spawned: [] });

describe('hudView', () => {
  it('formats money, lives and a 1-based wave counter', () => {
    const v = hudView(makeState({ money: 150, lives: 12, wave: wave(1) }), content);
    expect(v.money).toBe('$150');
    expect(v.lives).toBe('♥ 12');
    expect(v.wave).toBe('Wave 2/2');
  });

  it('shows wave 0 before the first wave', () => {
    expect(hudView(makeState(), content).wave).toBe('Wave 0/2');
  });

  it('clamps negatives and floors fractional money', () => {
    const v = hudView(makeState({ money: 12.7, lives: -3 }), content);
    expect(v.money).toBe('$12');
    expect(v.lives).toBe('♥ 0');
  });

  it('labels the button Start before the first wave and Next afterwards', () => {
    expect(hudView(makeState(), content).startLabel).toBe('Start wave');
    expect(hudView(makeState({ wave: wave(0) }), content).startLabel).toBe('Next wave');
  });

  it('enables the button only when a wave can be started', () => {
    expect(hudView(makeState(), content).startDisabled).toBe(false);
    expect(hudView(makeState({ wave: wave(0) }), content).startDisabled).toBe(false);
    expect(hudView(makeState({ wave: wave(0, true) }), content).startDisabled).toBe(true);
    expect(hudView(makeState({ wave: wave(1) }), content).startDisabled).toBe(true);
    expect(hudView(makeState({ status: 'won' }), content).startDisabled).toBe(true);
    expect(hudView(makeState({ status: 'lost' }), content).startDisabled).toBe(true);
  });

  it('works on deeply frozen state (never mutates)', () => {
    const state = deepFreeze(makeState({ wave: wave(0, true) }));
    expect(Object.isFrozen(state.wave.spawned)).toBe(true);
    expect(() => hudView(state, deepFreeze(makeContent()))).not.toThrow();
  });
});

describe('waveProgress', () => {
  // makeContent: wave 0 = 3 runners, wave 1 per fixture.
  const enemy = (id: number) => ({
    id,
    type: 'runner',
    pos: { x: 0, y: 100 },
    hp: 10,
    maxHp: 10,
    speed: 120,
    waypointIndex: 1,
    distance: 0,
  });

  it('is null when no wave is running', () => {
    expect(waveProgress(makeState(), content)).toBeNull();
    expect(waveProgress(makeState({ wave: wave(0, false) }), content)).toBeNull();
  });

  it('counts resolved enemies (spawned minus alive) over the wave total', () => {
    const total = content.waves[0]!.groups.reduce((n, g) => n + g.count, 0);
    const s = makeState({
      wave: { index: 0, active: true, elapsedTicks: 10, spawned: [2] },
      enemies: [enemy(1)],
    });
    expect(waveProgress(s, content)).toEqual({ fraction: 1 / total, label: `1/${total} enemies` });
    const start = makeState({ wave: { index: 0, active: true, elapsedTicks: 0, spawned: [0] } });
    expect(waveProgress(start, content)?.fraction).toBe(0);
  });

  it('clamps to [0, 1] and survives an unknown wave index', () => {
    const over = makeState({ wave: { index: 0, active: true, elapsedTicks: 0, spawned: [99] } });
    expect(waveProgress(over, content)?.fraction).toBe(1);
    const weird = makeState({
      wave: { index: 0, active: true, elapsedTicks: 0, spawned: [0] },
      enemies: [enemy(1), enemy(2)],
    });
    expect(waveProgress(weird, content)?.fraction).toBe(0);
    expect(
      waveProgress(makeState({ wave: { ...wave(7, true), spawned: [] } }), content),
    ).toBeNull();
  });

  it('reads deeply frozen state', () => {
    const s = deepFreeze(
      makeState({ wave: { index: 0, active: true, elapsedTicks: 0, spawned: [1] } }),
    );
    expect(() => waveProgress(s, content)).not.toThrow();
  });
});

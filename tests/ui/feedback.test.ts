import { describe, expect, it, vi } from 'vitest';
import { createEventBus } from '../../src/core/events';
import type { Enemy, GameEvent, GameState, Tower } from '../../src/core/types';
import { content as realContent } from '../../src/data';
import { createFeedback, effectsForEvent, type FeedbackLookup } from '../../src/ui/feedback';
import { deepFreeze, makeState } from '../render/fixtures';

const enemy = (id: number, x: number, type = 'runner'): Enemy => ({
  id,
  type,
  pos: { x, y: 100 },
  hp: 10,
  maxHp: 30,
  speed: 80,
  waypointIndex: 1,
  distance: 0,
});
const tower = (id: number, type = 'rapid'): Tower => ({
  id,
  type,
  cell: { col: 2, row: 4 },
  pos: { x: 100, y: 180 },
  cooldownTicks: 0,
  targetId: null,
});
const lookupOf = (enemies: Enemy[], towers: Tower[] = []): FeedbackLookup => ({
  enemy: (id) => enemies.find((e) => e.id === id),
  tower: (id) => towers.find((t) => t.id === id),
});

describe('effectsForEvent', () => {
  const c = realContent;

  it('projectileHit -> hit flash on the target plus a spark at its position', () => {
    const fx = effectsForEvent(
      { type: 'projectileHit', projectileId: 9, targetId: 1, damage: 5 },
      lookupOf([enemy(1, 50)]),
      c,
      1000,
    );
    expect(fx.map((e) => e.kind)).toEqual(['hitFlash', 'spark']);
    expect(fx[0]).toMatchObject({ enemyId: 1, born: 1000 });
    expect(fx[1]).toMatchObject({ pos: { x: 50, y: 100 } });
  });

  it('enemyKilled -> death puff and floating +$bounty at the last known position', () => {
    const fx = effectsForEvent(
      { type: 'enemyKilled', enemyId: 1, enemyType: 'tank', bounty: 12 },
      lookupOf([enemy(1, 70, 'tank')]),
      c,
      0,
    );
    expect(fx.map((e) => e.kind)).toEqual(['puff', 'floatText']);
    expect(fx[1]).toMatchObject({ text: '+$12', pos: { x: 70, y: 100 } });
    expect(fx[0]).toMatchObject({ radius: c.enemies.tank!.radius, color: c.enemies.tank!.color });
  });

  it('enemyKilled with an unknown position spawns nothing', () => {
    const e: GameEvent = { type: 'enemyKilled', enemyId: 1, enemyType: 'runner', bounty: 5 };
    expect(effectsForEvent(e, lookupOf([]), c, 0)).toEqual([]);
  });

  it('projectileFired -> muzzle flash at the barrel tip, aimed at the target', () => {
    const fx = effectsForEvent(
      { type: 'projectileFired', projectileId: 5, towerId: 2, targetId: 1 },
      lookupOf([enemy(1, 200)], [tower(2)]),
      c,
      0,
    );
    expect(fx).toHaveLength(1);
    const m = fx[0]!;
    expect(m.kind).toBe('muzzle');
    if (m.kind !== 'muzzle') return;
    expect(m.angle).toBeCloseTo(Math.atan2(100 - 180, 200 - 100));
    expect(Math.hypot(m.pos.x - 100, m.pos.y - 180)).toBeGreaterThan(15);
  });

  it('a heavy tower gets a bigger, longer muzzle flash than a rapid one', () => {
    const fire = (type: string) =>
      effectsForEvent(
        { type: 'projectileFired', projectileId: 5, towerId: 2, targetId: 1 },
        lookupOf([enemy(1, 200)], [tower(2, type)]),
        c,
        0,
      )[0] as Extract<ReturnType<typeof effectsForEvent>[number], { kind: 'muzzle' }>;
    expect(fire('heavy').size).toBeGreaterThan(fire('rapid').size);
    expect(fire('heavy').ttl).toBeGreaterThan(fire('rapid').ttl);
  });

  it('towerPlaced -> a puff on the cell; other events -> nothing', () => {
    const placed = effectsForEvent(
      { type: 'towerPlaced', towerId: 3, towerType: 'rapid', cell: { col: 1, row: 1 }, cost: 50 },
      lookupOf([]),
      c,
      0,
    );
    expect(placed[0]).toMatchObject({ kind: 'puff', pos: { x: 60, y: 60 } });
    expect(effectsForEvent({ type: 'gameWon' }, lookupOf([]), c, 0)).toEqual([]);
    expect(effectsForEvent({ type: 'waveStarted', waveIndex: 0 }, lookupOf([]), c, 0)).toEqual([]);
  });
});

describe('createFeedback', () => {
  function setup(cap?: number) {
    const bus = createEventBus();
    let state: GameState = deepFreeze(makeState({ tick: 1, enemies: [enemy(1, 40)] }));
    let now = 0;
    const onLivesLost = vi.fn();
    const fb = createFeedback({
      bus,
      content: realContent,
      getState: () => state,
      onLivesLost,
      clock: () => now,
      cap,
    });
    return {
      bus,
      fb,
      onLivesLost,
      setState: (s: GameState) => (state = deepFreeze(s)),
      setNow: (t: number) => (now = t),
    };
  }

  it('spawns effects from bus events and expires them over time', () => {
    const t = setup();
    t.bus.emit({ type: 'projectileHit', projectileId: 7, targetId: 1, damage: 5 });
    expect(t.fb.effects(10).map((e) => e.kind)).toEqual(['hitFlash', 'spark']);
    expect(t.fb.effects(10_000)).toEqual([]);
  });

  it('finds a killed enemy at its last-seen position from an earlier frame', () => {
    const t = setup();
    t.fb.observe(makeState({ tick: 1, enemies: [enemy(1, 40)] }));
    t.setState(makeState({ tick: 2, enemies: [] })); // removed in the step that killed it
    t.bus.emit({ type: 'enemyKilled', enemyId: 1, enemyType: 'runner', bounty: 5 });
    const text = t.fb.effects(0).find((e) => e.kind === 'floatText');
    expect(text).toMatchObject({ text: '+$5', pos: { x: 40, y: 100 } });
  });

  it('calls onLivesLost for each leak', () => {
    const t = setup();
    t.bus.emit({ type: 'enemyLeaked', enemyId: 1, enemyType: 'runner', livesCost: 1 });
    t.bus.emit({ type: 'enemyLeaked', enemyId: 2, enemyType: 'runner', livesCost: 1 });
    expect(t.onLivesLost).toHaveBeenCalledTimes(2);
  });

  it('caps live effects', () => {
    const t = setup(4);
    for (let i = 0; i < 10; i++) {
      t.bus.emit({ type: 'projectileHit', projectileId: i, targetId: 1, damage: 1 });
    }
    expect(t.fb.effects(0)).toHaveLength(4);
  });

  it('clears effects on restart (tick goes backwards)', () => {
    const t = setup();
    t.setState(makeState({ tick: 500, enemies: [enemy(1, 40)] }));
    t.bus.emit({ type: 'projectileHit', projectileId: 7, targetId: 1, damage: 5 });
    expect(t.fb.effects(0).length).toBeGreaterThan(0);
    t.fb.observe(makeState({ tick: 0 }));
    expect(t.fb.effects(0)).toEqual([]);
  });

  it('unsubscribes on destroy', () => {
    const t = setup();
    t.fb.destroy();
    t.bus.emit({ type: 'projectileHit', projectileId: 7, targetId: 1, damage: 5 });
    t.bus.emit({ type: 'enemyLeaked', enemyId: 1, enemyType: 'runner', livesCost: 1 });
    expect(t.fb.effects(0)).toEqual([]);
    expect(t.onLivesLost).not.toHaveBeenCalled();
  });
});

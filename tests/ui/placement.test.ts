import { describe, expect, it } from 'vitest';
import type { PlacementResult } from '../../src/core/types';
import {
  clickIntent,
  previewPlacement,
  previewReasonText,
  towerButtons,
  towerForHotkey,
} from '../../src/ui/placement';
import { deepFreeze, makeContent, makeState } from '../render/fixtures';

// rapid $50, heavy $100; 10x6 grid, path along row 2.
const content = makeContent();
const free = { col: 5, row: 4 };
const tower = (col: number, row: number) => ({
  id: 9,
  type: 'rapid',
  cell: { col, row },
  pos: { x: 0, y: 0 },
  cooldownTicks: 0,
  targetId: null,
});

describe('previewPlacement (defaults to gameplay canPlaceTower)', () => {
  it('accepts an affordable tower on a free off-path cell', () => {
    expect(previewPlacement(makeState({ money: 50 }), content, 'rapid', free)).toEqual({
      ok: true,
    });
  });

  it('reports the same reasons applyIntent would', () => {
    const reason = (r: ReturnType<typeof previewPlacement>) => (r.ok ? 'ok' : r.reason);
    const s = makeState({ money: 999, towers: [tower(5, 4)] });
    expect(reason(previewPlacement(makeState({ money: 49 }), content, 'rapid', free))).toBe(
      'insufficientFunds',
    );
    expect(reason(previewPlacement(s, content, 'ghost', free))).toBe('unknownTowerType');
    expect(reason(previewPlacement(s, content, 'rapid', { col: 3, row: 2 }))).toBe('onPath');
    expect(reason(previewPlacement(s, content, 'rapid', free))).toBe('overlap');
    expect(reason(previewPlacement(s, content, 'rapid', { col: 10, row: 0 }))).toBe('outOfBounds');
  });

  it('rejects with gameOver once the game is won or lost', () => {
    for (const status of ['won', 'lost'] as const) {
      expect(previewPlacement(makeState({ status }), content, 'rapid', free)).toEqual({
        ok: false,
        reason: 'gameOver',
      });
    }
  });

  it('uses an injected check, including a boolean adapter', () => {
    const no: PlacementResult = { ok: false, reason: 'onPath' };
    expect(previewPlacement(makeState(), content, 'rapid', free, () => no)).toEqual(no);
    expect(previewPlacement(makeState(), content, 'rapid', free, () => true)).toEqual({ ok: true });
    expect(previewPlacement(makeState(), content, 'rapid', free, () => false)).toEqual({
      ok: false,
      reason: null,
    });
  });

  it('does not mutate deeply frozen state', () => {
    const s = deepFreeze(makeState({ towers: [tower(1, 1)] }));
    expect(() => previewPlacement(s, deepFreeze(makeContent()), 'rapid', free)).not.toThrow();
  });
});

describe('previewReasonText', () => {
  it('labels rejections and stays silent otherwise', () => {
    expect(previewReasonText({ ok: false, reason: 'onPath' })).toBe("Can't build on the path");
    expect(previewReasonText({ ok: false, reason: 'insufficientFunds' })).toBe('Not enough money');
    expect(previewReasonText({ ok: false, reason: null })).toBeNull();
    expect(previewReasonText({ ok: true })).toBeNull();
  });
});

describe('clickIntent', () => {
  it('emits placeTower only with a selection, a cell and a valid preview', () => {
    expect(clickIntent('rapid', free, true)).toEqual({
      type: 'placeTower',
      towerType: 'rapid',
      cell: { col: 5, row: 4 },
    });
    expect(clickIntent(null, free, true)).toBeNull();
    expect(clickIntent('rapid', null, true)).toBeNull();
    expect(clickIntent('rapid', free, false)).toBeNull();
  });

  it('copies the cell so later hover changes cannot alias the intent', () => {
    const c = { col: 1, row: 1 };
    const intent = clickIntent('rapid', c, true);
    c.col = 7;
    expect(intent).toMatchObject({ cell: { col: 1, row: 1 } });
  });
});

describe('towerButtons / towerForHotkey', () => {
  it('lists towers in content order with cost, hotkey, selection and affordability', () => {
    expect(towerButtons(makeState({ money: 60 }), content, 'heavy')).toEqual([
      { id: 'rapid', label: 'Rapid $50', hotkey: '1', selected: false, affordable: true },
      { id: 'heavy', label: 'Heavy $100', hotkey: '2', selected: true, affordable: false },
    ]);
  });

  it('maps number keys to towers', () => {
    expect(towerForHotkey('1', content)).toBe('rapid');
    expect(towerForHotkey('2', content)).toBe('heavy');
    expect(towerForHotkey('3', content)).toBeNull();
    expect(towerForHotkey('0', content)).toBeNull();
    expect(towerForHotkey('a', content)).toBeNull();
    expect(towerForHotkey('1.5', content)).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { content as realContent } from '../../src/data';
import { towerButtons } from '../../src/ui/placement';
import { cardStats, cardTextParts, formatStat, towerCards } from '../../src/ui/toolbar';
import { deepFreeze, makeContent, makeState } from '../render/fixtures';

describe('formatStat', () => {
  it('shows at most one decimal', () => {
    expect(formatStat(4)).toBe('4');
    expect(formatStat(0.8)).toBe('0.8');
    expect(formatStat(1.25)).toBe('1.3');
    expect(formatStat(36.000001)).toBe('36');
    expect(formatStat(Infinity)).toBe('–');
  });
});

describe('towerCards', () => {
  const content = makeContent();

  it('follows towerButtons order, hotkeys, selection and affordability', () => {
    const state = makeState({ money: 60 });
    const cards = towerCards(state, content, 'heavy');
    const buttons = towerButtons(state, content, 'heavy');
    expect(cards.map((c) => [c.id, c.hotkey, c.selected, c.affordable])).toEqual(
      buttons.map((b) => [b.id, b.hotkey, b.selected, b.affordable]),
    );
    expect(cards.map((c) => c.affordable)).toEqual([true, false]);
    expect(cards.map((c) => c.selected)).toEqual([false, true]);
  });

  it('shows cost, damage, fire rate, range and DPS from the def', () => {
    const [rapid] = towerCards(makeState(), realContent, null);
    expect(rapid!.cost).toBe('$50');
    expect(rapid!.stats).toEqual(cardStats(realContent.towers.rapid!));
    expect(Object.fromEntries(rapid!.stats.map((s) => [s.label, s.value]))).toEqual({
      Dmg: '5',
      Rate: '4/s',
      Range: '120',
      DPS: '20',
    });
    expect(rapid!.description).toContain('Rapid');
  });

  it('keeps the playtest button text: "<hotkey>. <name> $<cost>"', () => {
    const cards = towerCards(makeState(), realContent, null);
    expect(cards.map((c) => cardTextParts(c).join(''))).toEqual(['1. Rapid $50', '2. Heavy $100']);
    // Same string as the original R4 label format.
    const buttons = towerButtons(makeState(), realContent, null);
    expect(cards.map((c) => cardTextParts(c).join(''))).toEqual(
      buttons.map((b) => `${b.hotkey}. ${b.label}`),
    );
  });

  it('reads deeply frozen state and content', () => {
    expect(() =>
      towerCards(deepFreeze(makeState()), deepFreeze(makeContent()), 'rapid'),
    ).not.toThrow();
  });
});

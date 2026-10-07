import { describe, expect, it } from 'vitest';
import { overlayView } from '../../src/ui/overlay';
import { makeContent, makeState } from '../render/fixtures';

const content = makeContent(); // 2 waves
const wave = (index: number) => ({ index, active: false, elapsedTicks: 0, spawned: [] });

describe('overlayView', () => {
  it('is hidden while ready or playing', () => {
    expect(overlayView(makeState(), content)).toBeNull();
    expect(overlayView(makeState({ status: 'playing' }), content)).toBeNull();
  });

  it('shows a victory with lives left', () => {
    const v = overlayView(makeState({ status: 'won', lives: 7, wave: wave(1) }), content);
    expect(v).toEqual({
      kind: 'won',
      title: 'Victory!',
      subtitle: 'All 2 waves cleared with 7 lives left.',
    });
    expect(overlayView(makeState({ status: 'won', lives: 1 }), content)?.subtitle).toContain(
      '1 life left',
    );
  });

  it('shows a defeat with the 1-based wave reached', () => {
    const v = overlayView(makeState({ status: 'lost', lives: 0, wave: wave(0) }), content);
    expect(v?.kind).toBe('lost');
    expect(v?.subtitle).toBe('Overrun on wave 1 of 2.');
  });
});

import { describe, expect, it } from 'vitest';
import { content } from '../../src/data';

describe('content bundle', () => {
  it('has positive starting money and lives', () => {
    expect(content.startingLives).toBeGreaterThan(0);
    expect(content.startingMoney).toBeGreaterThan(0);
  });

  it('starting money buys at least one of each tower', () => {
    for (const t of Object.values(content.towers)) {
      expect(content.startingMoney).toBeGreaterThanOrEqual(t.cost);
    }
  });
});

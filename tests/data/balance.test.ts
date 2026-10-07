// D5: headless balance checks. Plays full games through the real step() with scripted build orders.
import { describe, expect, it } from 'vitest';
import { content } from '../../src/data';
import { simulate, type BuildOrder } from './sim';

const rapid = (col: number, row: number): BuildOrder => ({ tower: 'rapid', cell: { col, row } });
const heavy = (col: number, row: number): BuildOrder => ({ tower: 'heavy', cell: { col, row } });

/**
 * A sensible mixed layout: rapids hug the path's inside corners, heavies sit in the two U-bends
 * where their range covers three path segments. Built in this order as money allows.
 */
const GOOD_LAYOUT: BuildOrder[] = [
  rapid(6, 11),
  rapid(11, 11),
  heavy(8, 8),
  rapid(13, 5),
  rapid(18, 5),
  heavy(15, 8),
  rapid(4, 3),
  heavy(8, 10),
  heavy(15, 10),
  rapid(6, 3),
  rapid(18, 12),
  rapid(13, 11),
  heavy(11, 7),
];

describe('balance (headless)', () => {
  it('every scripted cell is a legal placement (sim throws on rejected intents)', () => {
    expect(() => simulate(content, GOOD_LAYOUT)).not.toThrow();
  });

  it('building nothing survives wave 1 but loses during wave 2', () => {
    const r = simulate(content, []);
    expect(r.status).toBe('lost');
    expect(r.waveIndex).toBe(1);
    expect(r.livesAfterWave[0]).toBeGreaterThan(0);
  });

  it('a reasonable layout wins all 5 waves', () => {
    const r = simulate(content, GOOD_LAYOUT);
    expect(r.status).toBe('won');
    expect(r.waveIndex).toBe(content.waves.length - 1);
    expect(r.lives).toBeGreaterThan(content.startingLives / 2);
  });

  it('is not trivial: a single tower loses', () => {
    expect(simulate(content, [rapid(6, 11)]).status).toBe('lost');
  });

  it('is not trivial: the first 4 towers of the good layout are not enough', () => {
    expect(simulate(content, GOOD_LAYOUT.slice(0, 4)).status).toBe('lost');
  });

  it('is deterministic for the same seed and plan', () => {
    expect(simulate(content, GOOD_LAYOUT, 7)).toEqual(simulate(content, GOOD_LAYOUT, 7));
  });
});

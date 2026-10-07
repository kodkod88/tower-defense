import { describe, expect, it } from 'vitest';
import {
  canvasFont,
  FONT,
  kebab,
  PALETTE,
  shade,
  themeCssVariables,
  withAlpha,
} from '../../src/render/theme';
import html from '../../index.html?raw';

/** Custom properties declared in index.html's first :root block. */
function rootVars(): Record<string, string> {
  const block = /:root\s*{([\s\S]*?)}/.exec(html)?.[1] ?? '';
  const vars: Record<string, string> = {};
  for (const m of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) vars[m[1]!] = m[2]!.trim();
  return vars;
}

describe('theme tokens', () => {
  it('index.html declares every theme variable with the same value as theme.ts', () => {
    const css = rootVars();
    for (const [name, value] of Object.entries(themeCssVariables())) {
      expect(css[name], name).toBe(value);
    }
  });

  it('palette entries are all #rrggbb', () => {
    for (const [k, v] of Object.entries(PALETTE)) expect(v, k).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('uses system font stacks only (no web fonts)', () => {
    expect(FONT.family).toMatch(/sans-serif$/);
    expect(FONT.mono).toMatch(/monospace$/);
  });

  it('builds canvas font strings from the type scale', () => {
    expect(canvasFont('sm', 700)).toBe(`700 13px ${FONT.family}`);
    expect(canvasFont('md')).toBe(`400 16px ${FONT.family}`);
  });

  it('kebab-cases token names', () => {
    expect(kebab('panelRaised')).toBe('panel-raised');
    expect(kebab('bg')).toBe('bg');
  });
});

describe('color helpers', () => {
  it('withAlpha converts hex to rgba and clamps alpha', () => {
    expect(withAlpha('#ff8000', 0.5)).toBe('rgba(255,128,0,0.5)');
    expect(withAlpha('#000000', 3)).toBe('rgba(0,0,0,1)');
    expect(withAlpha('red', 0.5)).toBe('red');
  });

  it('shade mixes toward white or black', () => {
    expect(shade('#808080', 1)).toBe('#ffffff');
    expect(shade('#808080', -1)).toBe('#000000');
    expect(shade('#808080', 0)).toBe('#808080');
    expect(shade('#000000', 0.5)).toBe('#808080');
    expect(shade('nope', 0.5)).toBe('nope');
  });
});

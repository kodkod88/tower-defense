import { describe, expect, it } from 'vitest';
import { ICON_SVG } from '../../src/ui/icons';

describe('ICON_SVG', () => {
  it('has inline markup for every icon with no external references', () => {
    for (const [name, svg] of Object.entries(ICON_SVG)) {
      expect(svg.length, name).toBeGreaterThan(20);
      expect(svg, name).not.toMatch(/https?:|url\(|<image|href=/);
    }
  });
});

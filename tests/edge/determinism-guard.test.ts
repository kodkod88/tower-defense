// QA guard: game logic must be deterministic and DOM-free (CLAUDE.md "Rules").
// ESLint only bans window/document/requestAnimationFrame, so this test closes the gap for
// clocks, timers, unseeded randomness, and DOM/render imports in the logic layers.
import { describe, expect, it } from 'vitest';

// Raw source of every logic-layer module, keyed by path relative to this file.
const SOURCES = import.meta.glob(
  [
    '../../src/core/**/*.ts',
    '../../src/entities/**/*.ts',
    '../../src/systems/**/*.ts',
    '../../src/data/**/*.ts',
  ],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

const FORBIDDEN: { name: string; re: RegExp }[] = [
  { name: 'Math.random (use the seeded RNG)', re: /\bMath\.random\b/ },
  { name: 'Date (wall clock)', re: /\bDate\.now\b|\bnew Date\b/ },
  { name: 'performance.now (wall clock)', re: /\bperformance\.now\b/ },
  { name: 'timers', re: /\b(setTimeout|setInterval|requestAnimationFrame)\s*\(/ },
  { name: 'DOM globals', re: /\b(window|document|localStorage)\s*\./ },
  { name: 'imports from render/ui', re: /from\s+['"][^'"]*\/(render|ui)(\/[^'"]*)?['"]/ },
];

/** Strip comments so documentation that mentions e.g. Math.random doesn't trip the guard. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const files = Object.entries(SOURCES).map(([path, code]) => [path.replace('../../', ''), code]);

describe('determinism guard: logic layers', () => {
  it('finds logic files to scan', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)(
    '%s uses no clocks, timers, unseeded RNG, DOM, or render/ui imports',
    (_rel, raw) => {
      const code = stripComments(raw!);
      const hits = FORBIDDEN.filter(({ re }) => re.test(code)).map(({ name }) => name);
      expect(hits).toEqual([]);
    },
  );
});

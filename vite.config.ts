import { defineConfig } from 'vitest/config';

export default defineConfig(({ command }) => ({
  // GitHub Pages serves the site from /tower-defense/; the dev server stays at /.
  base: command === 'build' ? '/tower-defense/' : '/',
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
}));

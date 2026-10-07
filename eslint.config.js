import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Game logic must stay DOM-free so it is deterministic and unit-testable.
    files: ['src/core/**', 'src/entities/**', 'src/systems/**', 'src/data/**'],
    languageOptions: { globals: { ...globals.es2022 } },
    rules: {
      'no-restricted-globals': ['error', 'window', 'document', 'requestAnimationFrame'],
    },
  },
);

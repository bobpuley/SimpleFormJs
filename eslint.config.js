import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/', 'node_modules/', 'coverage/', 'playwright-report/', 'test-results/'] },
  js.configs.recommended,
  { rules: { 'no-unused-vars': ['error', { ignoreRestSiblings: true, varsIgnorePattern: '^_' }] } },
  {
    files: ['src/**/*.js', 'showcases/**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { ...globals.browser } }
  },
  {
    files: ['scripts/**/*.mjs', 'tests/**/*.js', '*.config.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { ...globals.node, ...globals.browser } }
  }
];

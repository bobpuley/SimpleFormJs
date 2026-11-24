import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.js', 'tests/functional/**/*.test.js'],
    setupFiles: ['tests/setup.js'],
    restoreMocks: true,
  },
});

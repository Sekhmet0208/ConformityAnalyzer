import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Les tests d'integration lancent un vrai navigateur : laisser de la marge.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});

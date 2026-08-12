import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      include: ['src/**/*.{ts,tsx,mjs}'],
      exclude: ['src/**/*.test.*', 'src/**/*.d.*'],
      thresholds: {
        lines: 22,
        functions: 22,
        branches: 17,
        statements: 21,
      },
    },
  },
});

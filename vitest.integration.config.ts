import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/integration/**/*.integration.test.ts'],
    testTimeout: 20_000,
  },
});

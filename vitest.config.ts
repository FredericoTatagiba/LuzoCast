import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts', 'apps/host/src/main/**/*.test.ts'],
    environment: 'node',
  },
});

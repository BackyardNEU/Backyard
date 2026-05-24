import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/**/*.test.js'],
    setupFiles: ['./vitest.setup.js'],
    globals: false,
  },
});

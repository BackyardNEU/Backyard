import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // tests/ was not covered by the original 'server/**' glob, so the calendarExport and
    // nlSearch suites added alongside it were collected by nothing and never ran.
    include: ['server/**/*.test.js', 'tests/**/*.test.js'],
    setupFiles: ['./vitest.setup.js'],
    globals: false,
  },
});

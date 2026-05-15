// vitest.config.ts
// Wave 0 unit test config. Node environment (no DOM) — preload/main/shared tests live
// here; renderer-side React component tests can later add their own jsdom config or run
// under playwright. test.include narrows discovery to tests/unit and tests/cli so we
// don't pick up playwright e2e specs in tests/e2e.

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/cli/**/*.test.ts', 'tests/launcher/**/*.test.ts'],
    globals: true,
  },
});

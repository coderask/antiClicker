// vitest.config.ts
// Unit test config covering:
//   - Node environment: preload/main/shared tests (tests/unit, tests/cli, tests/launcher)
//   - Happy-dom environment: renderer React component tests (tests/renderer)
//
// Two projects are defined so each can use the correct environment without mixing.

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    projects: [
      {
        // Node-environment project — main/preload/shared/CLI tests
        test: {
          name: 'node',
          environment: 'node',
          include: [
            'tests/unit/**/*.test.ts',
            'tests/cli/**/*.test.ts',
            'tests/launcher/**/*.test.ts',
          ],
        },
      },
      {
        // Happy-dom project — renderer React component tests
        plugins: [react()],
        resolve: { alias: { '@shared': resolve('src/shared') } },
        test: {
          name: 'renderer',
          environment: 'happy-dom',
          globals: true,
          include: ['tests/renderer/**/*.test.tsx', 'tests/renderer/**/*.test.ts'],
          setupFiles: ['tests/renderer/setup.ts'],
        },
      },
    ],
  },
});

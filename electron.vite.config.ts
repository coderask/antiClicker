// electron.vite.config.ts
// Canonical three-target electron-vite shape per 00-RESEARCH.md Pattern 8.
// Main + preload externalize node_modules (no bundling of electron-store, zod, etc.);
// renderer uses @vitejs/plugin-react. Shared types are aliased via @shared in both
// node-side (main) and web-side (renderer) targets.

import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  main: {
    // externalizeDepsPlugin only externalizes `dependencies` from package.json.
    // playwright is a devDependency that the main process uses at runtime (Phase 3+),
    // so we must explicitly include it in the externalize list. Without this,
    // vite bundles playwright's coreBundle.js and its internal lazy require of
    // `chromium-bidi` gets hoisted to a static ESM import that Node can't resolve.
    plugins: [externalizeDepsPlugin({ include: ['playwright', 'playwright-core'] })],
    build: { outDir: 'out/main' },
    resolve: { alias: { '@shared': resolve('src/shared') } },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/preload',
      // Sandboxed preload (FND-01 sandbox:true) cannot use ESM — emit CJS.
      rollupOptions: {
        output: {
          format: 'cjs',
          entryFileNames: '[name].js',
        },
      },
    },
  },
  renderer: {
    root: 'src/renderer',
    plugins: [react()],
    build: {
      outDir: 'out/renderer',
      rollupOptions: { input: resolve('src/renderer/index.html') },
    },
    resolve: { alias: { '@shared': resolve('src/shared') } },
    // maplibre-gl is an ESM package that bundles worker code; pre-bundling avoids
    // Vite dev-server issues with dynamic worker imports at runtime.
    optimizeDeps: { include: ['maplibre-gl'] },
  },
});

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
    plugins: [externalizeDepsPlugin()],
    build: { outDir: 'out/main' },
    resolve: { alias: { '@shared': resolve('src/shared') } },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: { outDir: 'out/preload' },
  },
  renderer: {
    root: 'src/renderer',
    plugins: [react()],
    build: {
      outDir: 'out/renderer',
      rollupOptions: { input: resolve('src/renderer/index.html') },
    },
    resolve: { alias: { '@shared': resolve('src/shared') } },
  },
});

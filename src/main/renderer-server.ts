// src/main/renderer-server.ts
//
// FND-02: serve the packaged renderer over http://127.0.0.1:<ephemeral>/ so
// every renderer URL in AntiClicker (dev and prod) is HTTP. Without this,
// packaged builds fall back to file:// and Google Maps' HTTP-referrer
// restriction silently fails in Phase 4.
//
// Defense-in-depth:
//   - Bind 127.0.0.1 only (loopback — no LAN exposure).
//   - listen(0) for an ephemeral port (never collides with a dev server).
//   - Path traversal guard via normalize() + startsWith(RENDERER_ROOT).
//   - Host-header guard (DNS-rebind defense even on loopback).
//   - Zero external deps — node stdlib only.

import { createServer, type Server } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// At runtime this module lives at out/main/renderer-server.js, so the
// renderer bundle is the sibling out/renderer directory.
const RENDERER_ROOT = join(__dirname, '../renderer');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

let serverRef: Server | null = null;

export async function startRendererServer(): Promise<string> {
  const server = createServer(async (req, res) => {
    try {
      const host = req.headers.host ?? '';
      if (!host.startsWith('127.0.0.1') && !host.startsWith('localhost')) {
        res.writeHead(403);
        res.end('forbidden host');
        return;
      }

      let urlPath = decodeURIComponent(
        new URL(req.url ?? '/', 'http://127.0.0.1').pathname,
      );
      if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

      const candidate = normalize(join(RENDERER_ROOT, urlPath));
      if (!candidate.startsWith(RENDERER_ROOT)) {
        res.writeHead(403);
        res.end('forbidden path');
        return;
      }

      const st = await stat(candidate);
      if (!st.isFile()) {
        res.writeHead(404);
        res.end('not found');
        return;
      }

      const body = await readFile(candidate);
      const type = MIME[extname(candidate)] ?? 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  });

  await new Promise<void>((resolve) =>
    server.listen(0, '127.0.0.1', resolve),
  );

  const addr = server.address();
  if (!addr || typeof addr === 'string') {
    throw new Error('renderer-server: server.address() returned unexpected value');
  }

  serverRef = server;
  return `http://127.0.0.1:${addr.port}/`;
}

export async function stopRendererServer(): Promise<void> {
  if (!serverRef) return;
  const s = serverRef;
  serverRef = null;
  await new Promise<void>((resolve, reject) => {
    s.close((err) => (err ? reject(err) : resolve()));
  });
}

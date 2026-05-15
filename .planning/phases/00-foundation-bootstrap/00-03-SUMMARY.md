# Plan 00-03 Summary — HTTP Renderer Server

**Phase:** 00-foundation-bootstrap
**Plan:** 03
**Requirements:** FND-02 (renderer served over HTTP in packaged builds)
**Wave:** 2
**Completed:** 2026-05-15

## What Was Built

`src/main/renderer-server.ts` — a 100-line `node:http`-only module that 00-02's main entry imports as `startRendererServer` / `stopRendererServer`. The packaged Electron app calls `startRendererServer()` inside `app.whenReady()`, gets back a `http://127.0.0.1:<ephemeral>/` URL, and passes it to `BrowserWindow.loadURL()`.

## Bind Strategy

- Address: literal string `127.0.0.1` (loopback). No LAN address is ever passed to `server.listen()`. `! grep -q "0\.0\.0\.0" src/main/renderer-server.ts` succeeds.
- Port: `server.listen(0, '127.0.0.1', resolve)` — `0` asks the OS for an ephemeral port. The actual port is read from `server.address().port` after the listen-resolved promise. No hardcoded `3000`, `8080`, or `5173` anywhere.

## Path Traversal Guard

```ts
const candidate = normalize(join(RENDERER_ROOT, urlPath));
if (!candidate.startsWith(RENDERER_ROOT)) {
  res.writeHead(403); res.end('forbidden path'); return;
}
```

A request for `/../../../etc/passwd` decodes, normalizes to an absolute path outside `RENDERER_ROOT` (which is computed once at module load via `dirname(fileURLToPath(import.meta.url)) + '/../renderer'`), the `startsWith` check fails, and the request is rejected with HTTP 403. Greppable anchor: `grep -q "startsWith(RENDERER_ROOT)" src/main/renderer-server.ts`.

## Host-Header Guard

DNS-rebind defense even on loopback: the handler rejects requests whose `Host` header does not start with `127.0.0.1` or `localhost`. A malicious DNS-rebind attempt at `evil.example.com -> 127.0.0.1` would fail this check before any file read.

## Dependencies

`grep -E "^import .* from '[^.n]" src/main/renderer-server.ts` returns nothing — zero external dependencies. Only `node:http`, `node:fs/promises`, `node:path`, `node:url`.

## What's Not Tested Here

This module is not exercised in isolation. FND-02 verification lives in plan 00-06's Playwright e2e (`tests/e2e/http-protocol.spec.ts`) which asserts the running app's `window.url()` starts with `http://` against a built (packaged-mode) Electron, not against `electron-vite dev` (00-RESEARCH.md Pitfall 7).

## Handoff

00-04 (running next in this wave) completes Wave 2 by adding `src/main/config-store.ts` — the third forward import 00-02 already references.

---
phase: 0
slug: foundation-bootstrap
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-14
---

# Phase 0 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 2.x (unit) + @playwright/test 1.60 (Electron e2e via `_electron.launch()`) |
| **Config file** | `vitest.config.ts`, `playwright.config.ts` (Wave 0 creates both) |
| **Quick run command** | `npm run test:unit` |
| **Full suite command** | `npm run test` (unit + electron e2e) |
| **Estimated runtime** | ~15s unit, ~60s electron e2e |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:unit`
- **After every plan wave:** Run `npm run test` (full suite — includes Electron launch e2e)
- **After Wave 2 merge (before dispatching Wave 3):** Run `npm run build` — must exit 0. Belt-and-suspenders for the late-integration concern: plans 00-02, 00-03, 00-04 use grep-only per-task `<verify>` blocks and defer compilation to Wave 3's 00-05. If any forward-import contract mismatch slipped through, this gate surfaces it before 00-05 starts.
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

> Filled in by planner. Each task that lands code must have either an `<automated>` verification command or a documented Wave 0 dependency that creates the test infrastructure it will later use.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 00-01-01 | 01 | 0 | — | — | Wave 0 scaffolding | n/a | `test -f vitest.config.ts` | ❌ W0 | ⬜ pending |
| 00-01-02 | 01 | 0 | — | — | Wave 0 scaffolding | n/a | `test -f playwright.config.ts` | ❌ W0 | ⬜ pending |
| 00-XX-XX | XX | N | FND-01 | — | Electron renderer has `contextIsolation=true`, `nodeIntegration=false`, `sandbox=true` | e2e | `npx playwright test tests/e2e/secure-defaults.spec.ts` | ❌ W0 | ⬜ pending |
| 00-XX-XX | XX | N | FND-02 | — | `window.location.protocol === 'http:'` in both dev and packaged builds | e2e | `npx playwright test tests/e2e/http-protocol.spec.ts` | ❌ W0 | ⬜ pending |
| 00-XX-XX | XX | N | FND-03 | — | electron-store write persists across relaunch | e2e | `npx playwright test tests/e2e/persistence.spec.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> Planner fills in concrete task IDs and Plan numbers as plans are generated.

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — unit test runner config
- [ ] `playwright.config.ts` — Electron e2e runner config with `projects: [{ name: 'electron', testDir: 'tests/e2e' }]`
- [ ] `tests/e2e/secure-defaults.spec.ts` — stub asserting `webContents.getWebPreferences()` returns the secure triple (FND-01)
- [ ] `tests/e2e/http-protocol.spec.ts` — stub asserting `window.url()` starts with `http://` in built mode (FND-02)
- [ ] `tests/e2e/persistence.spec.ts` — stub asserting electron-store write survives a second `_electron.launch()` (FND-03)
- [ ] `tests/unit/preload-api.test.ts` — stub asserting preload exports the typed API shape (no raw `ipcRenderer`)
- [ ] `package.json` — add `test`, `test:unit`, `test:e2e` scripts; add `@playwright/test`, `vitest` to devDependencies

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Google Cloud Console quota cap + budget alert | Pitfall 5 mitigation | External service (Google Cloud Console); not testable from code | (1) Enable Maps JavaScript API in a Cloud project. (2) Set QPD cap at ~1k req/day. (3) Set budget alerts at $5/$20/$50. (4) Restrict API key to `http://localhost/*` referrer. Confirm screenshot in commit message. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (no `vitest --watch`, no `playwright test --ui` in CI commands)
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

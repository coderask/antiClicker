/**
 * tests/launcher/multi-instance.spec.ts
 *
 * Phase 2 integration tests for src/launcher/. Covers all five ROADMAP
 * success criteria:
 *   1. 5 parallel launches, no cross-contamination of coordinates
 *   2. Profile isolation (cookies set in A invisible in B)
 *   3. Port stability across 10 rapid relaunches (no EADDRINUSE)
 *   4. context.on('close') fires cleanup + 'instance-closed' event
 *   5. Live setGeo updates coordinates without relaunch
 *
 * Hermetic: uses the localhost HTTP fixture from ./fixture.ts. No external
 * network calls. The tests use the `_testContext` back-door on the launcher
 * to open pages on running instances.
 */

import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import type { BrowserContext, Page } from 'playwright';
import { createLauncher, type InstanceId, type Launcher } from '../../src/launcher/index.js';
import { startGeoFixtureServer, waitForGeoResult, waitForCookieResult } from './fixture.js';

type TestableLauncher = Launcher & { _testContext: (id: InstanceId) => BrowserContext };

// ---------------------------------------------------------------------------
// 1. Parallel launches with distinct coordinates
// ---------------------------------------------------------------------------

test('5 parallel instances each report their own coordinates', async () => {
  const fixture = await startGeoFixtureServer();
  const launcher = createLauncher() as TestableLauncher;

  const targets = [
    { latitude: 35.6762, longitude: 139.6503 },   // Tokyo
    { latitude: 40.7128, longitude: -74.006 },    // NYC
    { latitude: -33.8688, longitude: 151.2093 },  // Sydney
    { latitude: 48.8566, longitude: 2.3522 },     // Paris
    { latitude: -22.9068, longitude: -43.1729 },  // Rio
  ];

  try {
    const instances = await Promise.all(
      targets.map((t) => launcher.launch({ ...t, headless: true })),
    );

    expect(instances).toHaveLength(5);
    expect(new Set(instances.map((i) => i.id)).size).toBe(5);
    expect(new Set(instances.map((i) => i.userDataDir)).size).toBe(5);

    const reported = await Promise.all(
      instances.map(async (inst) => {
        const ctx = launcher._testContext(inst.id);
        const page: Page = await ctx.newPage();
        await page.goto(fixture.url);
        const result = await waitForGeoResult(page);
        await page.close();
        return result;
      }),
    );

    for (let i = 0; i < targets.length; i++) {
      const parsed = JSON.parse(reported[i]);
      expect(parsed.lat).toBeCloseTo(targets[i].latitude, 4);
      expect(parsed.lng).toBeCloseTo(targets[i].longitude, 4);
    }
  } finally {
    await launcher.closeAll();
    await fixture.close();
  }
});

// ---------------------------------------------------------------------------
// 2. Profile isolation — cookies don't leak between instances
// ---------------------------------------------------------------------------

test('profiles are isolated: cookies in A invisible in B', async () => {
  const fixture = await startGeoFixtureServer();
  const launcher = createLauncher() as TestableLauncher;

  try {
    const a = await launcher.launch({ latitude: 0, longitude: 0, headless: true });
    const b = await launcher.launch({ latitude: 0, longitude: 0, headless: true });

    expect(a.userDataDir).not.toBe(b.userDataDir);

    const pageA = await launcher._testContext(a.id).newPage();
    await pageA.goto(`${fixture.url}/cookie?id=instance-A`);
    const cookieA = await waitForCookieResult(pageA);
    expect(cookieA).toContain('instance=instance-A');

    const pageB = await launcher._testContext(b.id).newPage();
    await pageB.goto(`${fixture.url}/cookie?id=instance-B`);
    const cookieB = await waitForCookieResult(pageB);
    expect(cookieB).toContain('instance=instance-B');
    expect(cookieB).not.toContain('instance-A');

    await pageA.close();
    await pageB.close();
  } finally {
    await launcher.closeAll();
    await fixture.close();
  }
});

// ---------------------------------------------------------------------------
// 3. Rapid launch/close cycles — no port collisions
// ---------------------------------------------------------------------------

test('10 rapid launch/close cycles never collide on port', async () => {
  const launcher = createLauncher();
  try {
    for (let i = 0; i < 10; i++) {
      const inst = await launcher.launch({ latitude: 0, longitude: 0, headless: true });
      expect(inst.id).toBeTruthy();
      await launcher.close(inst.id);
    }
    expect(launcher.list()).toHaveLength(0);
  } finally {
    await launcher.closeAll();
  }
});

// ---------------------------------------------------------------------------
// 4. Close event fires cleanup + emits 'instance-closed'
// ---------------------------------------------------------------------------

test('closing an instance fires instance-closed and removes profile dir', async () => {
  const launcher = createLauncher();
  const closedIds: string[] = [];
  launcher.on('instance-closed', (id) => closedIds.push(id));

  const inst = await launcher.launch({ latitude: 0, longitude: 0, headless: true });
  const dir = inst.userDataDir;
  expect(existsSync(dir)).toBe(true);

  await launcher.close(inst.id);

  expect(closedIds).toContain(inst.id);
  expect(launcher.list().find((i) => i.id === inst.id)).toBeUndefined();
  // FS tick for Windows
  await new Promise((r) => setTimeout(r, 200));
  expect(existsSync(dir)).toBe(false);
});

// ---------------------------------------------------------------------------
// 5. Live setGeo updates without relaunch
// ---------------------------------------------------------------------------

test('setGeo updates a running instance without relaunch', async () => {
  const fixture = await startGeoFixtureServer();
  const launcher = createLauncher() as TestableLauncher;

  try {
    const inst = await launcher.launch({ latitude: 0, longitude: 0, headless: true });
    const page: Page = await launcher._testContext(inst.id).newPage();

    await page.goto(fixture.url);
    const first = JSON.parse(await waitForGeoResult(page));
    expect(first.lat).toBeCloseTo(0, 4);
    expect(first.lng).toBeCloseTo(0, 4);

    await launcher.setGeo(inst.id, { latitude: 35.6762, longitude: 139.6503 });

    await page.reload();
    const second = JSON.parse(await waitForGeoResult(page));
    expect(second.lat).toBeCloseTo(35.6762, 4);
    expect(second.lng).toBeCloseTo(139.6503, 4);

    const snap = launcher.list().find((i) => i.id === inst.id);
    expect(snap?.coords.latitude).toBeCloseTo(35.6762, 4);

    await page.close();
  } finally {
    await launcher.closeAll();
    await fixture.close();
  }
});

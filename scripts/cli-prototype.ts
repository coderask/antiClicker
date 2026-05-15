/**
 * scripts/cli-prototype.ts
 *
 * Phase 1 CDP Geolocation Primitive — CLI proof-of-concept.
 *
 * Usage:
 *   npx tsx scripts/cli-prototype.ts --lat 35.6762 --lng 139.6503
 *
 * Launches a headed Chromium window with its geolocation sensor overridden to
 * the supplied lat/lng. Stays alive until Ctrl-C or the Chrome window is closed.
 * On exit: closes the context and deletes the ephemeral profile directory.
 *
 * Key design decisions (see .planning/phases/01-cdp-cli-primitive/01-RESEARCH.md):
 *   - Pitfall 1 closed: permissions: ['geolocation'] in constructor options (atomic grant)
 *   - Pitfall 2 closed: launchPersistentContext (context-scoped override, survives cross-origin nav)
 *   - Pitfall 3 closed: fresh tmpdir per invocation, deleted on exit
 */

import { parseArgs } from 'node:util';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

// ---------------------------------------------------------------------------
// Argv parsing + bounds validation (exported for unit testing without browser)
// ---------------------------------------------------------------------------

export interface CliArgs {
  lat: number;
  lng: number;
}

/**
 * Parse and validate CLI arguments.
 * @param argv - the raw argument array (pass process.argv.slice(2) in production)
 * @returns validated { lat, lng } as numbers
 * @throws Error with a descriptive message on any validation failure
 */
export function parseCliArgs(argv: string[]): CliArgs {
  const { values } = parseArgs({
    args: argv,
    options: {
      lat: { type: 'string' },
      lng: { type: 'string' },
    },
    strict: false,
  });

  if (!values.lat) {
    throw new Error('Missing required argument --lat\nUsage: tsx scripts/cli-prototype.ts --lat <latitude> --lng <longitude>');
  }
  if (!values.lng) {
    throw new Error('Missing required argument --lng\nUsage: tsx scripts/cli-prototype.ts --lat <latitude> --lng <longitude>');
  }

  const lat = parseFloat(values.lat);
  const lng = parseFloat(values.lng);

  if (isNaN(lat)) {
    throw new Error(`Invalid latitude "${values.lat}" — must be a number in [-90, 90]`);
  }
  if (isNaN(lng)) {
    throw new Error(`Invalid longitude "${values.lng}" — must be a number in [-180, 180]`);
  }
  if (lat < -90 || lat > 90) {
    throw new Error(`Latitude ${lat} is out of range — must be in [-90, 90]`);
  }
  if (lng < -180 || lng > 180) {
    throw new Error(`Longitude ${lng} is out of range — must be in [-180, 180]`);
  }

  return { lat, lng };
}

// ---------------------------------------------------------------------------
// Main entrypoint — only runs when this module is executed directly
// ---------------------------------------------------------------------------

// Detect if this file is being run directly (not imported for testing)
const isMain = process.argv[1]?.endsWith('cli-prototype.ts') ||
               process.argv[1]?.endsWith('cli-prototype.js');

if (isMain) {
  await main();
}

async function main(): Promise<void> {
  // Parse and validate arguments
  let args: CliArgs;
  try {
    args = parseCliArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write((err as Error).message + '\n');
    process.exit(1);
  }

  const { lat, lng } = args;

  // Create an isolated ephemeral profile directory for this session
  const userDataDir = mkdtempSync(join(tmpdir(), 'anticlicker-profile-'));

  console.log(`Launching Chromium with geolocation lat=${lat} lng=${lng}`);
  console.log(`Profile dir: ${userDataDir}`);

  // Launch Playwright Chromium with geolocation override and permission grant.
  // Passing both in the constructor options is the safest pattern: the override and
  // permission grant are applied atomically before any page is created (Pitfall 1 closed).
  // launchPersistentContext ensures context-scoped (not page-scoped) override — it
  // survives cross-origin navigations within the same context (Pitfall 2 closed).
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    geolocation: { latitude: lat, longitude: lng, accuracy: 10 },
    permissions: ['geolocation'],
    args: ['--no-first-run', '--no-default-browser-check'],
  });

  // Open an initial blank tab so the user has something to navigate from
  const page = await context.newPage();
  await page.goto('about:blank');

  console.log('Chrome launched. Navigate anywhere — geolocation is spoofed.');
  console.log('Press Ctrl-C or close the Chrome window to exit and clean up.');

  // ---------------------------------------------------------------------------
  // Cleanup — runs on SIGINT (Ctrl-C) or when the user closes the Chrome window
  // ---------------------------------------------------------------------------
  let isCleaningUp = false;

  async function cleanup(): Promise<void> {
    if (isCleaningUp) return;
    isCleaningUp = true;

    console.log('\nCleaning up...');

    try {
      await context.close();
    } catch {
      // Context may already be closed if the user closed the window
    }

    try {
      rmSync(userDataDir, { recursive: true, force: true });
      console.log(`Profile dir removed: ${userDataDir}`);
    } catch {
      // Ignore — dir may already be gone
    }

    process.exit(0);
  }

  process.on('SIGINT', cleanup);

  // When the user closes the Chrome window, the context emits 'close'
  context.on('close', () => {
    if (!isCleaningUp) {
      void cleanup();
    }
  });

  // Keep the process alive until cleanup fires
  await new Promise<never>(() => {});
}

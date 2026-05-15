// src/main/sweep.ts
//
// Orphan profile directory sweep — extracted into its own module so it can be
// unit-tested without importing Electron (which can't load in vitest/node).
//
// Sweeps os.tmpdir() for anticlicker-profile-* directories left behind by
// previous crashed sessions. For each matching dir, reads pid.txt and checks
// if the owning PID is still alive via process.kill(pid, 0). Deletes the dir
// if the PID is dead or pid.txt is missing.
//
// Best-effort: never throws.

import { readdirSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Sweep orphaned anticlicker-profile-* directories from a prior crashed session.
 * For each dir under os.tmpdir() matching the pattern, reads pid.txt and checks
 * if the PID is still alive via process.kill(pid, 0). If the PID is dead (or
 * pid.txt is missing), the dir is deleted. Best-effort — never throws.
 *
 * @param killFn - Injectable kill function for unit testing. Defaults to process.kill.
 *   Should throw if the process is dead (same semantics as process.kill(pid, 0)).
 */
export function sweepOrphanedProfiles(killFn: (pid: number) => void = (pid) => process.kill(pid, 0)): void {
  try {
    const dir = tmpdir();
    const entries = readdirSync(dir);
    for (const entry of entries) {
      if (!/^anticlicker-profile-/.test(entry)) continue;
      const profileDir = join(dir, entry);
      try {
        const pidFile = join(profileDir, 'pid.txt');
        if (!existsSync(pidFile)) {
          // No sentinel — orphaned (pre-Phase 6 dir or crash before write)
          rmSync(profileDir, { recursive: true, force: true });
          continue;
        }
        const pidStr = readFileSync(pidFile, 'utf-8').trim();
        const pid = Number(pidStr);
        if (!Number.isInteger(pid) || pid <= 0) {
          rmSync(profileDir, { recursive: true, force: true });
          continue;
        }
        try {
          killFn(pid); // throws if process is dead
          // Process is alive — leave the dir alone
        } catch {
          // Process dead — orphaned dir, safe to delete
          rmSync(profileDir, { recursive: true, force: true });
        }
      } catch {
        // Individual dir error — skip it, never throw
      }
    }
  } catch {
    // readdirSync failure (e.g. permissions) — silently skip
  }
}

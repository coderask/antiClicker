// tests/unit/sweep.test.ts
//
// Phase 6: Unit tests for the orphan profile dir sweep logic.
// Tests sweepOrphanedProfiles() in isolation by mocking fs and process.kill.
//
// We mock node:fs functions individually using vi.mock hoisting.
// process.kill is mocked via the injectable `_killFn` parameter on the function.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock is hoisted before imports, so these mocks intercept sweep.ts's imports.
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    readdirSync: vi.fn(),
    rmSync: vi.fn(),
    readFileSync: vi.fn(),
    existsSync: vi.fn(),
  };
});

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  return {
    ...actual,
    tmpdir: vi.fn(() => '/tmp'),
  };
});

// Must import after vi.mock declarations so mocks are in place
import * as fs from 'node:fs';
import { sweepOrphanedProfiles } from '../../src/main/sweep.js';

describe('sweepOrphanedProfiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ignores directories that do not match the anticlicker-profile- prefix', () => {
    vi.mocked(fs.readdirSync).mockReturnValue(['some-other-dir', 'another-dir'] as unknown as ReturnType<typeof fs.readdirSync>);
    sweepOrphanedProfiles();
    expect(fs.rmSync).not.toHaveBeenCalled();
  });

  it('deletes a dir when pid.txt is missing (treated as orphaned)', () => {
    vi.mocked(fs.readdirSync).mockReturnValue(['anticlicker-profile-abc123'] as unknown as ReturnType<typeof fs.readdirSync>);
    vi.mocked(fs.existsSync).mockReturnValue(false); // pid.txt does not exist
    sweepOrphanedProfiles();
    expect(fs.rmSync).toHaveBeenCalledWith('/tmp/anticlicker-profile-abc123', {
      recursive: true,
      force: true,
    });
  });

  it('deletes a dir when the pid is dead (process.kill throws ESRCH)', () => {
    vi.mocked(fs.readdirSync).mockReturnValue(['anticlicker-profile-deadpid'] as unknown as ReturnType<typeof fs.readdirSync>);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('12345' as unknown as ReturnType<typeof fs.readFileSync>);

    // Use the injectable kill parameter to simulate dead process
    const deadKill = () => { throw new Error('ESRCH'); };
    sweepOrphanedProfiles(deadKill);

    expect(fs.rmSync).toHaveBeenCalledWith('/tmp/anticlicker-profile-deadpid', {
      recursive: true,
      force: true,
    });
  });

  it('preserves a dir when the pid is alive (kill does not throw)', () => {
    vi.mocked(fs.readdirSync).mockReturnValue(['anticlicker-profile-alivepid'] as unknown as ReturnType<typeof fs.readdirSync>);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('99999' as unknown as ReturnType<typeof fs.readFileSync>);

    const aliveKill = () => { /* no-op: process alive */ };
    sweepOrphanedProfiles(aliveKill);

    expect(fs.rmSync).not.toHaveBeenCalled();
  });

  it('deletes a dir when pid.txt contains an invalid (non-integer) value', () => {
    vi.mocked(fs.readdirSync).mockReturnValue(['anticlicker-profile-badpid'] as unknown as ReturnType<typeof fs.readdirSync>);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('not-a-number' as unknown as ReturnType<typeof fs.readFileSync>);

    sweepOrphanedProfiles();

    expect(fs.rmSync).toHaveBeenCalledWith('/tmp/anticlicker-profile-badpid', {
      recursive: true,
      force: true,
    });
  });

  it('handles multiple dirs — deletes dead ones, preserves alive ones', () => {
    vi.mocked(fs.readdirSync).mockReturnValue([
      'anticlicker-profile-dead1',
      'anticlicker-profile-alive',
      'anticlicker-profile-dead2',
      'unrelated-dir',
    ] as unknown as ReturnType<typeof fs.readdirSync>);

    vi.mocked(fs.existsSync).mockReturnValue(true);

    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      const p = String(path);
      if (p.includes('dead1')) return '11111' as unknown as ReturnType<typeof fs.readFileSync>;
      if (p.includes('alive')) return '22222' as unknown as ReturnType<typeof fs.readFileSync>;
      if (p.includes('dead2')) return '33333' as unknown as ReturnType<typeof fs.readFileSync>;
      return '' as unknown as ReturnType<typeof fs.readFileSync>;
    });

    // Inject a kill function: 22222 is alive, others are dead
    const injectableKill = (pid: number) => {
      if (pid === 22222) return; // alive
      const err = new Error('No such process') as NodeJS.ErrnoException;
      err.code = 'ESRCH';
      throw err;
    };

    sweepOrphanedProfiles(injectableKill);

    expect(fs.rmSync).toHaveBeenCalledTimes(2);
    expect(fs.rmSync).toHaveBeenCalledWith('/tmp/anticlicker-profile-dead1', expect.any(Object));
    expect(fs.rmSync).toHaveBeenCalledWith('/tmp/anticlicker-profile-dead2', expect.any(Object));
    expect(fs.rmSync).not.toHaveBeenCalledWith('/tmp/anticlicker-profile-alive', expect.any(Object));
    expect(fs.rmSync).not.toHaveBeenCalledWith('/tmp/unrelated-dir', expect.any(Object));
  });

  it('does not throw when readdirSync fails (graceful degradation)', () => {
    vi.mocked(fs.readdirSync).mockImplementation(() => {
      throw new Error('Permission denied');
    });
    expect(() => sweepOrphanedProfiles()).not.toThrow();
  });
});

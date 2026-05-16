// tests/unit/loadEnvKey.test.ts
//
// Unit tests for the inline .env.local parser in src/main/load-env-key.ts.
// Uses real tmp directories and fs — no mocking needed. The function is pure
// (no Electron context required) so vitest can run it in Node.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadEnvKey } from '../../src/main/load-env-key.js';

describe('loadEnvKey', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'envtest-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns null when .env.local does not exist', () => {
    expect(loadEnvKey(dir)).toBeNull();
  });

  it('parses GOOGLE_MAPS_API_KEY from a simple .env.local', () => {
    writeFileSync(join(dir, '.env.local'), 'GOOGLE_MAPS_API_KEY=AIzaTestKey123\n');
    expect(loadEnvKey(dir)).toBe('AIzaTestKey123');
  });

  it('strips surrounding double quotes from value', () => {
    writeFileSync(join(dir, '.env.local'), 'GOOGLE_MAPS_API_KEY="AIzaDoubleQuoted"\n');
    expect(loadEnvKey(dir)).toBe('AIzaDoubleQuoted');
  });

  it('strips surrounding single quotes from value', () => {
    writeFileSync(join(dir, '.env.local'), "GOOGLE_MAPS_API_KEY='AIzaSingleQuoted'\n");
    expect(loadEnvKey(dir)).toBe('AIzaSingleQuoted');
  });

  it('returns null when GOOGLE_MAPS_API_KEY is not present in file', () => {
    writeFileSync(join(dir, '.env.local'), 'SOME_OTHER_VAR=foo\nANOTHER_VAR=bar\n');
    expect(loadEnvKey(dir)).toBeNull();
  });

  it('ignores comment lines starting with #', () => {
    writeFileSync(join(dir, '.env.local'), '# GOOGLE_MAPS_API_KEY=commented\nOTHER=x\n');
    expect(loadEnvKey(dir)).toBeNull();
  });

  it('handles = sign in the value (e.g. base64-encoded keys)', () => {
    writeFileSync(join(dir, '.env.local'), 'GOOGLE_MAPS_API_KEY=AIza==base64==\n');
    expect(loadEnvKey(dir)).toBe('AIza==base64==');
  });

  it('handles whitespace around the = sign', () => {
    writeFileSync(join(dir, '.env.local'), 'GOOGLE_MAPS_API_KEY = AIzaSpaced \n');
    expect(loadEnvKey(dir)).toBe('AIzaSpaced');
  });

  it('returns the first matching line when key appears multiple times', () => {
    writeFileSync(join(dir, '.env.local'), 'GOOGLE_MAPS_API_KEY=First\nGOOGLE_MAPS_API_KEY=Second\n');
    expect(loadEnvKey(dir)).toBe('First');
  });

  it('handles a file with no trailing newline', () => {
    writeFileSync(join(dir, '.env.local'), 'GOOGLE_MAPS_API_KEY=NoNewline');
    expect(loadEnvKey(dir)).toBe('NoNewline');
  });

  it('handles empty file gracefully', () => {
    writeFileSync(join(dir, '.env.local'), '');
    expect(loadEnvKey(dir)).toBeNull();
  });

  it('handles a multiline file with the key on the last line', () => {
    writeFileSync(
      join(dir, '.env.local'),
      '# comment\nOTHER=foo\nGOOGLE_MAPS_API_KEY=LastLine\n',
    );
    expect(loadEnvKey(dir)).toBe('LastLine');
  });
});

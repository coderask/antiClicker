/**
 * tests/launcher/registry.test.ts
 *
 * Pure-logic unit tests for the Registry class.
 * No browser is launched — these run in Node via vitest.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Registry } from '../../src/launcher/registry.js';
import type { InstanceEntry } from '../../src/launcher/registry.js';
import type { BrowserContext } from 'playwright';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal stub entry — context is a plain object cast to BrowserContext. */
function makeEntry(id: string, lat = 0, lng = 0): InstanceEntry {
  return {
    id,
    context: {} as BrowserContext,   // not used by Registry logic
    userDataDir: `/tmp/anticlicker-profile-${id}`,
    coords: { latitude: lat, longitude: lng, accuracy: 50 },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Registry', () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry();
  });

  it('starts empty', () => {
    expect(registry.size()).toBe(0);
    expect(registry.list()).toEqual([]);
  });

  it('add() + list() returns correct Instance shape', () => {
    const entry = makeEntry('abc12345', 35.67, 139.65);
    registry.add(entry);

    const list = registry.list();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      id: 'abc12345',
      coords: { latitude: 35.67, longitude: 139.65, accuracy: 50 },
      userDataDir: '/tmp/anticlicker-profile-abc12345',
    });
  });

  it('list() never exposes the context property', () => {
    registry.add(makeEntry('id1'));
    const item = registry.list()[0];
    expect(item).not.toHaveProperty('context');
  });

  it('get() returns entry for known id', () => {
    const entry = makeEntry('id2');
    registry.add(entry);
    expect(registry.get('id2')).toBe(entry);
  });

  it('get() returns undefined for unknown id', () => {
    expect(registry.get('nonexistent')).toBeUndefined();
  });

  it('getOrThrow() returns entry for known id', () => {
    const entry = makeEntry('id3');
    registry.add(entry);
    expect(registry.getOrThrow('id3')).toBe(entry);
  });

  it('getOrThrow() throws InstanceNotFoundError for unknown id', () => {
    expect(() => registry.getOrThrow('ghost')).toThrowError(/Instance "ghost" not found/);
  });

  it('remove() removes entry; subsequent list() excludes it', () => {
    registry.add(makeEntry('keep'));
    registry.add(makeEntry('remove-me'));

    registry.remove('remove-me');

    const list = registry.list();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('keep');
  });

  it('remove() is a no-op for an unknown id', () => {
    registry.add(makeEntry('safe'));
    expect(() => registry.remove('never-existed')).not.toThrow();
    expect(registry.size()).toBe(1);
  });

  it('add() throws on duplicate ID', () => {
    registry.add(makeEntry('dup'));
    expect(() => registry.add(makeEntry('dup'))).toThrowError(/duplicate instance ID/);
  });

  it('size() reflects current count', () => {
    expect(registry.size()).toBe(0);
    registry.add(makeEntry('a'));
    expect(registry.size()).toBe(1);
    registry.add(makeEntry('b'));
    expect(registry.size()).toBe(2);
    registry.remove('a');
    expect(registry.size()).toBe(1);
  });

  it('updateCoords() changes stored coords', () => {
    registry.add(makeEntry('upd', 10, 20));
    registry.updateCoords('upd', { latitude: 55.5, longitude: -3.5, accuracy: 100 });
    const entry = registry.get('upd');
    expect(entry?.coords.latitude).toBe(55.5);
    expect(entry?.coords.longitude).toBe(-3.5);
  });

  it('updateCoords() is a no-op for unknown id', () => {
    expect(() =>
      registry.updateCoords('ghost', { latitude: 0, longitude: 0 }),
    ).not.toThrow();
  });

  it('entries() iterates all stored entries', () => {
    registry.add(makeEntry('e1'));
    registry.add(makeEntry('e2'));
    const ids = Array.from(registry.entries()).map((e) => e.id);
    expect(ids).toContain('e1');
    expect(ids).toContain('e2');
    expect(ids).toHaveLength(2);
  });
});

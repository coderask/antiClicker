// tests/unit/ringBuffer.test.ts
//
// Phase 5: Unit tests for the pushBounded ring-buffer utility.
// Verifies: append, cap, oldest-removal, edge cases (max=0, max=1), immutability.

import { describe, it, expect } from 'vitest';
import { pushBounded } from '../../src/renderer/src/utils/ringBuffer';

describe('pushBounded', () => {
  it('appends an item to an empty array', () => {
    const result = pushBounded([], 'a', 5);
    expect(result).toEqual(['a']);
  });

  it('appends an item when under the cap', () => {
    const result = pushBounded([1, 2, 3], 4, 10);
    expect(result).toEqual([1, 2, 3, 4]);
  });

  it('caps the array at max items', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = pushBounded(arr, 11, 10);
    expect(result).toHaveLength(10);
  });

  it('removes the oldest items (from front) when cap is exceeded', () => {
    const arr = [1, 2, 3, 4, 5];
    const result = pushBounded(arr, 6, 5);
    // Should contain [2,3,4,5,6] — oldest (1) removed
    expect(result).toEqual([2, 3, 4, 5, 6]);
  });

  it('handles inserting 12 items with max=10 — keeps newest 10', () => {
    let arr: number[] = [];
    for (let i = 1; i <= 12; i++) {
      arr = pushBounded(arr, i, 10);
    }
    expect(arr).toHaveLength(10);
    expect(arr[0]).toBe(3); // oldest kept is 3 (1 and 2 were dropped)
    expect(arr[9]).toBe(12); // newest is 12
  });

  it('max=1 always returns single-element array with the latest item', () => {
    const result1 = pushBounded([], 'x', 1);
    expect(result1).toEqual(['x']);

    const result2 = pushBounded(['x'], 'y', 1);
    expect(result2).toEqual(['y']);

    const result3 = pushBounded(['y'], 'z', 1);
    expect(result3).toEqual(['z']);
  });

  it('max=0 always returns empty array', () => {
    expect(pushBounded([], 1, 0)).toEqual([]);
    expect(pushBounded([1, 2, 3], 4, 0)).toEqual([]);
  });

  it('does not mutate the original input array', () => {
    const input = [1, 2, 3] as const;
    pushBounded(input, 4, 5);
    expect(input).toEqual([1, 2, 3]);
  });

  it('works with object items (coords)', () => {
    const coords = [
      { latitude: 35, longitude: 139 },
      { latitude: 51, longitude: -0.1 },
    ];
    const newCoord = { latitude: 40, longitude: -74 };
    const result = pushBounded(coords, newCoord, 2);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ latitude: 51, longitude: -0.1 });
    expect(result[1]).toEqual({ latitude: 40, longitude: -74 });
  });
});

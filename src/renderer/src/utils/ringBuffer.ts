/**
 * Returns a new array with `item` appended, capped at `max` items.
 * Oldest items (from the front) are removed when the cap is exceeded.
 */
export function pushBounded<T>(arr: readonly T[], item: T, max: number): T[] {
  if (max <= 0) return [];
  return [...arr, item].slice(-max);
}

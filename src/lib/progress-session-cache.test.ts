import { describe, expect, it } from 'vitest';
import { createSessionRangeCache, progressRangeCacheKey } from './progress-session-cache';

describe('progress session range cache', () => {
  it('returns previously viewed ranges by their ordered date signature', () => {
    const cache = createSessionRangeCache<number>();
    const key = progressRangeCacheKey('user-a', ['2026-08-10', '2026-08-11']);

    cache.set(key, 42);

    expect(cache.get(key)).toBe(42);
    expect(cache.get(progressRangeCacheKey('user-a', ['2026-08-11', '2026-08-10']))).toBeNull();
    expect(cache.get(progressRangeCacheKey('user-b', ['2026-08-10', '2026-08-11']))).toBeNull();
  });

  it('evicts the least recently used range when bounded capacity is reached', () => {
    const cache = createSessionRangeCache<number>(2);
    cache.set('first', 1);
    cache.set('second', 2);
    expect(cache.get('first')).toBe(1);
    cache.set('third', 3);

    expect(cache.get('second')).toBeNull();
    expect(cache.get('first')).toBe(1);
    expect(cache.size()).toBe(2);
  });
});

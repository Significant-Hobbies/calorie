import type { CycleHistoryResponse, Dashboard, HistoryResponse } from './types';

export function createSessionRangeCache<T>(limit = 8) {
  const values = new Map<string, T>();

  return {
    clear() {
      values.clear();
    },
    get(key: string) {
      const value = values.get(key) ?? null;
      if (value !== null) {
        values.delete(key);
        values.set(key, value);
      }
      return value;
    },
    set(key: string, value: T) {
      values.delete(key);
      values.set(key, value);
      while (values.size > limit) {
        const oldestKey = values.keys().next().value;
        if (oldestKey === undefined) break;
        values.delete(oldestKey);
      }
    },
    size() {
      return values.size;
    },
  };
}

export function progressRangeCacheKey(userId: string, range: string | string[]) {
  const value = Array.isArray(range) ? range.join(',') : range;
  return `${userId}:${value}`;
}

export const calendarHistorySessionCache = createSessionRangeCache<HistoryResponse>();
export const trendHistorySessionCache = createSessionRangeCache<HistoryResponse>(2);

type ProgressSessionSnapshot = {
  cycleHistory: CycleHistoryResponse | null;
  dashboard: Dashboard | null;
};

const progressSessionSnapshots = new Map<string, ProgressSessionSnapshot>();

export function getProgressSessionSnapshot(userId: string) {
  const existing = progressSessionSnapshots.get(userId);
  if (existing) return existing;
  const snapshot: ProgressSessionSnapshot = { cycleHistory: null, dashboard: null };
  progressSessionSnapshots.set(userId, snapshot);
  return snapshot;
}

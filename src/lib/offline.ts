import { openDB } from 'idb';
import type { Dashboard, PendingWrite } from './types';

const dbPromise = openDB('calorie-local', 1, {
  upgrade(db) {
    db.createObjectStore('cache');
    db.createObjectStore('queue', { keyPath: 'id' });
  },
});

export async function cacheDashboard(dashboard: Dashboard) {
  const db = await dbPromise;
  await db.put('cache', dashboard, `dashboard:${dashboard.profile.userId}`);
}

export async function readCachedDashboard(userId: string): Promise<Dashboard | null> {
  const db = await dbPromise;
  return (await db.get('cache', `dashboard:${userId}`)) ?? null;
}

export async function cachePrivateValue<T>(key: string, value: T) {
  const db = await dbPromise;
  await db.put('cache', value, `private:${key}`);
}

export async function readPrivateValue<T>(key: string): Promise<T | null> {
  const db = await dbPromise;
  return (await db.get('cache', `private:${key}`)) ?? null;
}

export async function deletePrivateValue(key: string) {
  const db = await dbPromise;
  await db.delete('cache', `private:${key}`);
}

export async function queueWrite(write: PendingWrite) {
  const db = await dbPromise;
  await db.put('queue', write);
}

export async function flushPendingWrites() {
  const db = await dbPromise;
  const writes = (await db.getAll('queue')) as PendingWrite[];
  for (const write of writes.sort((a, b) => a.createdAt - b.createdAt)) {
    try {
      const response = await fetch(write.path, {
        method: write.method,
        credentials: 'include',
        headers: write.body ? { 'Content-Type': 'application/json' } : undefined,
        body: write.body ? JSON.stringify(write.body) : undefined,
      });
      if (response.status === 401) return;
      if (response.ok || response.status === 404 || response.status === 409) {
        await db.delete('queue', write.id);
      }
    } catch {
      return;
    }
  }
}

export async function clearLocalData() {
  const db = await dbPromise;
  await Promise.all([db.clear('cache'), db.clear('queue')]);
  const registration = await navigator.serviceWorker?.getRegistration();
  registration?.active?.postMessage({ type: 'CLEAR_PRIVATE_DATA' });
}

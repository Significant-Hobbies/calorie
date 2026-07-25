import { calendarHistoryBounds } from './calendar';
import {
  demoAddEntry,
  demoAddWater,
  demoAddWeight,
  demoCalendarHistory,
  demoDashboard,
  demoDeleteEntry,
  demoDeleteFood,
  demoDeleteWater,
  demoHistory,
  demoSaveFood,
  demoSaveProfile,
} from './demo';
import {
  localAddEntry,
  localAddWater,
  localAddWeight,
  localCalendarHistory,
  localDashboard,
  localDeleteEntry,
  localDeleteFood,
  localDeleteWater,
  localHistory,
  localProfile,
  localSaveFood,
  localSaveProfile,
} from './local-store';
import {
  cacheDashboard,
  cachePrivateValue,
  flushPendingWrites,
  queueWrite,
  readCachedDashboard,
  readPrivateValue,
} from './offline';
import type {
  Dashboard,
  Food,
  FoodEntry,
  HistoryResponse,
  UserProfile,
  WaterEntry,
  WeightEntry,
} from './types';

const isDemo = () => Boolean(sessionStorage.getItem('calorie-demo'));
export const isLocalMode = () => localStorage.getItem('calorie-local-mode') === 'true';

async function readJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: 'include', cache: 'no-store' });
  const data = (await response.json().catch(() => null)) as T | { message?: string } | null;
  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'message' in data && typeof data.message === 'string'
        ? data.message
        : null;
    throw new Error(message ?? 'Calorie could not load that right now.');
  }
  return data as T;
}

async function writeJson<T>(
  path: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: unknown
): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(data?.message ?? 'Calorie could not save that. Try again.');
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

async function writeOffline<T>(input: {
  id: string;
  path: string;
  method: 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  optimistic: T;
}) {
  try {
    return await writeJson<T>(input.path, input.method, input.body);
  } catch (error) {
    if (navigator.onLine) throw error;
    await queueWrite({
      id: input.id,
      path: input.path,
      method: input.method,
      body: input.body,
      createdAt: Date.now(),
    });
    return input.optimistic;
  }
}

export async function getProfile(): Promise<UserProfile> {
  if (isDemo()) return demoDashboard().profile;
  if (isLocalMode()) return localProfile();
  try {
    const profile = await readJson<UserProfile>('/api/app/profile');
    await cachePrivateValue('profile', profile);
    return profile;
  } catch (error) {
    if (navigator.onLine) throw error;
    const cached = await readPrivateValue<UserProfile>('profile');
    if (cached) return cached;
    throw error;
  }
}

export async function saveProfile(
  profile: UserProfile & { initialWeightKg?: number; initialWeightId?: string }
) {
  if (isDemo()) return demoSaveProfile(profile);
  if (isLocalMode()) return localSaveProfile(profile);
  const saved = await writeJson<UserProfile>('/api/app/profile', 'PUT', profile);
  await cachePrivateValue('profile', saved);
  return saved;
}

export function localDayRange(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return {
    start: start.getTime(),
    end: end.getTime(),
    date: new Intl.DateTimeFormat('en-CA').format(start),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

export async function getDashboard(): Promise<Dashboard> {
  if (isDemo()) return demoDashboard();
  if (isLocalMode()) return localDashboard();
  const range = localDayRange();
  const params = new URLSearchParams({
    start: String(range.start),
    end: String(range.end),
    date: range.date,
    timezone: range.timezone,
  });
  try {
    const dashboard = await readJson<Dashboard>(`/api/app/dashboard?${params}`);
    await cacheDashboard(dashboard);
    return dashboard;
  } catch (error) {
    const profile = await getProfile().catch(() => null);
    if (profile) {
      const cached = await readCachedDashboard(profile.userId);
      if (cached) return cached;
    }
    throw error;
  }
}

export async function saveFood(food: Food): Promise<Food> {
  if (isDemo()) return demoSaveFood(food);
  if (isLocalMode()) return localSaveFood(food);
  return writeJson<Food>(
    `/api/app/foods${food.id ? `/${food.id}` : ''}`,
    food.id ? 'PUT' : 'POST',
    food
  );
}

export async function createFood(food: Food): Promise<Food> {
  if (isDemo()) return demoSaveFood(food);
  if (isLocalMode()) return localSaveFood(food);
  return writeJson<Food>('/api/app/foods', 'POST', food);
}

export async function deleteFood(id: string) {
  if (isDemo()) return demoDeleteFood(id);
  if (isLocalMode()) return localDeleteFood(id);
  return writeJson<void>(`/api/app/foods/${id}`, 'DELETE');
}

export async function addFoodEntry(input: {
  id: string;
  foodId: string;
  amount: number;
  eatenAt: number;
  optimistic: FoodEntry;
}) {
  if (isDemo()) return demoAddEntry(input);
  if (isLocalMode()) return localAddEntry(input);
  return writeOffline<FoodEntry>({
    id: `entry:${input.id}`,
    path: '/api/app/entries',
    method: 'POST',
    body: input,
    optimistic: input.optimistic,
  });
}

export async function deleteFoodEntry(id: string) {
  if (isDemo()) return demoDeleteEntry(id);
  if (isLocalMode()) return localDeleteEntry(id);
  return writeOffline<void>({
    id: `delete-entry:${id}`,
    path: `/api/app/entries/${id}`,
    method: 'DELETE',
    optimistic: undefined,
  });
}

export async function updateFoodEntry(input: {
  id: string;
  foodId: string;
  amount: number;
  eatenAt: number;
  optimistic: FoodEntry;
}) {
  if (isDemo()) {
    demoDeleteEntry(input.id);
    return demoAddEntry(input);
  }
  if (isLocalMode()) return localAddEntry(input);
  return writeOffline<FoodEntry>({
    id: `update-entry:${input.id}:${Date.now()}`,
    path: `/api/app/entries/${input.id}`,
    method: 'PATCH',
    body: input,
    optimistic: input.optimistic,
  });
}

export async function addWater(input: WaterEntry) {
  if (isDemo()) return demoAddWater(input);
  if (isLocalMode()) return localAddWater(input);
  return writeOffline<WaterEntry>({
    id: `water:${input.id}`,
    path: '/api/app/water',
    method: 'POST',
    body: input,
    optimistic: input,
  });
}

export async function deleteWater(id: string) {
  if (isDemo()) return demoDeleteWater(id);
  if (isLocalMode()) return localDeleteWater(id);
  return writeOffline<void>({
    id: `delete-water:${id}`,
    path: `/api/app/water/${id}`,
    method: 'DELETE',
    optimistic: undefined,
  });
}

export async function addWeight(input: WeightEntry) {
  if (isDemo()) return demoAddWeight(input);
  if (isLocalMode()) return localAddWeight(input);
  return writeOffline<WeightEntry>({
    id: `weight:${input.id}`,
    path: '/api/app/weights',
    method: 'POST',
    body: input,
    optimistic: input,
  });
}

export async function getHistory(rangeDays: 7 | 30): Promise<HistoryResponse> {
  if (isDemo()) return demoHistory(rangeDays);
  if (isLocalMode()) return localHistory(rangeDays);
  const end = new Date();
  end.setHours(24, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - rangeDays);
  const params = new URLSearchParams({
    start: String(start.getTime()),
    end: String(end.getTime()),
    days: String(rangeDays),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  return readJson(`/api/app/history?${params}`);
}

export async function getCalendarHistory(dateKeys: string[]): Promise<HistoryResponse> {
  if (isDemo()) return demoCalendarHistory(dateKeys);
  if (isLocalMode()) return localCalendarHistory(dateKeys);
  const cells = dateKeys.map((date) => ({ date, day: 0, inMonth: true }));
  const bounds = calendarHistoryBounds(cells);
  const tomorrow = new Date();
  tomorrow.setHours(24, 0, 0, 0);
  const params = new URLSearchParams({
    start: String(bounds.start),
    end: String(Math.min(bounds.end, tomorrow.getTime())),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  const response = await readJson<HistoryResponse>(`/api/app/history?${params}`);
  const byDate = new Map(response.days.map((day) => [day.date, day]));
  return {
    ...response,
    days: dateKeys.map(
      (date) =>
        byDate.get(date) ?? {
          date,
          calories: 0,
          carbsG: 0,
          proteinG: 0,
          fibreG: 0,
          waterMl: 0,
          fastCount: 0,
        }
    ),
  };
}

export function startOfflineRetry() {
  const retry = () => void flushPendingWrites();
  window.addEventListener('online', retry);
  retry();
  return () => window.removeEventListener('online', retry);
}

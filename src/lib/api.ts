import { type AppSession, getSession } from './auth-client';
import { calendarHistoryBounds } from './calendar';
import {
  demoAddEntry,
  demoAddMedicationCheckIn,
  demoAddWater,
  demoAddWeight,
  demoArchiveMedication,
  demoCalendarHistory,
  demoCycleHistory,
  demoDashboard,
  demoDeleteEntry,
  demoDeleteFood,
  demoDeleteMedicationCheckIn,
  demoDeleteWater,
  demoDeleteWeight,
  demoHistory,
  demoJournalExport,
  demoListFoods,
  demoSaveFood,
  demoSaveMedication,
  demoSaveProfile,
  demoSetFoodArchived,
  demoUpdateCycleStart,
  demoUpdateWater,
  demoUpdateWeight,
} from './demo';
import { type FoodLifecycle, foodsByLifecycle, normalizeFood } from './food-library';
import {
  localAddEntry,
  localAddMedicationCheckIn,
  localAddWater,
  localAddWeight,
  localArchiveMedication,
  localCalendarHistory,
  localCycleHistory,
  localDashboard,
  localDeleteEntry,
  localDeleteFood,
  localDeleteMedicationCheckIn,
  localDeleteWater,
  localDeleteWeight,
  localHistory,
  localJournalExport,
  localListFoods,
  localProfile,
  localSaveFood,
  localSaveMedication,
  localSaveProfile,
  localSetFoodArchived,
  localUpdateCycleStart,
  localUpdateWater,
  localUpdateWeight,
} from './local-store';
import {
  cacheDashboard,
  cachePrivateValue,
  dashboardCacheAge,
  deleteDashboardCache,
  deletePrivateValue,
  flushPendingWrites,
  queueWrite,
  readCachedDashboard,
  readPrivateValue,
} from './offline';
import { normalizeProfile } from './profile';
import type {
  CycleHistoryResponse,
  Dashboard,
  Food,
  FoodEntry,
  FoodEntryWrite,
  GoalCycleSession,
  HistoryResponse,
  JournalExport,
  Medication,
  MedicationCheckIn,
  UserProfile,
  WaterEntry,
  WeightEntry,
} from './types';

const isDemo = () => Boolean(sessionStorage.getItem('calorie-demo'));
export const isLocalMode = () => localStorage.getItem('calorie-local-mode') === 'true';

/**
 * In-flight request deduplication. If multiple callers request the same key
 * before the first resolves, they all share the same promise.
 */
const inflight = new Map<string, Promise<unknown>>();

function dedupe<T>(key: string, factory: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const promise = factory().finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise as Promise<T>;
}

type AppBootstrap = {
  session: NonNullable<AppSession>;
  profile: UserProfile;
};

function normalizeDashboard(dashboard: Dashboard): Dashboard {
  return {
    ...dashboard,
    profile: normalizeProfile(dashboard.profile),
    foods: foodsByLifecycle(dashboard.foods ?? [], 'active'),
    medications: dashboard.medications ?? [],
    medicationCheckIns: dashboard.medicationCheckIns ?? [],
  };
}

async function invalidateDashboardCache() {
  const profile = await getProfile().catch(() => null);
  if (profile) await deleteDashboardCache(profile.userId);
}

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

export async function getBootstrap(): Promise<AppBootstrap | null> {
  if (isDemo() || isLocalMode()) {
    const session = await getSession();
    if (!session) return null;
    const profile = isDemo() ? demoDashboard().profile : localProfile();
    return { session, profile: normalizeProfile(profile) };
  }

  try {
    const response = await fetch('/api/app/bootstrap', {
      credentials: 'include',
      cache: 'no-store',
    });
    if (response.status === 401) {
      await deletePrivateValue('session');
      return null;
    }
    const data = (await response.json().catch(() => null)) as
      | AppBootstrap
      | { message?: string }
      | null;
    if (!response.ok || !data || !('session' in data) || !('profile' in data)) {
      const message =
        data && 'message' in data && typeof data.message === 'string'
          ? data.message
          : 'Calorie could not open right now.';
      throw new Error(message);
    }

    const bootstrap = {
      session: data.session,
      profile: normalizeProfile(data.profile),
    };
    await Promise.all([
      cachePrivateValue('session', bootstrap.session),
      cachePrivateValue('profile', bootstrap.profile),
    ]);
    return bootstrap;
  } catch (error) {
    const [session, profile] = await Promise.all([getSession(), getProfile().catch(() => null)]);
    if (session && profile) return { session, profile };
    throw error;
  }
}

export async function getProfile(): Promise<UserProfile> {
  if (isDemo()) return normalizeProfile(demoDashboard().profile);
  if (isLocalMode()) return normalizeProfile(localProfile());
  try {
    const profile = normalizeProfile(await readJson<UserProfile>('/api/app/profile'));
    await cachePrivateValue('profile', profile);
    return profile;
  } catch (error) {
    if (navigator.onLine) throw error;
    const cached = await readPrivateValue<UserProfile>('profile');
    if (cached) return normalizeProfile(cached);
    throw error;
  }
}

export async function saveProfile(
  profile: UserProfile & { initialWeightKg?: number; initialWeightId?: string }
) {
  if (isDemo()) return demoSaveProfile(profile);
  if (isLocalMode()) return localSaveProfile(profile);
  const saved = normalizeProfile(
    await writeJson<UserProfile>('/api/app/profile', 'PUT', {
      ...profile,
      cycleDate: localDayRange().date,
    })
  );
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
  if (isDemo()) return normalizeDashboard(demoDashboard());
  if (isLocalMode()) return normalizeDashboard(localDashboard());
  const range = localDayRange();
  const params = new URLSearchParams({
    start: String(range.start),
    end: String(range.end),
    date: range.date,
    timezone: range.timezone,
  });
  return dedupe(`dashboard:${range.date}`, async () => {
    // Stale-while-revalidate: if we have a cache fresher than 30s, serve it
    // immediately and skip the network. The service worker + ETag handle
    // longer staleness transparently.
    const profile = await getProfile().catch(() => null);
    if (profile) {
      const age = await dashboardCacheAge(profile.userId);
      if (age !== null && age < 30_000) {
        const cached = await readCachedDashboard(profile.userId);
        if (cached) return normalizeDashboard(cached);
      }
    }
    try {
      const dashboard = normalizeDashboard(
        await readJson<Dashboard>(`/api/app/dashboard?${params}`)
      );
      await cacheDashboard(dashboard);
      return dashboard;
    } catch (error) {
      if (profile) {
        const cached = await readCachedDashboard(profile.userId);
        if (cached) return normalizeDashboard(cached);
      }
      throw error;
    }
  });
}

export async function saveFood(food: Food): Promise<Food> {
  if (isDemo()) return demoSaveFood(food);
  if (isLocalMode()) return localSaveFood(food);
  const saved = await writeJson<Food>(
    `/api/app/foods${food.id ? `/${food.id}` : ''}`,
    food.id ? 'PUT' : 'POST',
    food
  );
  await invalidateDashboardCache();
  return normalizeFood(saved);
}

export async function createFood(food: Food): Promise<Food> {
  if (isDemo()) return demoSaveFood(food);
  if (isLocalMode()) return localSaveFood(food);
  const saved = await writeJson<Food>('/api/app/foods', 'POST', food);
  await invalidateDashboardCache();
  return normalizeFood(saved);
}

export async function getFoods(lifecycle: FoodLifecycle): Promise<Food[]> {
  if (isDemo()) return demoListFoods(lifecycle);
  if (isLocalMode()) return localListFoods(lifecycle);
  const foods = await readJson<Food[]>(`/api/app/foods?status=${lifecycle}`);
  return foods.map(normalizeFood);
}

export async function setFoodArchived(food: Food, archivedAt: number | null): Promise<Food> {
  if (isDemo()) return demoSetFoodArchived(food.id, archivedAt);
  if (isLocalMode()) return localSetFoodArchived(food.id, archivedAt);
  const optimistic = { ...food, archivedAt };
  const saved = await writeOffline<Food>({
    id: `food-lifecycle:${food.id}:${archivedAt ?? 'active'}:${Date.now()}`,
    path: `/api/app/foods/${food.id}`,
    method: 'PATCH',
    body: { archivedAt },
    optimistic,
  });
  await invalidateDashboardCache();
  return normalizeFood(saved);
}

export async function deleteFood(id: string) {
  if (isDemo()) return demoDeleteFood(id);
  if (isLocalMode()) return localDeleteFood(id);
  await writeJson<void>(`/api/app/foods/${id}`, 'DELETE');
  await invalidateDashboardCache();
}

export async function addFoodEntry(input: FoodEntryWrite) {
  if (isDemo()) return demoAddEntry(input);
  if (isLocalMode()) return localAddEntry(input);
  const { optimistic, ...body } = input;
  return writeOffline<FoodEntry>({
    id: `entry:${input.id}`,
    path: '/api/app/entries',
    method: 'POST',
    body,
    optimistic,
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

export async function updateFoodEntry(input: FoodEntryWrite) {
  if (isDemo()) {
    demoDeleteEntry(input.id);
    return demoAddEntry(input);
  }
  if (isLocalMode()) return localAddEntry(input);
  const { optimistic, ...body } = input;
  return writeOffline<FoodEntry>({
    id: `update-entry:${input.id}:${Date.now()}`,
    path: `/api/app/entries/${input.id}`,
    method: 'PATCH',
    body,
    optimistic,
  });
}

export async function addWater(input: WaterEntry) {
  if (isDemo()) return demoAddWater(input);
  if (isLocalMode()) return localAddWater(input);
  const saved = await writeOffline<WaterEntry>({
    id: `water:${input.id}`,
    path: '/api/app/water',
    method: 'POST',
    body: input,
    optimistic: input,
  });
  await invalidateDashboardCache();
  return saved;
}

export async function updateWater(input: WaterEntry) {
  if (isDemo()) return demoUpdateWater(input);
  if (isLocalMode()) return localUpdateWater(input);
  const saved = await writeOffline<WaterEntry>({
    id: `update-water:${input.id}:${Date.now()}`,
    path: `/api/app/water/${input.id}`,
    method: 'PATCH',
    body: input,
    optimistic: input,
  });
  await invalidateDashboardCache();
  return saved;
}

export async function deleteWater(id: string) {
  if (isDemo()) return demoDeleteWater(id);
  if (isLocalMode()) return localDeleteWater(id);
  const result = await writeOffline<void>({
    id: `delete-water:${id}`,
    path: `/api/app/water/${id}`,
    method: 'DELETE',
    optimistic: undefined,
  });
  await invalidateDashboardCache();
  return result;
}

export async function saveMedication(input: Medication) {
  if (isDemo()) return demoSaveMedication(input);
  if (isLocalMode()) return localSaveMedication(input);
  return writeOffline<Medication>({
    id: `medication:${input.id}`,
    path: '/api/app/medications',
    method: 'POST',
    body: input,
    optimistic: input,
  });
}

export async function updateMedication(input: Medication) {
  if (isDemo()) return demoSaveMedication(input);
  if (isLocalMode()) return localSaveMedication(input);
  return writeOffline<Medication>({
    id: `update-medication:${input.id}:${Date.now()}`,
    path: `/api/app/medications/${input.id}`,
    method: 'PATCH',
    body: input,
    optimistic: input,
  });
}

export async function archiveMedication(input: Medication) {
  const archived = { ...input, archivedAt: Date.now() };
  if (isDemo()) return demoArchiveMedication(input.id, archived.archivedAt);
  if (isLocalMode()) return localArchiveMedication(input.id, archived.archivedAt);
  return writeOffline<Medication>({
    id: `archive-medication:${input.id}:${archived.archivedAt}`,
    path: `/api/app/medications/${input.id}`,
    method: 'PATCH',
    body: archived,
    optimistic: archived,
  });
}

export async function addMedicationCheckIn(input: MedicationCheckIn) {
  if (isDemo()) return demoAddMedicationCheckIn(input);
  if (isLocalMode()) return localAddMedicationCheckIn(input);
  return writeOffline<MedicationCheckIn>({
    id: `medication-check-in:${input.id}`,
    path: '/api/app/medication-check-ins',
    method: 'POST',
    body: input,
    optimistic: input,
  });
}

export async function deleteMedicationCheckIn(id: string) {
  if (isDemo()) return demoDeleteMedicationCheckIn(id);
  if (isLocalMode()) return localDeleteMedicationCheckIn(id);
  return writeOffline<void>({
    id: `delete-medication-check-in:${id}`,
    path: `/api/app/medication-check-ins/${id}`,
    method: 'DELETE',
    optimistic: undefined,
  });
}

export async function addWeight(input: WeightEntry) {
  if (isDemo()) return demoAddWeight(input);
  if (isLocalMode()) return localAddWeight(input);
  const saved = await writeOffline<WeightEntry>({
    id: `weight:${input.id}`,
    path: '/api/app/weights',
    method: 'POST',
    body: input,
    optimistic: input,
  });
  await invalidateDashboardCache();
  return saved;
}

export async function updateWeight(input: WeightEntry) {
  if (isDemo()) return demoUpdateWeight(input);
  if (isLocalMode()) return localUpdateWeight(input);
  const saved = await writeOffline<WeightEntry>({
    id: `update-weight:${input.id}:${Date.now()}`,
    path: `/api/app/weights/${input.id}`,
    method: 'PATCH',
    body: input,
    optimistic: input,
  });
  await invalidateDashboardCache();
  return saved;
}

export async function deleteWeight(id: string) {
  if (isDemo()) return demoDeleteWeight(id);
  if (isLocalMode()) return localDeleteWeight(id);
  const result = await writeOffline<void>({
    id: `delete-weight:${id}:${Date.now()}`,
    path: `/api/app/weights/${id}`,
    method: 'DELETE',
    optimistic: undefined,
  });
  await invalidateDashboardCache();
  return result;
}

function historyBounds(startOn: string, endOn: string | null, today: string) {
  const start = new Date(`${startOn}T12:00:00`);
  start.setHours(0, 0, 0, 0);
  const end = new Date(`${endOn ?? today}T12:00:00`);
  end.setHours(0, 0, 0, 0);
  if (!endOn) end.setDate(end.getDate() + 1);
  const cappedStart = new Date(
    Math.max(start.getTime(), end.getTime() - 366 * 24 * 60 * 60 * 1000)
  );
  return { start: cappedStart.getTime(), end: end.getTime() };
}

async function readCyclePeriod(session: GoalCycleSession, today: string) {
  const bounds = historyBounds(session.startOn, session.endOn, today);
  const params = new URLSearchParams({
    start: String(bounds.start),
    end: String(bounds.end),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  const history = await readJson<HistoryResponse>(`/api/app/history?${params}`);
  return { session, days: history.days, weights: history.weights };
}

export async function getCycleHistory(): Promise<CycleHistoryResponse> {
  if (isDemo()) return demoCycleHistory();
  if (isLocalMode()) return localCycleHistory();
  const range = localDayRange();
  const sessions = await readJson<GoalCycleSession[]>(
    `/api/app/cycles?date=${encodeURIComponent(range.date)}`
  );
  const active = sessions.find((session) => session.endOn === null);
  if (!active) throw new Error('Active cycle not found.');
  const previous = sessions
    .filter((session) => session.endOn !== null)
    .sort((a, b) => (b.endOn ?? '').localeCompare(a.endOn ?? ''))[0];
  const [activePeriod, previousPeriod] = await Promise.all([
    readCyclePeriod(active, range.date),
    previous ? readCyclePeriod(previous, range.date) : Promise.resolve(null),
  ]);
  return {
    active: activePeriod,
    previous: previousPeriod,
    today: range.date,
    timezone: range.timezone,
  };
}

export async function updateCycleStart(startOn: string) {
  if (isDemo()) return demoUpdateCycleStart(startOn);
  if (isLocalMode()) return localUpdateCycleStart(startOn);
  return writeJson<GoalCycleSession>('/api/app/cycles/active', 'PATCH', {
    startOn,
    today: localDayRange().date,
  });
}

export async function getJournalExport(): Promise<JournalExport> {
  if (isDemo()) return demoJournalExport();
  if (isLocalMode()) return localJournalExport();
  return readJson<JournalExport>('/api/app/export');
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
  return dedupe(`history:${rangeDays}:${end.toDateString()}`, () =>
    readJson<HistoryResponse>(`/api/app/history?${params}`)
  );
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

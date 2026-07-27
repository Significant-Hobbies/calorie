import { calendarHistoryBounds } from './calendar';
import { normalizeDirectEntry } from './entries';
import {
  calculateCompletedFasts,
  calculateNutritionTarget,
  round,
  scaleNutrients,
} from './recommendations';
import type {
  Dashboard,
  Food,
  FoodEntry,
  FoodEntryWrite,
  HistoryDay,
  HistoryResponse,
  UserProfile,
  WaterEntry,
  WeightEntry,
} from './types';

const LOCAL_STATE_KEY = 'calorie-local-state-v1';

type LocalState = {
  version: 1;
  profile: UserProfile;
  foods: Food[];
  entries: FoodEntry[];
  waterEntries: WaterEntry[];
  weights: WeightEntry[];
};

function initialState(): LocalState {
  return {
    version: 1,
    profile: {
      userId: 'local-user',
      displayName: '',
      units: 'metric',
      ageYears: null,
      genderIdentity: null,
      equationProfile: 'none',
      heightCm: null,
      activityLevel: 'moderate',
      goal: 'maintain',
      targetWeightKg: null,
      manualCalorieTarget: null,
      wakeTime: '07:00',
      sleepHours: 8,
      fastingThresholdHours: 12,
      waterTargetMl: 2000,
      onboardingComplete: false,
    },
    foods: [],
    entries: [],
    waterEntries: [],
    weights: [],
  };
}

function readState(): LocalState {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_STATE_KEY) ?? '') as LocalState;
    if (parsed.version === 1) return parsed;
  } catch {
    // A missing or unreadable local journal starts clean.
  }
  const state = initialState();
  writeState(state);
  return state;
}

function writeState(state: LocalState) {
  localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(state));
}

function dateKey(timestamp: number) {
  return new Intl.DateTimeFormat('en-CA').format(timestamp);
}

function dayRange(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.getTime(), end: end.getTime() };
}

export function localProfile() {
  return readState().profile;
}

export function localSaveProfile(
  next: UserProfile & { initialWeightKg?: number; initialWeightId?: string }
) {
  const state = readState();
  state.profile = {
    ...next,
    userId: 'local-user',
    onboardingComplete: true,
  };
  if (next.initialWeightKg) {
    state.weights.push({
      id: next.initialWeightId ?? crypto.randomUUID(),
      weightKg: next.initialWeightKg,
      recordedAt: Date.now(),
    });
  }
  writeState(state);
  return state.profile;
}

export function localSaveFood(food: Food) {
  const state = readState();
  const index = state.foods.findIndex((item) => item.id === food.id);
  if (index >= 0) state.foods[index] = food;
  else state.foods.unshift(food);
  writeState(state);
  return food;
}

export function localDeleteFood(id: string) {
  const state = readState();
  state.foods = state.foods.filter((food) => food.id !== id);
  state.entries = state.entries.map((entry) =>
    entry.foodId === id ? { ...entry, foodId: null } : entry
  );
  writeState(state);
}

export function localAddEntry(input: FoodEntryWrite) {
  const state = readState();
  if (!input.foodId) {
    const { optimistic: _optimistic, ...snapshot } = input;
    const entry = normalizeDirectEntry(snapshot);
    state.entries = [entry, ...state.entries.filter((item) => item.id !== entry.id)];
    writeState(state);
    return entry;
  }
  const food = state.foods.find((item) => item.id === input.foodId);
  if (!food) throw new Error('Saved food not found.');
  const entry: FoodEntry = {
    id: input.id,
    foodId: food.id,
    foodName: food.name,
    amount: input.amount,
    unitLabel: food.servingMode === 'per_100g' ? 'g' : food.unitLabel,
    ...scaleNutrients(food, food.servingMode, input.amount),
    eatenAt: input.eatenAt,
  };
  state.entries = [entry, ...state.entries.filter((item) => item.id !== entry.id)];
  food.lastUsedAt = input.eatenAt;
  writeState(state);
  return entry;
}

export function localDeleteEntry(id: string) {
  const state = readState();
  state.entries = state.entries.filter((entry) => entry.id !== id);
  writeState(state);
}

export function localAddWater(input: WaterEntry) {
  const state = readState();
  state.waterEntries = [input, ...state.waterEntries.filter((entry) => entry.id !== input.id)];
  writeState(state);
  return input;
}

export function localDeleteWater(id: string) {
  const state = readState();
  state.waterEntries = state.waterEntries.filter((entry) => entry.id !== id);
  writeState(state);
}

export function localAddWeight(input: WeightEntry) {
  const state = readState();
  state.weights = [...state.weights.filter((entry) => entry.id !== input.id), input].sort(
    (a, b) => a.recordedAt - b.recordedAt
  );
  writeState(state);
  return input;
}

export function localDashboard(): Dashboard {
  const state = readState();
  const range = dayRange();
  const entries = state.entries
    .filter((entry) => entry.eatenAt >= range.start && entry.eatenAt < range.end)
    .sort((a, b) => b.eatenAt - a.eatenAt);
  const waterEntries = state.waterEntries
    .filter((entry) => entry.drankAt >= range.start && entry.drankAt < range.end)
    .sort((a, b) => b.drankAt - a.drankAt);
  const latestWeight = [...state.weights].sort((a, b) => b.recordedAt - a.recordedAt)[0] ?? null;
  const nutrients = entries.reduce(
    (total, entry) => ({
      calories: total.calories + entry.calories,
      carbsG: total.carbsG + entry.carbsG,
      proteinG: total.proteinG + entry.proteinG,
      fibreG: total.fibreG + entry.fibreG,
    }),
    { calories: 0, carbsG: 0, proteinG: 0, fibreG: 0 }
  );
  return {
    profile: state.profile,
    foods: [...state.foods].sort(
      (a, b) =>
        Number(b.favourite) - Number(a.favourite) ||
        (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0) ||
        a.name.localeCompare(b.name)
    ),
    entries,
    waterEntries,
    latestWeight,
    totals: {
      calories: round(nutrients.calories),
      carbsG: round(nutrients.carbsG, 1),
      proteinG: round(nutrients.proteinG, 1),
      fibreG: round(nutrients.fibreG, 1),
      waterMl: waterEntries.reduce((sum, entry) => sum + entry.amountMl, 0),
    },
    target: calculateNutritionTarget({
      weightKg: latestWeight?.weightKg ?? null,
      heightCm: state.profile.heightCm,
      ageYears: state.profile.ageYears,
      equationProfile: state.profile.equationProfile,
      activityLevel: state.profile.activityLevel,
      goal: state.profile.goal,
      manualCalorieTarget: state.profile.manualCalorieTarget,
    }),
    completedFasts: calculateCompletedFasts(
      state.entries.filter((entry) => entry.eatenAt >= range.start - 31 * 24 * 60 * 60 * 1000),
      state.profile.fastingThresholdHours
    ),
    date: dateKey(Date.now()),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

function buildLocalHistory(
  dateKeys: string[],
  startAt: number,
  endAt: number,
  rangeDays?: 7 | 30
): HistoryResponse {
  const state = readState();
  const days = new Map<string, HistoryDay>();
  for (const key of dateKeys) {
    days.set(key, {
      date: key,
      calories: 0,
      carbsG: 0,
      proteinG: 0,
      fibreG: 0,
      waterMl: 0,
      fastCount: 0,
    });
  }
  const entries = state.entries
    .filter((entry) => entry.eatenAt >= startAt && entry.eatenAt < endAt)
    .sort((a, b) => a.eatenAt - b.eatenAt);
  for (const entry of entries) {
    const day = days.get(dateKey(entry.eatenAt));
    if (!day) continue;
    day.calories += entry.calories;
    day.carbsG += entry.carbsG;
    day.proteinG += entry.proteinG;
    day.fibreG += entry.fibreG;
  }
  for (const entry of state.waterEntries) {
    const day = days.get(dateKey(entry.drankAt));
    if (day) day.waterMl += entry.amountMl;
  }
  const prior = [...state.entries]
    .filter((entry) => entry.eatenAt < startAt)
    .sort((a, b) => b.eatenAt - a.eatenAt)[0];
  for (const fast of calculateCompletedFasts(
    prior ? [prior, ...entries] : entries,
    state.profile.fastingThresholdHours
  )) {
    const day = days.get(dateKey(fast.endAt));
    if (day) day.fastCount += 1;
  }
  return {
    days: [...days.values()].map((day) => ({
      ...day,
      calories: round(day.calories),
      carbsG: round(day.carbsG, 1),
      proteinG: round(day.proteinG, 1),
      fibreG: round(day.fibreG, 1),
    })),
    weights: state.weights.filter(
      (entry) => entry.recordedAt >= startAt && entry.recordedAt < endAt
    ),
    ...(rangeDays ? { rangeDays } : {}),
  };
}

export function localHistory(rangeDays: 7 | 30): HistoryResponse {
  const today = dayRange();
  const start = new Date(today.start);
  start.setDate(start.getDate() - (rangeDays - 1));
  const dateKeys = Array.from({ length: rangeDays }, (_, index) => {
    const date = new Date(start);
    date.setDate(date.getDate() + index);
    return dateKey(date.getTime());
  });
  return buildLocalHistory(dateKeys, start.getTime(), today.end, rangeDays);
}

export function localCalendarHistory(dateKeys: string[]): HistoryResponse {
  const cells = dateKeys.map((date) => ({ date, day: 0, inMonth: true }));
  const { start, end } = calendarHistoryBounds(cells);
  return buildLocalHistory(dateKeys, start, Math.min(end, dayRange().end));
}

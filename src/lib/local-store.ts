import { calendarHistoryBounds, dateFromKey, localDateKey } from './calendar';
import { transitionCycleSessions, updateActiveCycleStart } from './cycle-sessions';
import { normalizeDirectEntry } from './entries';
import {
  detachFoodDefinition,
  type FoodLifecycle,
  foodsByLifecycle,
  normalizeFood,
  normalizeFoodEntry,
} from './food-library';
import { entriesWithinRange } from './history';
import { createJournalExport } from './journal-export';
import { sumNutrients } from './nutrients';
import { activeMedications, upsertMedicationCheckIn } from './medications';
import {
  calculateCompletedFasts,
  calculateNutritionTarget,
  round,
  scaleNutrients,
} from './recommendations';
import type {
  CycleHistoryResponse,
  Dashboard,
  Food,
  FoodEntry,
  FoodEntryWrite,
  GoalCycleSession,
  HistoryDay,
  HistoryResponse,
  Medication,
  MedicationCheckIn,
  UserProfile,
  WaterEntry,
  WeightEntry,
} from './types';

const LOCAL_STATE_KEY = 'calorie-local-state-v1';

type LocalState = {
  version: 5;
  profile: UserProfile;
  foods: Food[];
  entries: FoodEntry[];
  waterEntries: WaterEntry[];
  medications: Medication[];
  medicationCheckIns: MedicationCheckIn[];
  weights: WeightEntry[];
  cycleSessions: GoalCycleSession[];
};

function initialState(): LocalState {
  return {
    version: 5,
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
      manualCalorieRange: null,
      wakeTime: '07:00',
      sleepHours: 8,
      fastingThresholdHours: 12,
      waterTargetMl: 2000,
      dailyActionOrder: ['weight', 'creatine', 'food', 'water'],
      dailyActionHidden: [],
      onboardingComplete: false,
    },
    foods: [],
    entries: [],
    waterEntries: [],
    medications: [],
    medicationCheckIns: [],
    weights: [],
    cycleSessions: [],
  };
}

function readState(): LocalState {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_STATE_KEY) ?? '') as Omit<
      Partial<LocalState>,
      'version' | 'profile'
    > & {
      version?: number;
      profile?: Partial<UserProfile>;
    };
    if ([1, 2, 3, 4, 5].includes(parsed.version ?? 0)) {
      const fallback = initialState();
      const legacyManualTarget = parsed.profile?.manualCalorieTarget ?? null;
      return {
        ...fallback,
        ...parsed,
        version: 5,
        profile: {
          ...fallback.profile,
          ...parsed.profile,
          manualCalorieRange:
            parsed.profile?.manualCalorieRange ??
            (legacyManualTarget
              ? [Math.max(800, legacyManualTarget - 100), legacyManualTarget + 100]
              : null),
        },
        foods: (parsed.foods ?? []).map(normalizeFood),
        entries: (parsed.entries ?? []).map(normalizeFoodEntry),
        waterEntries: parsed.waterEntries ?? [],
        medications: parsed.medications ?? [],
        medicationCheckIns: parsed.medicationCheckIns ?? [],
        weights: parsed.weights ?? [],
        cycleSessions: parsed.cycleSessions ?? [],
      };
    }
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
  const today = localDateKey(new Date());
  const now = Date.now();
  const latestWeight = [...state.weights].sort((a, b) => b.recordedAt - a.recordedAt)[0];
  const target = calculateNutritionTarget({
    weightKg: next.initialWeightKg ?? latestWeight?.weightKg ?? null,
    heightCm: next.heightCm,
    ageYears: next.ageYears,
    equationProfile: next.equationProfile,
    activityLevel: next.activityLevel,
    goal: next.goal,
    manualCalorieTarget: next.manualCalorieTarget,
    manualCalorieRange: next.manualCalorieRange,
  });
  state.cycleSessions = transitionCycleSessions({
    sessions: state.cycleSessions,
    nextProfile: next,
    target,
    today,
    now,
    id: crypto.randomUUID(),
    userId: 'local-user',
  });
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
  const normalized = normalizeFood(food);
  const index = state.foods.findIndex((item) => item.id === normalized.id);
  if (index >= 0) state.foods[index] = normalized;
  else state.foods.unshift(normalized);
  writeState(state);
  return normalized;
}

export function localListFoods(lifecycle: FoodLifecycle) {
  return foodsByLifecycle(readState().foods, lifecycle).sort(
    (a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0) || a.name.localeCompare(b.name)
  );
}

export function localSetFoodArchived(id: string, archivedAt: number | null) {
  const state = readState();
  const food = state.foods.find((item) => item.id === id);
  if (!food) throw new Error('Food not found.');
  food.archivedAt = archivedAt;
  writeState(state);
  return food;
}

export function localDeleteFood(id: string) {
  const state = readState();
  state.foods = state.foods.filter((food) => food.id !== id);
  state.entries = detachFoodDefinition(state.entries, id);
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
  const food = state.foods.find((item) => item.id === input.foodId && item.archivedAt === null);
  if (!food) throw new Error('Saved food not found.');
  const entry: FoodEntry = {
    id: input.id,
    foodId: food.id,
    foodName: food.name,
    amount: input.amount,
    unitLabel: food.servingMode === 'per_100g' ? 'g' : food.unitLabel,
    ...scaleNutrients(food, food.servingMode, input.amount),
    eatenAt: input.eatenAt,
    isPackaged: food.isPackaged,
    labels: food.labels,
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

export function localSaveMedication(input: Medication) {
  const state = readState();
  state.medications = [
    input,
    ...state.medications.filter((medication) => medication.id !== input.id),
  ];
  writeState(state);
  return input;
}

export function localArchiveMedication(id: string, archivedAt: number) {
  const state = readState();
  const medication = state.medications.find((item) => item.id === id);
  if (!medication) throw new Error('Medication not found.');
  medication.archivedAt = archivedAt;
  writeState(state);
  return medication;
}

export function localAddMedicationCheckIn(input: MedicationCheckIn) {
  const state = readState();
  state.medicationCheckIns = upsertMedicationCheckIn(state.medicationCheckIns, input);
  writeState(state);
  return input;
}

export function localDeleteMedicationCheckIn(id: string) {
  const state = readState();
  state.medicationCheckIns = state.medicationCheckIns.filter((checkIn) => checkIn.id !== id);
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

export function localDeleteWeight(id: string) {
  const state = readState();
  state.weights = state.weights.filter((entry) => entry.id !== id);
  writeState(state);
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
  const nutrients = sumNutrients(entries);
  return {
    profile: state.profile,
    foods: foodsByLifecycle(state.foods, 'active').sort(
      (a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0) || a.name.localeCompare(b.name)
    ),
    entries,
    waterEntries,
    medications: activeMedications(state.medications),
    medicationCheckIns: state.medicationCheckIns
      .filter((checkIn) => checkIn.takenOn === dateKey(Date.now()))
      .sort((a, b) => b.takenAt - a.takenAt),
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
      manualCalorieRange: state.profile.manualCalorieRange,
    }),
    completedFasts: calculateCompletedFasts(
      state.entries.filter((entry) => entry.eatenAt >= range.start - 31 * 24 * 60 * 60 * 1000),
      Intl.DateTimeFormat().resolvedOptions().timeZone
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
  const entries = entriesWithinRange(state.entries, startAt, endAt);
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
  const fastingThreshold = state.profile.fastingThresholdHours;
  const medicationNames = new Map(
    state.medications.map((medication) => [medication.id, medication.name])
  );
  for (const fast of calculateCompletedFasts(
    prior ? [prior, ...entries] : entries,
    Intl.DateTimeFormat().resolvedOptions().timeZone
  )) {
    if (fast.durationHours < fastingThreshold) continue;
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
    entries,
    medicationEvents: state.medicationCheckIns
      .filter((checkIn) => checkIn.takenAt >= startAt && checkIn.takenAt < endAt)
      .map((checkIn) => ({
        id: checkIn.id,
        medicationId: checkIn.medicationId,
        medicationName: medicationNames.get(checkIn.medicationId) ?? 'Medicine',
        takenAt: checkIn.takenAt,
      }))
      .sort((left, right) => left.takenAt - right.takenAt),
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

function cycleDateKeys(startOn: string, endOn: string) {
  const start = dateFromKey(startOn);
  start.setHours(0, 0, 0, 0);
  const end = dateFromKey(endOn);
  end.setHours(0, 0, 0, 0);
  const keys: string[] = [];
  for (
    const cursor = new Date(start);
    cursor < end && keys.length < 366;
    cursor.setDate(cursor.getDate() + 1)
  ) {
    keys.push(localDateKey(cursor));
  }
  return { keys, start: start.getTime(), end: end.getTime() };
}

function nextDateKey(key: string) {
  const date = dateFromKey(key);
  date.setDate(date.getDate() + 1);
  return localDateKey(date);
}

function ensureLocalCycle(state: LocalState, today: string) {
  if (state.cycleSessions.some((session) => session.endOn === null)) return;
  const latestWeight = [...state.weights].sort((a, b) => b.recordedAt - a.recordedAt)[0];
  state.cycleSessions = transitionCycleSessions({
    sessions: state.cycleSessions,
    nextProfile: state.profile,
    target: calculateNutritionTarget({
      weightKg: latestWeight?.weightKg ?? null,
      heightCm: state.profile.heightCm,
      ageYears: state.profile.ageYears,
      equationProfile: state.profile.equationProfile,
      activityLevel: state.profile.activityLevel,
      goal: state.profile.goal,
      manualCalorieTarget: state.profile.manualCalorieTarget,
      manualCalorieRange: state.profile.manualCalorieRange,
    }),
    today,
    now: Date.now(),
    id: crypto.randomUUID(),
    userId: state.profile.userId,
  });
}

function localCyclePeriod(session: GoalCycleSession, today: string) {
  const exclusiveEnd = session.endOn ?? nextDateKey(today);
  const bounds = cycleDateKeys(session.startOn, exclusiveEnd);
  const history = buildLocalHistory(bounds.keys, bounds.start, bounds.end);
  return { session, days: history.days, weights: history.weights };
}

export function localCycleHistory(): CycleHistoryResponse {
  const state = readState();
  const today = localDateKey(new Date());
  ensureLocalCycle(state, today);
  writeState(state);
  const active = state.cycleSessions.find((session) => session.endOn === null);
  if (!active) throw new Error('Active cycle not found.');
  const previous = [...state.cycleSessions]
    .filter((session) => session.endOn !== null)
    .sort((a, b) => (b.endOn ?? '').localeCompare(a.endOn ?? ''))[0];
  return {
    active: localCyclePeriod(active, today),
    previous: previous ? localCyclePeriod(previous, today) : null,
    today,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

export function localUpdateCycleStart(startOn: string) {
  const state = readState();
  const today = localDateKey(new Date());
  ensureLocalCycle(state, today);
  state.cycleSessions = updateActiveCycleStart(state.cycleSessions, startOn, today, Date.now());
  writeState(state);
  const active = state.cycleSessions.find((session) => session.endOn === null);
  if (!active) throw new Error('Active cycle not found.');
  return active;
}

export function localJournalExport() {
  const state = readState();
  ensureLocalCycle(state, localDateKey(new Date()));
  writeState(state);
  return createJournalExport({
    profile: state.profile,
    foods: state.foods,
    entries: state.entries,
    waterEntries: state.waterEntries,
    medications: state.medications,
    medicationCheckIns: state.medicationCheckIns,
    weights: state.weights,
    cycleSessions: state.cycleSessions,
  });
}

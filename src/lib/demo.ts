import { calendarHistoryBounds, dateFromKey, localDateKey } from './calendar';
import { transitionCycleSessions, updateActiveCycleStart } from './cycle-sessions';
import { normalizeDirectEntry } from './entries';
import {
  detachFoodDefinition,
  type FoodLifecycle,
  foodsByLifecycle,
  normalizeFood,
} from './food-library';
import { entriesWithinRange } from './history';
import { createJournalExport } from './journal-export';
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

const now = Date.now();
const atToday = (hours: number, minutes = 0) => {
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.getTime();
};

let profile: UserProfile = {
  userId: 'demo-user',
  displayName: 'Sam',
  units: 'metric',
  ageYears: 28,
  genderIdentity: null,
  equationProfile: 'male',
  heightCm: 175,
  activityLevel: 'moderate',
  goal: 'lose_gentle',
  targetWeightKg: 68,
  manualCalorieTarget: null,
  manualCalorieRange: null,
  wakeTime: '07:00',
  sleepHours: 8,
  fastingThresholdHours: 12,
  waterTargetMl: 2200,
  dailyActionOrder: ['weight', 'creatine', 'food', 'water'],
  dailyActionHidden: [],
  onboardingComplete: sessionStorage.getItem('calorie-demo-onboarding') !== 'true',
};

let foods: Food[] = [
  {
    id: 'oats',
    name: 'Oats & berries',
    servingMode: 'per_unit',
    unitLabel: 'bowl',
    defaultAmount: 1,
    calories: 362,
    carbsG: 52,
    proteinG: 13,
    fibreG: 6,
    favourite: true,
    lastUsedAt: atToday(7, 30),
    archivedAt: null,
    isPackaged: false,
  },
  {
    id: 'dal',
    name: 'Dal + rice',
    servingMode: 'per_unit',
    unitLabel: 'plate',
    defaultAmount: 1,
    calories: 510,
    carbsG: 74,
    proteinG: 21,
    fibreG: 7,
    favourite: true,
    lastUsedAt: atToday(12, 45),
    archivedAt: null,
    isPackaged: false,
  },
  {
    id: 'banana',
    name: 'Banana',
    servingMode: 'per_unit',
    unitLabel: 'banana',
    defaultAmount: 1,
    calories: 105,
    carbsG: 27,
    proteinG: 1.3,
    fibreG: 3.1,
    favourite: true,
    lastUsedAt: now - 24 * 60 * 60 * 1000,
    archivedAt: null,
    isPackaged: false,
  },
  {
    id: 'paneer',
    name: 'Paneer',
    servingMode: 'per_100g',
    unitLabel: 'g',
    defaultAmount: 100,
    calories: 265,
    carbsG: 3,
    proteinG: 18,
    fibreG: 0,
    favourite: false,
    lastUsedAt: now - 2 * 24 * 60 * 60 * 1000,
    archivedAt: null,
    isPackaged: false,
  },
];

let entries: FoodEntry[] = [
  {
    id: 'entry-oats',
    foodId: 'oats',
    foodName: 'Oats & berries',
    amount: 1,
    unitLabel: 'bowl',
    calories: 362,
    carbsG: 52,
    proteinG: 13,
    fibreG: 6,
    eatenAt: atToday(7, 30),
    isPackaged: false,
  },
  {
    id: 'entry-dal',
    foodId: 'dal',
    foodName: 'Dal + rice',
    amount: 1,
    unitLabel: 'plate',
    calories: 510,
    carbsG: 74,
    proteinG: 21,
    fibreG: 7,
    eatenAt: atToday(12, 45),
    isPackaged: false,
  },
];

let waterEntries: WaterEntry[] = [
  { id: 'water-1', amountMl: 350, drankAt: atToday(8, 15) },
  { id: 'water-2', amountMl: 500, drankAt: atToday(13, 10) },
];

let medications: Medication[] = [
  {
    id: 'demo-medication',
    name: 'Vitamin D',
    schedule: 'morning',
    createdAt: now,
    archivedAt: null,
  },
];

let medicationCheckIns: MedicationCheckIn[] = [];

let weights: WeightEntry[] = Array.from({ length: 7 }, (_, index) => ({
  id: `weight-${index}`,
  weightKg: round(72.4 - index * 0.13, 1),
  recordedAt: now - (6 - index) * 7 * 24 * 60 * 60 * 1000,
}));

let cycleSessions: GoalCycleSession[] = [];

function demoTarget(next = profile) {
  const latestWeight = weights.at(-1);
  return calculateNutritionTarget({
    weightKg: latestWeight?.weightKg ?? null,
    heightCm: next.heightCm,
    ageYears: next.ageYears,
    equationProfile: next.equationProfile,
    activityLevel: next.activityLevel,
    goal: next.goal,
    manualCalorieTarget: next.manualCalorieTarget,
    manualCalorieRange: next.manualCalorieRange,
  });
}

function ensureDemoCycle() {
  if (cycleSessions.some((session) => session.endOn === null)) return;
  const start = new Date();
  start.setDate(start.getDate() - 34);
  cycleSessions = transitionCycleSessions({
    sessions: cycleSessions,
    nextProfile: profile,
    target: demoTarget(),
    today: localDateKey(start),
    now: Date.now(),
    id: crypto.randomUUID(),
    userId: profile.userId,
  });
}

function totals() {
  return entries.reduce(
    (sum, entry) => ({
      calories: round(sum.calories + entry.calories),
      carbsG: round(sum.carbsG + entry.carbsG, 1),
      proteinG: round(sum.proteinG + entry.proteinG, 1),
      fibreG: round(sum.fibreG + entry.fibreG, 1),
      waterMl: sum.waterMl,
    }),
    {
      calories: 0,
      carbsG: 0,
      proteinG: 0,
      fibreG: 0,
      waterMl: waterEntries.reduce((sum, entry) => sum + entry.amountMl, 0),
    }
  );
}

export function demoDashboard(): Dashboard {
  const latestWeight = weights.at(-1) ?? null;
  return {
    profile: { ...profile },
    foods: foodsByLifecycle(foods, 'active'),
    entries: [...entries].sort((a, b) => b.eatenAt - a.eatenAt),
    waterEntries: [...waterEntries].sort((a, b) => b.drankAt - a.drankAt),
    medications: activeMedications(medications),
    medicationCheckIns: medicationCheckIns.filter(
      (checkIn) => checkIn.takenOn === new Intl.DateTimeFormat('en-CA').format(new Date())
    ),
    latestWeight,
    totals: totals(),
    target: calculateNutritionTarget({
      weightKg: latestWeight?.weightKg ?? null,
      heightCm: profile.heightCm,
      ageYears: profile.ageYears,
      equationProfile: profile.equationProfile,
      activityLevel: profile.activityLevel,
      goal: profile.goal,
      manualCalorieTarget: profile.manualCalorieTarget,
      manualCalorieRange: profile.manualCalorieRange,
    }),
    completedFasts: calculateCompletedFasts(
      [{ eatenAt: now - 20 * 60 * 60 * 1000 }, { eatenAt: atToday(7, 30) }, ...entries.slice(1)],
      Intl.DateTimeFormat().resolvedOptions().timeZone
    ),
    date: new Intl.DateTimeFormat('en-CA').format(new Date()),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

export function demoSaveProfile(next: UserProfile & { initialWeightKg?: number }) {
  ensureDemoCycle();
  cycleSessions = transitionCycleSessions({
    sessions: cycleSessions,
    nextProfile: next,
    target: demoTarget(next),
    today: localDateKey(new Date()),
    now: Date.now(),
    id: crypto.randomUUID(),
    userId: 'demo-user',
  });
  profile = { ...next, userId: 'demo-user', onboardingComplete: true };
  if (next.initialWeightKg) {
    weights.push({
      id: crypto.randomUUID(),
      weightKg: next.initialWeightKg,
      recordedAt: Date.now(),
    });
  }
  return { ...profile };
}

export function demoSaveFood(food: Food) {
  const normalized = normalizeFood(food);
  const index = foods.findIndex((item) => item.id === normalized.id);
  if (index >= 0) foods[index] = normalized;
  else foods = [normalized, ...foods];
  return normalized;
}

export function demoListFoods(lifecycle: FoodLifecycle) {
  return foodsByLifecycle(foods, lifecycle).sort(
    (a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0) || a.name.localeCompare(b.name)
  );
}

export function demoSetFoodArchived(id: string, archivedAt: number | null) {
  const food = foods.find((item) => item.id === id);
  if (!food) throw new Error('Food not found.');
  food.archivedAt = archivedAt;
  return food;
}

export function demoDeleteFood(id: string) {
  foods = foods.filter((food) => food.id !== id);
  entries = detachFoodDefinition(entries, id);
}

export function demoAddEntry(input: FoodEntryWrite) {
  if (!input.foodId) {
    const { optimistic: _optimistic, ...snapshot } = input;
    const entry = normalizeDirectEntry(snapshot);
    entries = [entry, ...entries.filter((item) => item.id !== entry.id)];
    return entry;
  }
  const food = foods.find((item) => item.id === input.foodId && item.archivedAt === null);
  if (!food) throw new Error('Food not found.');
  const nutrients = scaleNutrients(food, food.servingMode, input.amount);
  const entry: FoodEntry = {
    id: input.id,
    foodId: food.id,
    foodName: food.name,
    amount: input.amount,
    unitLabel: food.servingMode === 'per_100g' ? 'g' : food.unitLabel,
    ...nutrients,
    eatenAt: input.eatenAt,
    isPackaged: food.isPackaged,
    labels: food.labels,
  };
  entries = [entry, ...entries.filter((item) => item.id !== entry.id)];
  food.lastUsedAt = input.eatenAt;
  return entry;
}

export function demoDeleteEntry(id: string) {
  entries = entries.filter((entry) => entry.id !== id);
}

export function demoAddWater(input: WaterEntry) {
  waterEntries = [input, ...waterEntries.filter((entry) => entry.id !== input.id)];
  return input;
}

export function demoDeleteWater(id: string) {
  waterEntries = waterEntries.filter((entry) => entry.id !== id);
}

export function demoSaveMedication(input: Medication) {
  medications = [input, ...medications.filter((medication) => medication.id !== input.id)];
  return input;
}

export function demoArchiveMedication(id: string, archivedAt: number) {
  const medication = medications.find((item) => item.id === id);
  if (!medication) throw new Error('Medication not found.');
  medication.archivedAt = archivedAt;
  return medication;
}

export function demoAddMedicationCheckIn(input: MedicationCheckIn) {
  medicationCheckIns = upsertMedicationCheckIn(medicationCheckIns, input);
  return input;
}

export function demoDeleteMedicationCheckIn(id: string) {
  medicationCheckIns = medicationCheckIns.filter((checkIn) => checkIn.id !== id);
}

export function demoAddWeight(input: WeightEntry) {
  weights = [...weights.filter((entry) => entry.id !== input.id), input].sort(
    (a, b) => a.recordedAt - b.recordedAt
  );
  return input;
}

export const demoUpdateWater = demoAddWater;
export const demoUpdateWeight = demoAddWeight;

export function demoDeleteWeight(id: string) {
  weights = weights.filter((entry) => entry.id !== id);
}

function demoTimingEntry(input: {
  date: string;
  id: string;
  foodId: string;
  foodName: string;
  hours: number;
  minutes: number;
  calories: number;
  carbsG: number;
  proteinG: number;
  fibreG: number;
}) {
  const eatenAt = dateFromKey(input.date);
  eatenAt.setHours(input.hours, input.minutes, 0, 0);
  return {
    id: `${input.date}-${input.id}`,
    foodId: input.foodId,
    foodName: input.foodName,
    amount: 1,
    unitLabel: 'serving',
    calories: round(input.calories),
    carbsG: round(input.carbsG, 1),
    proteinG: round(input.proteinG, 1),
    fibreG: round(input.fibreG, 1),
    eatenAt: eatenAt.getTime(),
  } satisfies FoodEntry;
}

function demoEntriesForDays(days: HistoryDay[]) {
  const todayKey = localDateKey(new Date());
  return days.flatMap((day) => {
    if (day.date === todayKey) return [...entries];
    if (day.calories <= 0) return [];
    const dayNumber = Math.floor(dateFromKey(day.date).getTime() / (24 * 60 * 60 * 1000));
    const breakfastMinutes = 25 + (dayNumber % 4) * 8;
    const lunchMinutes = 35 + (dayNumber % 3) * 10;
    const dinnerMinutes = 15 + (dayNumber % 5) * 20;
    return [
      demoTimingEntry({
        date: day.date,
        id: 'oats',
        foodId: 'oats',
        foodName: 'Oats & berries',
        hours: 7,
        minutes: breakfastMinutes,
        calories: day.calories * 0.25,
        carbsG: day.carbsG * 0.3,
        proteinG: day.proteinG * 0.2,
        fibreG: day.fibreG * 0.3,
      }),
      demoTimingEntry({
        date: day.date,
        id: 'dal',
        foodId: 'dal',
        foodName: 'Dal + rice',
        hours: 12,
        minutes: lunchMinutes,
        calories: day.calories * 0.4,
        carbsG: day.carbsG * 0.45,
        proteinG: day.proteinG * 0.35,
        fibreG: day.fibreG * 0.4,
      }),
      demoTimingEntry({
        date: day.date,
        id: 'paneer',
        foodId: 'paneer',
        foodName: 'Paneer & vegetables',
        hours: 20 + Math.floor(dinnerMinutes / 60),
        minutes: dinnerMinutes % 60,
        calories: day.calories * 0.35,
        carbsG: day.carbsG * 0.25,
        proteinG: day.proteinG * 0.45,
        fibreG: day.fibreG * 0.3,
      }),
    ];
  });
}

function applyDemoFastCount(
  days: HistoryDay[],
  entries: FoodEntry[],
  threshold: number
): HistoryDay[] {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const byDate = new Map(days.map((day) => [day.date, { ...day, fastCount: 0 }]));
  for (const fast of calculateCompletedFasts(entries, tz)) {
    if (fast.durationHours < threshold) continue;
    const key = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(fast.endAt);
    const day = byDate.get(key);
    if (day) day.fastCount += 1;
  }
  return [...byDate.values()];
}

export function demoHistory(rangeDays: 7 | 30): HistoryResponse {
  const target = demoDashboard().target.calorieTarget ?? 2000;
  const days = Array.from({ length: rangeDays }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (rangeDays - index - 1));
    const isToday = index === rangeDays - 1;
    const wave = Math.sin(index * 1.4);
    return {
      date: new Intl.DateTimeFormat('en-CA').format(date),
      calories: isToday ? totals().calories : round(target + wave * 180 - 60),
      carbsG: isToday ? totals().carbsG : round(205 + wave * 22),
      proteinG: isToday ? totals().proteinG : round(102 + wave * 11),
      fibreG: isToday ? totals().fibreG : round(27 + wave * 4),
      waterMl: isToday ? totals().waterMl : round(1900 + wave * 280),
      fastCount: 0,
    } satisfies HistoryDay;
  });
  const entries = demoEntriesForDays(days);
  const threshold = profile.fastingThresholdHours;
  return {
    days: applyDemoFastCount(days, entries, threshold),
    weights: [...weights],
    entries,
    rangeDays,
  };
}

export function demoCalendarHistory(dateKeys: string[]): HistoryResponse {
  const target = demoDashboard().target.calorieTarget ?? 2000;
  const todayKey = localDateKey(new Date());
  const days = dateKeys.map((dateKey) => {
    const date = dateFromKey(dateKey);
    const dayNumber = Math.floor(date.getTime() / (24 * 60 * 60 * 1000));
    const isToday = dateKey === todayKey;
    const isFuture = dateKey > todayKey;
    const isEmpty = dayNumber % 5 === 0;
    const wave = Math.sin(dayNumber * 1.4);
    if (isFuture || isEmpty) {
      return {
        date: dateKey,
        calories: 0,
        carbsG: 0,
        proteinG: 0,
        fibreG: 0,
        waterMl: 0,
        fastCount: 0,
      } satisfies HistoryDay;
    }
    return {
      date: dateKey,
      calories: isToday ? totals().calories : round(target + wave * 180 - 60),
      carbsG: isToday ? totals().carbsG : round(205 + wave * 22),
      proteinG: isToday ? totals().proteinG : round(102 + wave * 11),
      fibreG: isToday ? totals().fibreG : round(27 + wave * 4),
      waterMl: isToday ? totals().waterMl : round(1900 + wave * 280),
      fastCount: 0,
    } satisfies HistoryDay;
  });
  const cells = dateKeys.map((date) => ({ date, day: 0, inMonth: true }));
  const bounds = calendarHistoryBounds(cells);
  const entries = entriesWithinRange(demoEntriesForDays(days), bounds.start, bounds.end);
  const threshold = profile.fastingThresholdHours;
  return {
    days: applyDemoFastCount(days, entries, threshold),
    weights: weights.filter(
      (entry) => entry.recordedAt >= bounds.start && entry.recordedAt < bounds.end
    ),
    entries,
  };
}

function nextDateKey(key: string) {
  const date = dateFromKey(key);
  date.setDate(date.getDate() + 1);
  return localDateKey(date);
}

function cycleKeys(startOn: string, exclusiveEnd: string) {
  const keys: string[] = [];
  for (
    const cursor = dateFromKey(startOn);
    localDateKey(cursor) < exclusiveEnd && keys.length < 366;
    cursor.setDate(cursor.getDate() + 1)
  ) {
    keys.push(localDateKey(cursor));
  }
  return keys;
}

function demoCyclePeriod(session: GoalCycleSession, today: string) {
  const history = demoCalendarHistory(
    cycleKeys(session.startOn, session.endOn ?? nextDateKey(today))
  );
  return { session, days: history.days, weights: history.weights };
}

export function demoCycleHistory(): CycleHistoryResponse {
  ensureDemoCycle();
  const today = localDateKey(new Date());
  const active = cycleSessions.find((session) => session.endOn === null);
  if (!active) throw new Error('Active demo cycle not found.');
  const previous = [...cycleSessions]
    .filter((session) => session.endOn !== null)
    .sort((a, b) => (b.endOn ?? '').localeCompare(a.endOn ?? ''))[0];
  return {
    active: demoCyclePeriod(active, today),
    previous: previous ? demoCyclePeriod(previous, today) : null,
    today,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

export function demoUpdateCycleStart(startOn: string) {
  ensureDemoCycle();
  cycleSessions = updateActiveCycleStart(
    cycleSessions,
    startOn,
    localDateKey(new Date()),
    Date.now()
  );
  const active = cycleSessions.find((session) => session.endOn === null);
  if (!active) throw new Error('Active demo cycle not found.');
  return active;
}

export function demoJournalExport() {
  ensureDemoCycle();
  return createJournalExport({
    profile,
    foods,
    entries,
    waterEntries,
    medications,
    medicationCheckIns,
    weights,
    cycleSessions,
  });
}

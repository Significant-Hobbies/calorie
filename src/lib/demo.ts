import { calendarHistoryBounds, dateFromKey, localDateKey } from './calendar';
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
  HistoryResponse,
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
  wakeTime: '07:00',
  sleepHours: 8,
  fastingThresholdHours: 12,
  waterTargetMl: 2200,
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
  },
];

let waterEntries: WaterEntry[] = [
  { id: 'water-1', amountMl: 350, drankAt: atToday(8, 15) },
  { id: 'water-2', amountMl: 500, drankAt: atToday(13, 10) },
];

let weights: WeightEntry[] = Array.from({ length: 7 }, (_, index) => ({
  id: `weight-${index}`,
  weightKg: round(72.4 - index * 0.13, 1),
  recordedAt: now - (6 - index) * 7 * 24 * 60 * 60 * 1000,
}));

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
    foods: [...foods],
    entries: [...entries].sort((a, b) => b.eatenAt - a.eatenAt),
    waterEntries: [...waterEntries].sort((a, b) => b.drankAt - a.drankAt),
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
    }),
    completedFasts: calculateCompletedFasts(
      [{ eatenAt: now - 20 * 60 * 60 * 1000 }, { eatenAt: atToday(7, 30) }, ...entries.slice(1)],
      profile.fastingThresholdHours
    ),
    date: new Intl.DateTimeFormat('en-CA').format(new Date()),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

export function demoSaveProfile(next: UserProfile & { initialWeightKg?: number }) {
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
  const index = foods.findIndex((item) => item.id === food.id);
  if (index >= 0) foods[index] = food;
  else foods = [food, ...foods];
  return food;
}

export function demoDeleteFood(id: string) {
  foods = foods.filter((food) => food.id !== id);
  entries = entries.map((entry) => (entry.foodId === id ? { ...entry, foodId: null } : entry));
}

export function demoAddEntry(input: FoodEntryWrite) {
  if (!input.foodId) {
    const { optimistic: _optimistic, ...snapshot } = input;
    const entry = normalizeDirectEntry(snapshot);
    entries = [entry, ...entries.filter((item) => item.id !== entry.id)];
    return entry;
  }
  const food = foods.find((item) => item.id === input.foodId);
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
  };
  entries = [entry, ...entries.filter((item) => item.id !== entry.id)];
  food.lastUsedAt = input.eatenAt;
  return entry;
}

export function demoDeleteEntry(id: string) {
  entries = entries.filter((entry) => entry.id !== id);
}

export function demoAddWater(input: WaterEntry) {
  waterEntries = [input, ...waterEntries];
  return input;
}

export function demoDeleteWater(id: string) {
  waterEntries = waterEntries.filter((entry) => entry.id !== id);
}

export function demoAddWeight(input: WeightEntry) {
  weights = [...weights, input].sort((a, b) => a.recordedAt - b.recordedAt);
  return input;
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
      fastCount: index % 3 === 0 ? 1 : 0,
    };
  });
  return { days, weights: [...weights], rangeDays };
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
      };
    }
    return {
      date: dateKey,
      calories: isToday ? totals().calories : round(target + wave * 180 - 60),
      carbsG: isToday ? totals().carbsG : round(205 + wave * 22),
      proteinG: isToday ? totals().proteinG : round(102 + wave * 11),
      fibreG: isToday ? totals().fibreG : round(27 + wave * 4),
      waterMl: isToday ? totals().waterMl : round(1900 + wave * 280),
      fastCount: dayNumber % 3 === 0 ? 1 : 0,
    };
  });
  const cells = dateKeys.map((date) => ({ date, day: 0, inMonth: true }));
  const bounds = calendarHistoryBounds(cells);
  return {
    days,
    weights: weights.filter(
      (entry) => entry.recordedAt >= bounds.start && entry.recordedAt < bounds.end
    ),
  };
}

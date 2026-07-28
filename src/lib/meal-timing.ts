import type { FoodEntry, MealTimingAnalysis, MealTimingBand, MealTimingBandKey } from './types';

type DailyTiming = {
  firstAt: number;
  firstMinutes: number;
  lastAt: number;
  lastMinutes: number;
  entries: number;
};

const MINUTES_PER_DAY = 24 * 60;
const BAND_KEYS: MealTimingBandKey[] = ['before_noon', 'midday', 'after_five'];

function clockParts(timestamp: number, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(timestamp);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? '';
  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    minutes: Number(part('hour')) * 60 + Number(part('minute')),
  };
}

function circularMean(values: number[]) {
  if (values.length === 0) return null;
  const vectors = values.reduce(
    (sum, value) => {
      const angle = (value / MINUTES_PER_DAY) * Math.PI * 2;
      return {
        sine: sum.sine + Math.sin(angle),
        cosine: sum.cosine + Math.cos(angle),
      };
    },
    { sine: 0, cosine: 0 }
  );
  if (Math.abs(vectors.sine) < 0.000001 && Math.abs(vectors.cosine) < 0.000001) {
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }
  const angle = Math.atan2(vectors.sine, vectors.cosine);
  return Math.round(
    (((angle < 0 ? angle + Math.PI * 2 : angle) / (Math.PI * 2)) * MINUTES_PER_DAY) %
      MINUTES_PER_DAY
  );
}

function clockDistance(left: number, right: number) {
  const difference = Math.abs(left - right);
  return Math.min(difference, MINUTES_PER_DAY - difference);
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return (hours * 60 + minutes) % MINUTES_PER_DAY;
}

function bandFor(minutes: number): MealTimingBandKey {
  if (minutes < 12 * 60) return 'before_noon';
  if (minutes < 17 * 60) return 'midday';
  return 'after_five';
}

export function analyzeMealTiming(input: {
  entries: FoodEntry[];
  timezone: string;
  wakeTime: string;
  sleepHours: number;
}): MealTimingAnalysis {
  const daily = new Map<string, DailyTiming>();
  const foods = new Map<
    string,
    { name: string; entryCount: number; lastAt: number; clockMinutes: number[] }
  >();
  const bandTotals = new Map<MealTimingBandKey, { calories: number; proteinG: number }>(
    BAND_KEYS.map((key) => [key, { calories: 0, proteinG: 0 }])
  );
  const entries = [...input.entries]
    .filter((entry) => Number.isFinite(entry.eatenAt))
    .sort((left, right) => left.eatenAt - right.eatenAt);

  for (const entry of entries) {
    const { date, minutes } = clockParts(entry.eatenAt, input.timezone);
    const day = daily.get(date);
    if (day) {
      day.entries += 1;
      if (entry.eatenAt < day.firstAt) {
        day.firstAt = entry.eatenAt;
        day.firstMinutes = minutes;
      }
      if (entry.eatenAt > day.lastAt) {
        day.lastAt = entry.eatenAt;
        day.lastMinutes = minutes;
      }
    } else {
      daily.set(date, {
        firstAt: entry.eatenAt,
        firstMinutes: minutes,
        lastAt: entry.eatenAt,
        lastMinutes: minutes,
        entries: 1,
      });
    }

    const key = entry.foodId
      ? `food:${entry.foodId}`
      : `name:${entry.foodName.trim().toLocaleLowerCase()}`;
    const food = foods.get(key);
    foods.set(key, {
      name: food && food.lastAt > entry.eatenAt ? food.name : entry.foodName,
      entryCount: (food?.entryCount ?? 0) + 1,
      lastAt: Math.max(food?.lastAt ?? 0, entry.eatenAt),
      clockMinutes: [...(food?.clockMinutes ?? []), minutes],
    });

    const band = bandTotals.get(bandFor(minutes));
    if (band) {
      band.calories += entry.calories;
      band.proteinG += entry.proteinG;
    }
  }

  const days = [...daily.values()];
  const windowDays = days.filter((day) => day.entries >= 2);
  const totalCalories = entries.reduce((sum, entry) => sum + entry.calories, 0);
  const totalProtein = entries.reduce((sum, entry) => sum + entry.proteinG, 0);
  const bands: MealTimingBand[] = BAND_KEYS.map((key) => {
    const totals = bandTotals.get(key) ?? { calories: 0, proteinG: 0 };
    return {
      key,
      calories: totals.calories,
      proteinG: totals.proteinG,
      calorieShare: totalCalories > 0 ? totals.calories / totalCalories : 0,
      proteinShare: totalProtein > 0 ? totals.proteinG / totalProtein : 0,
    };
  });
  const sleepRoutineMinutes =
    (timeToMinutes(input.wakeTime) - Math.round(input.sleepHours * 60) + MINUTES_PER_DAY) %
    MINUTES_PER_DAY;
  const mostLoggedFood =
    [...foods.values()].sort(
      (left, right) =>
        right.entryCount - left.entryCount ||
        right.lastAt - left.lastAt ||
        left.name.localeCompare(right.name)
    )[0] ?? null;
  const leadingProteinBand =
    totalProtein > 0
      ? ([...bands].sort(
          (left, right) =>
            right.proteinG - left.proteinG ||
            BAND_KEYS.indexOf(left.key) - BAND_KEYS.indexOf(right.key)
        )[0]?.key ?? null)
      : null;

  return {
    loggedDays: days.length,
    entryCount: entries.length,
    typicalFirstMinutes: circularMean(days.map((day) => day.firstMinutes)),
    typicalLastMinutes: circularMean(days.map((day) => day.lastMinutes)),
    averageEatingWindowMinutes: windowDays.length
      ? Math.round(
          windowDays.reduce((sum, day) => sum + (day.lastAt - day.firstAt) / 60_000, 0) /
            windowDays.length
        )
      : null,
    eatingWindowDays: windowDays.length,
    sleepRoutineMinutes,
    nearSleepDays: days.filter((day) => clockDistance(day.lastMinutes, sleepRoutineMinutes) <= 120)
      .length,
    bands,
    leadingProteinBand,
    mostLoggedFood: mostLoggedFood
      ? {
          name: mostLoggedFood.name,
          entryCount: mostLoggedFood.entryCount,
          typicalMinutes: circularMean(mostLoggedFood.clockMinutes) ?? 0,
        }
      : null,
  };
}

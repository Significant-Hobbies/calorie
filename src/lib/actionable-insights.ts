import { localDateKey } from './calendar';
import { analyzeFoodAnalytics } from './food-analytics';
import type { FoodEntry, HistoryDay, NutritionTarget } from './types';

type InsightCoverageKey = 'calories' | 'protein' | 'fibre' | 'water';

export type ActionableInsights = {
  confidence: { loggedDays: number; windowDays: number; isSparse: boolean };
  coverage: Array<{
    key: InsightCoverageKey;
    label: string;
    averagePercent: number;
    targetDescription: string;
  }>;
  variety: { distinctFoods: number; repeatedFoods: number; totalOccasions: number };
  comparison: { averageCaloriesDelta: number; direction: 'higher' | 'lower' | 'steady' } | null;
  takeaway: string;
};

type Input = {
  days: HistoryDay[];
  entries: FoodEntry[];
  previousDays?: HistoryDay[];
  previousEntries?: FoodEntry[];
  target: NutritionTarget;
  waterTargetMl: number;
};

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

function loggedDayKeys(entries: FoodEntry[], days: HistoryDay[]) {
  const availableDays = new Set(days.map((day) => day.date));
  return new Set(
    entries
      .map((entry) => localDateKey(new Date(entry.eatenAt)))
      .filter((date) => availableDays.has(date))
  );
}

function averageCalories(days: HistoryDay[], loggedDates: Set<string>) {
  const loggedDays = days.filter((day) => loggedDates.has(day.date));
  if (!loggedDays.length) return null;
  return loggedDays.reduce((sum, day) => sum + day.calories, 0) / loggedDays.length;
}

export function analyzeActionableInsights(input: Input): ActionableInsights {
  const loggedDates = loggedDayKeys(input.entries, input.days);
  const loggedDays = input.days.filter((day) => loggedDates.has(day.date));
  const analytics = analyzeFoodAnalytics(input.entries);
  const coverageCandidates: Array<{
    key: InsightCoverageKey;
    label: string;
    target: number | null;
    value: (day: HistoryDay) => number;
    targetDescription: (target: number) => string;
  }> = [
    {
      key: 'calories',
      label: 'Calories',
      target: input.target.calorieTarget,
      value: (day) => day.calories,
      targetDescription: (target) => `${target.toLocaleString()} kcal daily limit`,
    },
    {
      key: 'protein',
      label: 'Protein',
      target: input.target.proteinRangeG?.[0] ?? null,
      value: (day) => day.proteinG,
      targetDescription: (target) => `${target.toLocaleString()} g daily floor`,
    },
    {
      key: 'fibre',
      label: 'Fibre',
      target: input.target.fibreTargetG,
      value: (day) => day.fibreG,
      targetDescription: (target) => `${target.toLocaleString()} g daily target`,
    },
    {
      key: 'water',
      label: 'Water',
      target: input.waterTargetMl || null,
      value: (day) => day.waterMl,
      targetDescription: (target) => `${target.toLocaleString()} ml daily target`,
    },
  ];
  const coverage = coverageCandidates.flatMap((item) => {
    const dailyTarget = item.target;
    if (!dailyTarget || !loggedDays.length) return [];
    const averagePercent = Math.round(
      loggedDays.reduce(
        (sum, day) => sum + clampPercent((item.value(day) / dailyTarget) * 100),
        0
      ) / loggedDays.length
    );
    return [
      {
        key: item.key,
        label: item.label,
        averagePercent,
        targetDescription: item.targetDescription(dailyTarget),
      },
    ];
  });
  const repeatedFoods = analytics.byOccasions.filter((item) => item.occasions > 1).length;
  const previousLoggedDates = loggedDayKeys(input.previousEntries ?? [], input.previousDays ?? []);
  const currentAverageCalories = averageCalories(input.days, loggedDates);
  const previousAverageCalories = averageCalories(input.previousDays ?? [], previousLoggedDates);
  const delta =
    currentAverageCalories === null || previousAverageCalories === null
      ? null
      : Math.round(currentAverageCalories - previousAverageCalories);
  const comparison: ActionableInsights['comparison'] =
    delta === null
      ? null
      : {
          averageCaloriesDelta: delta,
          direction: delta > 25 ? 'higher' : delta < -25 ? 'lower' : 'steady',
        };
  const confidence = {
    loggedDays: loggedDates.size,
    windowDays: input.days.length,
    isSparse: loggedDates.size < 2,
  };
  const leastCovered = [...coverage].sort(
    (left, right) => left.averagePercent - right.averagePercent
  )[0];
  const coverageAction: Record<InsightCoverageKey, string> = {
    calories: 'Treat that as context—calories are a limit, not a target to fill.',
    protein: 'Check your saved foods for a usual protein option if that would help today.',
    fibre: 'Check your saved foods for a usual fibre option if that would help today.',
    water: 'Log drinks as you go if water is missing from today’s journal.',
  };
  const takeaway = confidence.isSparse
    ? 'Log food on another day to make your patterns clearer.'
    : leastCovered
      ? `${leastCovered.label} had the lowest average target coverage across your logged days (${leastCovered.averagePercent}%). ${coverageAction[leastCovered.key]}`
      : analytics.byOccasions[0]
        ? `${analytics.byOccasions[0].foodName} was your most repeated food: ${analytics.byOccasions[0].occasions} logged occasion${analytics.byOccasions[0].occasions === 1 ? '' : 's'}.`
        : 'Keep logging normally to make your patterns clearer.';

  return {
    confidence,
    coverage,
    variety: {
      distinctFoods: analytics.distinctFoods,
      repeatedFoods,
      totalOccasions: analytics.totalOccasions,
    },
    comparison,
    takeaway,
  };
}

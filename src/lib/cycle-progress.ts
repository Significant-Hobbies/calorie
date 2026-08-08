import type { HistoryDay, Units, WeightEntry } from './types';

export type CycleProgressSummary = {
  loggedDays: number;
  windowDays: number;
  averageCalories: number;
  averageProtein: number;
  averageFibre: number;
  averageWater: number;
  fasts: number;
  weightChange: { value: number; unit: 'kg' | 'lb' } | null;
};

export function summarizeCycleProgress(
  days: HistoryDay[],
  weights: WeightEntry[],
  units: Units
): CycleProgressSummary {
  const logged = days.filter((day) => day.calories > 0);
  const average = (value: (day: HistoryDay) => number) =>
    logged.length
      ? Math.round(logged.reduce((sum, day) => sum + value(day), 0) / logged.length)
      : 0;
  const orderedWeights = [...weights].sort((a, b) => a.recordedAt - b.recordedAt);
  const first = orderedWeights.at(0);
  const last = orderedWeights.at(-1);
  const weightChange =
    first && last && first.id !== last.id
      ? {
          value:
            Math.round(
              (last.weightKg - first.weightKg) * (units === 'imperial' ? 2.20462 : 1) * 10
            ) / 10,
          unit: units === 'imperial' ? ('lb' as const) : ('kg' as const),
        }
      : null;

  return {
    loggedDays: logged.length,
    windowDays: days.length,
    averageCalories: average((day) => day.calories),
    averageProtein: average((day) => day.proteinG),
    averageFibre: average((day) => day.fibreG),
    averageWater: average((day) => day.waterMl),
    fasts: days.reduce((sum, day) => sum + day.fastCount, 0),
    weightChange,
  };
}

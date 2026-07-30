import { round } from './recommendations';
import type { FoodEntry } from './types';

export type FoodAnalyticsItem = {
  key: string;
  foodId: string | null;
  foodName: string;
  occasions: number;
  totalCalories: number;
  totalCarbsG: number;
  totalProteinG: number;
  totalFibreG: number;
  avgCalories: number;
  avgCarbsG: number;
  avgProteinG: number;
  avgFibreG: number;
  lastEatenAt: number;
};

export type FoodAnalytics = {
  totalOccasions: number;
  distinctFoods: number;
  byOccasions: FoodAnalyticsItem[];
  byCalories: FoodAnalyticsItem[];
};

export function analyzeFoodAnalytics(entries: FoodEntry[]): FoodAnalytics {
  const groups = new Map<string, FoodAnalyticsItem>();

  for (const entry of entries) {
    const key = entry.foodId ?? entry.foodName;
    const existing = groups.get(key);
    if (existing) {
      existing.occasions += 1;
      existing.totalCalories += entry.calories;
      existing.totalCarbsG += entry.carbsG;
      existing.totalProteinG += entry.proteinG;
      existing.totalFibreG += entry.fibreG;
      existing.lastEatenAt = Math.max(existing.lastEatenAt, entry.eatenAt);
    } else {
      groups.set(key, {
        key,
        foodId: entry.foodId,
        foodName: entry.foodName,
        occasions: 1,
        totalCalories: entry.calories,
        totalCarbsG: entry.carbsG,
        totalProteinG: entry.proteinG,
        totalFibreG: entry.fibreG,
        avgCalories: 0,
        avgCarbsG: 0,
        avgProteinG: 0,
        avgFibreG: 0,
        lastEatenAt: entry.eatenAt,
      });
    }
  }

  const items = [...groups.values()].map((item) => {
    const avg = (value: number) => round(value / item.occasions, 1);
    return {
      ...item,
      totalCalories: round(item.totalCalories),
      totalCarbsG: round(item.totalCarbsG, 1),
      totalProteinG: round(item.totalProteinG, 1),
      totalFibreG: round(item.totalFibreG, 1),
      avgCalories: Math.round(item.totalCalories / item.occasions),
      avgCarbsG: avg(item.totalCarbsG),
      avgProteinG: avg(item.totalProteinG),
      avgFibreG: avg(item.totalFibreG),
    };
  });

  const byOccasions = [...items].sort(
    (a, b) => b.occasions - a.occasions || b.totalCalories - a.totalCalories
  );
  const byCalories = [...items].sort(
    (a, b) => b.totalCalories - a.totalCalories || b.occasions - a.occasions
  );

  return {
    totalOccasions: entries.length,
    distinctFoods: items.length,
    byOccasions,
    byCalories,
  };
}

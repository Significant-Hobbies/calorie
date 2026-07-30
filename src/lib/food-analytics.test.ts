import { describe, expect, it } from 'vitest';
import { analyzeFoodAnalytics } from './food-analytics';
import type { FoodEntry } from './types';

function entry(input: {
  id: string;
  foodId?: string | null;
  foodName: string;
  calories?: number;
  carbsG?: number;
  proteinG?: number;
  fibreG?: number;
  eatenAt?: number;
}): FoodEntry {
  return {
    id: input.id,
    foodId: input.foodId ?? input.foodName,
    foodName: input.foodName,
    amount: 1,
    unitLabel: 'serving',
    calories: input.calories ?? 100,
    carbsG: input.carbsG ?? 10,
    proteinG: input.proteinG ?? 10,
    fibreG: input.fibreG ?? 2,
    eatenAt: input.eatenAt ?? 0,
  };
}

describe('analyzeFoodAnalytics', () => {
  it('groups by saved food id and direct-entry name', () => {
    const result = analyzeFoodAnalytics([
      entry({ id: '1', foodId: 'oats', foodName: 'Oats', calories: 300 }),
      entry({ id: '2', foodId: 'oats', foodName: 'Oats', calories: 300 }),
      entry({ id: '3', foodId: null, foodName: 'Lunch special', calories: 500 }),
    ]);
    expect(result.distinctFoods).toBe(2);
    expect(result.totalOccasions).toBe(3);
  });

  it('ranks by occasions then calories', () => {
    const result = analyzeFoodAnalytics([
      entry({ id: '1', foodId: 'oats', foodName: 'Oats', calories: 300 }),
      entry({ id: '2', foodId: 'oats', foodName: 'Oats', calories: 300 }),
      entry({ id: '3', foodId: 'dal', foodName: 'Dal', calories: 510 }),
    ]);
    expect(result.byOccasions[0].foodName).toBe('Oats');
    expect(result.byOccasions[0].occasions).toBe(2);
  });

  it('ranks by total calories contributed', () => {
    const result = analyzeFoodAnalytics([
      entry({ id: '1', foodId: 'oats', foodName: 'Oats', calories: 300 }),
      entry({ id: '2', foodId: 'dal', foodName: 'Dal', calories: 510 }),
      entry({ id: '3', foodId: 'dal', foodName: 'Dal', calories: 510 }),
    ]);
    expect(result.byCalories[0].foodName).toBe('Dal');
    expect(result.byCalories[0].totalCalories).toBe(1020);
  });

  it('averages per-occasion macros', () => {
    const result = analyzeFoodAnalytics([
      entry({ id: '1', foodId: 'oats', foodName: 'Oats', calories: 300, proteinG: 12 }),
      entry({ id: '2', foodId: 'oats', foodName: 'Oats', calories: 360, proteinG: 18 }),
    ]);
    const oats = result.byOccasions[0];
    expect(oats.occasions).toBe(2);
    expect(oats.avgCalories).toBe(330);
    expect(oats.avgProteinG).toBe(15);
  });

  it('returns empty analytics for no entries', () => {
    const result = analyzeFoodAnalytics([]);
    expect(result.totalOccasions).toBe(0);
    expect(result.distinctFoods).toBe(0);
    expect(result.byOccasions).toHaveLength(0);
  });

  it('tracks the most recent occasion per food', () => {
    const result = analyzeFoodAnalytics([
      entry({ id: '1', foodId: 'oats', foodName: 'Oats', eatenAt: 1000 }),
      entry({ id: '2', foodId: 'oats', foodName: 'Oats', eatenAt: 5000 }),
      entry({ id: '3', foodId: 'oats', foodName: 'Oats', eatenAt: 3000 }),
    ]);
    expect(result.byOccasions[0].lastEatenAt).toBe(5000);
  });
});

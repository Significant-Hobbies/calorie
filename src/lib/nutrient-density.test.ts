import { describe, expect, it } from 'vitest';
import type { Food, FoodEntry, NutritionTarget } from './types';
import {
  calculateDailyScore,
  calculateTrackedQuality,
  resolveEntryScoreBasis,
} from './nutrient-density';

const activeFood: Food = {
  id: 'food-1',
  name: 'Current bowl',
  servingMode: 'per_unit',
  unitLabel: 'bowl',
  defaultAmount: 1,
  calories: 400,
  carbsG: 40,
  proteinG: 32,
  fibreG: 12,
  favourite: false,
  lastUsedAt: null,
  archivedAt: null,
};

function entry(overrides: Partial<FoodEntry> = {}): FoodEntry {
  return {
    id: 'entry-1',
    foodId: null,
    foodName: 'Logged meal',
    amount: 1,
    unitLabel: 'serving',
    eatenAt: Date.UTC(2026, 7, 15),
    calories: 2_000,
    carbsG: 200,
    proteinG: 100,
    fibreG: 25,
    ...overrides,
  };
}

function target(overrides: Partial<NutritionTarget> = {}): NutritionTarget {
  return {
    calorieTarget: 2_000,
    calorieRange: [1_800, 2_200],
    maintenanceCalories: 2_400,
    goalAdjustmentRangeCalories: [-600, -200],
    restingEnergy: 1_600,
    proteinRangeG: [100, 130],
    fibreTargetG: 25,
    method: 'manual',
    ...overrides,
  };
}

describe('tracked food quality', () => {
  it('marks zero-calorie foods unavailable', () => {
    expect(calculateTrackedQuality({ calories: 0, proteinG: 20, fibreG: 5 }).score).toBeNull();
  });

  it.each([
    [{ calories: 100, proteinG: 8, fibreG: 0 }, 70],
    [{ calories: 100, proteinG: 0, fibreG: 3 }, 70],
    [{ calories: 100, proteinG: 8, fibreG: 3 }, 100],
    [{ calories: 100, proteinG: 4, fibreG: 1.5 }, 50],
    [{ calories: 100, proteinG: 8, fibreG: 1.5 }, 85],
    [{ calories: 100, proteinG: 16, fibreG: 6 }, 100],
  ] as const)('scores %o as %s', (nutrients, expected) => {
    expect(calculateTrackedQuality(nutrients).score).toBe(expected);
  });

  it('does not use carbs or packaging as inputs', () => {
    const base = { calories: 250, proteinG: 20, fibreG: 0 };
    const contextual = { ...base, carbsG: 180, isPackaged: true };

    expect(calculateTrackedQuality(contextual).score).toBe(calculateTrackedQuality(base).score);
    expect(calculateTrackedQuality(base).explanation).toContain('8 g protein');
  });

  it('rebases a linked entry onto the latest compatible active food without mutating it', () => {
    const logged = entry({
      foodId: activeFood.id,
      unitLabel: activeFood.unitLabel,
      calories: 600,
      proteinG: 6,
      fibreG: 0,
      amount: 2,
    });
    const originalSnapshot = { calories: logged.calories, proteinG: logged.proteinG };
    const basis = resolveEntryScoreBasis(logged, [activeFood]);

    expect(basis).toMatchObject({
      source: 'current-food',
      fallbackReason: null,
      nutrients: { calories: 800, proteinG: 64, fibreG: 24 },
    });
    expect(calculateTrackedQuality(basis.nutrients).score).toBe(100);
    expect({ calories: logged.calories, proteinG: logged.proteinG }).toEqual(originalSnapshot);
  });

  it.each([
    [
      'archived-food',
      { ...activeFood, archivedAt: 1 },
      { foodId: activeFood.id, unitLabel: 'bowl' },
    ],
    ['missing-food', null, { foodId: 'missing-food', unitLabel: 'bowl' }],
    ['incompatible-unit', activeFood, { foodId: activeFood.id, unitLabel: 'grams' }],
    ['one-off', activeFood, { foodId: null, unitLabel: 'serving' }],
  ] as const)('uses the logged snapshot for %s history', (reason, food, entryOverrides) => {
    const basis = resolveEntryScoreBasis(entry(entryOverrides), food ? [food] : []);

    expect(basis.source).toBe('logged-fallback');
    expect(basis.fallbackReason).toBe(reason);
    expect(basis.nutrients).toEqual({ calories: 2_000, proteinG: 100, fibreG: 25 });
  });

  it('scores a completed day at 100 inside the calorie range with protein and fibre met', () => {
    const result = calculateDailyScore({
      entries: [entry()],
      foods: [],
      target: target(),
      isCurrentDay: false,
    });

    expect(result).toMatchObject({
      score: 100,
      label: 'Final score',
      calorieFactor: 1,
      proteinFactor: 1,
      fibreFactor: 1,
      fallbackCount: 1,
    });
  });

  it('removes all calorie credit at fifty percent above the upper bound', () => {
    const result = calculateDailyScore({
      entries: [entry({ calories: 3_300 })],
      foods: [],
      target: target(),
      isCurrentDay: true,
    });

    expect(result.score).toBe(50);
    expect(result.calorieFactor).toBe(0);
    expect(result.label).toBe('Score so far');
  });

  it('lets protein progress improve the score only until its target is met', () => {
    const halfProtein = calculateDailyScore({
      entries: [entry({ proteinG: 50 })],
      foods: [],
      target: target(),
      isCurrentDay: false,
    });
    const completedProtein = calculateDailyScore({
      entries: [entry({ proteinG: 160 })],
      foods: [],
      target: target(),
      isCurrentDay: false,
    });

    expect(halfProtein.score).toBe(85);
    expect(completedProtein.score).toBe(100);
    expect(completedProtein.proteinFactor).toBe(1);
  });

  it('normalizes available weights and reports when targets are missing', () => {
    const caloriesOnly = calculateDailyScore({
      entries: [entry()],
      foods: [],
      target: target({ proteinRangeG: null, fibreTargetG: null }),
      isCurrentDay: false,
    });
    const unavailable = calculateDailyScore({
      entries: [entry()],
      foods: [],
      target: target({
        calorieTarget: null,
        calorieRange: null,
        proteinRangeG: null,
        fibreTargetG: null,
      }),
      isCurrentDay: false,
    });

    expect(caloriesOnly.score).toBe(100);
    expect(caloriesOnly.explanation).toContain('Omitted unavailable protein and fibre targets');
    expect(unavailable.score).toBeNull();
  });
});

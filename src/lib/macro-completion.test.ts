import { describe, expect, it } from 'vitest';
import { computeMacroCompletion } from './macro-completion';
import type { Food, NutritionTarget } from './types';

const target = (overrides: Partial<NutritionTarget> = {}): NutritionTarget => ({
  calorieTarget: 2000,
  calorieRange: [1800, 2200],
  maintenanceCalories: 2200,
  goalAdjustmentRangeCalories: [-400, 0],
  restingEnergy: 1800,
  proteinRangeG: [120, 160],
  fibreTargetG: 28,
  method: 'mifflin-st-jeor',
  ...overrides,
});

const food = (overrides: Partial<Food> = {}): Food => ({
  id: 'oats',
  name: 'Oats',
  servingMode: 'per_unit',
  unitLabel: 'bowl',
  defaultAmount: 1,
  calories: 300,
  carbsG: 40,
  proteinG: 12,
  fibreG: 5,
  favourite: true,
  lastUsedAt: null,
  ...overrides,
});

describe('computeMacroCompletion', () => {
  it('returns null when no target is set', () => {
    expect(
      computeMacroCompletion({
        totals: { calories: 500, proteinG: 10, fibreG: 2 },
        target: target({
          calorieTarget: null,
          calorieRange: null,
          proteinRangeG: null,
          fibreTargetG: null,
          method: 'unavailable',
        }),
        foods: [food()],
      })
    ).toBeNull();
  });

  it('marks complete and suggests nothing when every tracked macro is met', () => {
    const result = computeMacroCompletion({
      totals: { calories: 2100, proteinG: 130, fibreG: 30 },
      target: target(),
      foods: [food()],
    });
    expect(result?.complete).toBe(true);
    expect(result?.suggestions).toHaveLength(0);
    expect(result?.leadingMacro).toBeNull();
  });

  it('leads with calories and ranks foods by calorie coverage', () => {
    const result = computeMacroCompletion({
      totals: { calories: 1400, proteinG: 130, fibreG: 30 },
      target: target(),
      foods: [food({ id: 'low', calories: 150 }), food({ id: 'high', calories: 500 })],
    });
    expect(result?.leadingMacro).toBe('calories');
    expect(result?.remainingCalories).toBe(600);
    expect(result?.suggestions[0].food.id).toBe('high');
  });

  it('leads with protein when protein is the largest deficit', () => {
    const result = computeMacroCompletion({
      totals: { calories: 1950, proteinG: 60, fibreG: 30 },
      target: target(),
      foods: [food({ id: 'a', proteinG: 8 }), food({ id: 'b', proteinG: 25 })],
    });
    expect(result?.leadingMacro).toBe('protein');
    expect(result?.remainingProteinG).toBe(60);
    expect(result?.suggestions[0].food.id).toBe('b');
  });

  it('leads with fibre when fibre is the largest deficit', () => {
    const result = computeMacroCompletion({
      totals: { calories: 1950, proteinG: 130, fibreG: 10 },
      target: target(),
      foods: [food({ id: 'a', fibreG: 2 }), food({ id: 'b', fibreG: 8 })],
    });
    expect(result?.leadingMacro).toBe('fibre');
    expect(result?.remainingFibreG).toBe(18);
    expect(result?.suggestions[0].food.id).toBe('b');
  });

  it('returns no suggestions when macros remain but there are no saved foods', () => {
    const result = computeMacroCompletion({
      totals: { calories: 1000, proteinG: 30, fibreG: 5 },
      target: target(),
      foods: [],
    });
    expect(result?.complete).toBe(false);
    expect(result?.suggestions).toHaveLength(0);
  });

  it('filters out foods that contribute nothing to the leading macro', () => {
    const result = computeMacroCompletion({
      totals: { calories: 1950, proteinG: 60, fibreG: 30 },
      target: target(),
      foods: [food({ id: 'zero-protein', proteinG: 0 }), food({ id: 'protein', proteinG: 20 })],
    });
    expect(result?.suggestions.map((item) => item.food.id)).toEqual(['protein']);
  });

  it('caps suggestions to four foods', () => {
    const result = computeMacroCompletion({
      totals: { calories: 1000, proteinG: 130, fibreG: 30 },
      target: target(),
      foods: Array.from({ length: 8 }, (_, index) =>
        food({ id: `f${index}`, calories: 200 + index })
      ),
    });
    expect(result?.suggestions.length).toBeLessThanOrEqual(4);
  });
});

import { describe, expect, it } from 'vitest';
import { computeDailyRating } from './daily-rating';
import type { NutritionTarget } from './types';

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

describe('computeDailyRating', () => {
  it('returns null when no targets are set', () => {
    expect(
      computeDailyRating({
        totals: { calories: 500, proteinG: 10, fibreG: 2, waterMl: 200 },
        target: target({
          calorieTarget: null,
          calorieRange: null,
          proteinRangeG: null,
          fibreTargetG: null,
          method: 'unavailable',
        }),
        waterTargetMl: 0,
      })
    ).toBeNull();
  });

  it('rates a fully completed day at 5', () => {
    const result = computeDailyRating({
      totals: { calories: 2000, proteinG: 120, fibreG: 28, waterMl: 2000 },
      target: target(),
      waterTargetMl: 2000,
    });
    expect(result?.rating).toBe(5);
    expect(result?.label).toBe('All 4 targets in view');
  });

  it('rates an empty day at 1', () => {
    const result = computeDailyRating({
      totals: { calories: 0, proteinG: 0, fibreG: 0, waterMl: 0 },
      target: target(),
      waterTargetMl: 2000,
    });
    expect(result?.rating).toBe(1);
    expect(result?.label).toBe('0 of 4 targets in view');
  });

  it('rates a half-completed day at 3', () => {
    const result = computeDailyRating({
      totals: { calories: 1000, proteinG: 60, fibreG: 14, waterMl: 1000 },
      target: target(),
      waterTargetMl: 2000,
    });
    expect(result?.rating).toBe(3);
    expect(result?.label).toBe('0 of 4 targets in view');
  });

  it('caps overshoot at 100% per factor', () => {
    const result = computeDailyRating({
      totals: { calories: 4000, proteinG: 240, fibreG: 56, waterMl: 4000 },
      target: target(),
      waterTargetMl: 2000,
    });
    expect(result?.rating).toBe(5);
  });

  it('works with only a calorie target', () => {
    const result = computeDailyRating({
      totals: { calories: 1000, proteinG: 0, fibreG: 0, waterMl: 0 },
      target: target({ proteinRangeG: null, fibreTargetG: null }),
      waterTargetMl: 0,
    });
    expect(result?.rating).toBe(3);
    expect(result?.factors).toHaveLength(1);
  });

  it('rounds to nearest 0.5', () => {
    const result = computeDailyRating({
      totals: { calories: 1500, proteinG: 120, fibreG: 28, waterMl: 2000 },
      target: target(),
      waterTargetMl: 2000,
    });
    // factors: 0.75, 1, 1, 1 -> avg 0.9375 -> 1 + 3.75 = 4.75 -> rounds to 5
    expect(result?.rating).toBe(5);
  });
});

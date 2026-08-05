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

  it('rates an empty day low — calories met (limit) but other targets at zero', () => {
    const result = computeDailyRating({
      totals: { calories: 0, proteinG: 0, fibreG: 0, waterMl: 0 },
      target: target(),
      waterTargetMl: 2000,
    });
    // Calories share = 1 (under limit = met), protein/fibre/water = 0
    // avg = (1 + 0 + 0 + 0) / 4 = 0.25 -> 1 + 1 = 2
    expect(result?.rating).toBe(2);
    expect(result?.label).toBe('1 of 4 targets in view');
  });

  it('rates a half-completed day — calories under limit counts as met', () => {
    const result = computeDailyRating({
      totals: { calories: 1000, proteinG: 60, fibreG: 14, waterMl: 1000 },
      target: target(),
      waterTargetMl: 2000,
    });
    // Calories share = 1 (under limit), protein 0.5, fibre 0.5, water 0.5
    // avg = (1 + 0.5 + 0.5 + 0.5) / 4 = 0.625 -> 1 + 2.5 = 3.5 -> rounds to 3.5
    expect(result?.rating).toBe(3.5);
    expect(result?.label).toBe('1 of 4 targets in view');
  });

  it('penalizes going over the calorie limit', () => {
    const result = computeDailyRating({
      totals: { calories: 2500, proteinG: 120, fibreG: 28, waterMl: 2000 },
      target: target(),
      waterTargetMl: 2000,
    });
    // Calories share = 2000/2500 = 0.8 (over limit), others = 1
    // avg = (0.8 + 1 + 1 + 1) / 4 = 0.95 -> 1 + 3.8 = 4.8 -> rounds to 5
    expect(result?.rating).toBe(5);
    expect(result?.label).toBe('3 of 4 targets in view');
  });

  it('shows count when some but not all targets are met', () => {
    const result = computeDailyRating({
      totals: { calories: 2000, proteinG: 120, fibreG: 10, waterMl: 500 },
      target: target(),
      waterTargetMl: 2000,
    });
    // Calories at limit (met), protein met, fibre 10/28 (not met), water 500/2000 (not met)
    expect(result?.label).toBe('2 of 4 targets in view');
  });

  it('penalizes calorie overshoot even when other macros are overshot', () => {
    const result = computeDailyRating({
      totals: { calories: 4000, proteinG: 240, fibreG: 56, waterMl: 4000 },
      target: target(),
      waterTargetMl: 2000,
    });
    // Calories over limit: share = 2000/4000 = 0.5. Others capped at 1.
    // avg = (0.5 + 1 + 1 + 1) / 4 = 0.875 -> 1 + 3.5 = 4.5
    expect(result?.rating).toBe(4.5);
  });

  it('works with only a calorie target', () => {
    const result = computeDailyRating({
      totals: { calories: 1000, proteinG: 0, fibreG: 0, waterMl: 0 },
      target: target({ proteinRangeG: null, fibreTargetG: null }),
      waterTargetMl: 0,
    });
    // Only factor is calories (limit): under target = share 1 -> rating 5
    expect(result?.rating).toBe(5);
    expect(result?.factors).toHaveLength(1);
  });

  it('rounds to nearest 0.5', () => {
    const result = computeDailyRating({
      totals: { calories: 1500, proteinG: 120, fibreG: 28, waterMl: 2000 },
      target: target(),
      waterTargetMl: 2000,
    });
    // Calories share = 1 (under limit), protein 1, fibre 1, water 1
    // avg = 1 -> 1 + 4 = 5
    expect(result?.rating).toBe(5);
  });
});

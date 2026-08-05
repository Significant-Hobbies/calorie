import { describe, expect, it } from 'vitest';
import {
  calculateCompletedFasts,
  calculateGymGuidance,
  calculateNutritionTarget,
  calculateRestingEnergy,
  calculateSleepGuidance,
  calculateTargetWeightProgress,
  formatCalorieAdjustmentRange,
  scaleNutrients,
} from './recommendations';
import type { FoodEntry } from './types';

describe('nutrition calculations', () => {
  it('scales food defined per 100 grams', () => {
    expect(
      scaleNutrients({ calories: 100, carbsG: 20, proteinG: 5, fibreG: 4 }, 'per_100g', 150)
    ).toEqual({ calories: 150, carbsG: 30, proteinG: 7.5, fibreG: 6 });
  });

  it('calculates Mifflin-St Jeor resting energy', () => {
    expect(
      calculateRestingEnergy({
        weightKg: 72,
        heightCm: 175,
        ageYears: 28,
        equationProfile: 'male',
      })
    ).toBe(1679);
  });

  it('builds an explainable target and nutrient ranges', () => {
    const target = calculateNutritionTarget({
      weightKg: 72,
      heightCm: 175,
      ageYears: 28,
      equationProfile: 'male',
      activityLevel: 'moderate',
      goal: 'lose_gentle',
    });
    expect(target.calorieTarget).toBe(2147);
    expect(target.calorieRange).toEqual([2082, 2212]);
    expect(target.maintenanceCalories).toBe(2602);
    expect(target.goalAdjustmentRangeCalories).toEqual([-520, -390]);
    expect(target.proteinRangeG).toEqual([115, 144]);
    expect(target.fibreTargetG).toBe(30);
    expect(target.method).toBe('mifflin-st-jeor');
  });

  it('respects a manual calorie target without requiring an equation profile', () => {
    expect(
      calculateNutritionTarget({
        weightKg: 70,
        heightCm: null,
        ageYears: null,
        equationProfile: 'none',
        activityLevel: 'light',
        goal: 'maintain',
        manualCalorieTarget: 2000,
      })
    ).toMatchObject({
      calorieTarget: 2000,
      calorieRange: [1900, 2100],
      maintenanceCalories: null,
      goalAdjustmentRangeCalories: null,
      fibreTargetG: 28,
      method: 'manual',
    });
  });

  it('applies every goal adjustment to the same maintenance estimate', () => {
    const input = {
      weightKg: 72,
      heightCm: 175,
      ageYears: 28,
      equationProfile: 'male' as const,
      activityLevel: 'moderate' as const,
    };

    expect(
      (['lose_gentle', 'lose_steady', 'maintain', 'gain_gentle'] as const).map((goal) => {
        const target = calculateNutritionTarget({ ...input, goal });
        return [goal, target.goalAdjustmentRangeCalories, target.calorieRange];
      })
    ).toEqual([
      ['lose_gentle', [-520, -390], [2082, 2212]],
      ['lose_steady', [-650, -520], [1952, 2082]],
      ['maintain', [-130, 130], [2472, 2732]],
      ['gain_gentle', [130, 260], [2732, 2862]],
    ]);
  });

  it('limits automatic loss targets and reports the adjustment actually applied', () => {
    const target = calculateNutritionTarget({
      weightKg: 60,
      heightCm: 160,
      ageYears: 40,
      equationProfile: 'female',
      activityLevel: 'sedentary',
      goal: 'lose_steady',
    });
    expect(target.maintenanceCalories).toBe(1487);
    expect(target.calorieTarget).toBe(1200);
    expect(target.calorieRange).toEqual([1200, 1200]);
    expect(target.goalAdjustmentRangeCalories).toEqual([-287, -287]);
    expect(target.proteinRangeG).toEqual([96, 120]);
  });

  it('uses explicit manual ranges and formats signed adjustment ranges', () => {
    const target = calculateNutritionTarget({
      weightKg: 70,
      heightCm: null,
      ageYears: null,
      equationProfile: 'none',
      activityLevel: 'light',
      goal: 'maintain',
      manualCalorieRange: [2100, 1900],
    });
    expect(target.calorieRange).toEqual([1900, 2100]);
    expect(target.calorieTarget).toBe(2000);
    expect(formatCalorieAdjustmentRange([-520, -390])).toBe('−520 to −390');
  });

  it('describes target-weight progress without inventing a timeline', () => {
    expect(calculateTargetWeightProgress(80, 72)).toEqual({
      direction: 'lose',
      distanceKg: 8,
      explanation: '8 kg to lose to reach your target.',
    });
  });
});

describe('timing calculations', () => {
  const entry = (id: string, eatenAt: number, carbsG: number, calories = 400): FoodEntry => ({
    id,
    foodId: null,
    foodName: id,
    amount: 1,
    unitLabel: 'serving',
    calories,
    carbsG,
    proteinG: 10,
    fibreG: 3,
    eatenAt,
  });

  it('uses each eating day’s last and next first food as the fasting window', () => {
    const hour = 60 * 60 * 1000;
    const day = 24 * hour;
    const result = calculateCompletedFasts(
      [
        entry('lunch', 12 * hour, 40),
        entry('dinner', 20 * hour, 20),
        entry('breakfast', day + 10 * hour, 30),
        entry('second dinner', day + 21 * hour, 20),
        entry('second breakfast', 2 * day + 9 * hour, 30),
      ],
      'UTC'
    );
    expect(result).toEqual([
      { startAt: 20 * hour, endAt: day + 10 * hour, durationHours: 14 },
      { startAt: day + 21 * hour, endAt: 2 * day + 9 * hour, durationHours: 12 },
    ]);
  });

  it('call sites can filter by minimum duration to exclude short overnight gaps', () => {
    const hour = 60 * 60 * 1000;
    const day = 24 * hour;
    const windows = calculateCompletedFasts(
      [
        entry('dinner', 22 * hour, 20),
        entry('breakfast', day + 8 * hour, 30),
        entry('dinner', day + 20 * hour, 20),
        entry('breakfast', 2 * day + 7 * hour, 30),
      ],
      'UTC'
    );
    // First gap: 22h → 8h next day = 10h (below 12h threshold)
    // Second gap: 20h → 7h next day = 11h (below 12h threshold)
    expect(windows).toEqual([
      { startAt: 22 * hour, endAt: day + 8 * hour, durationHours: 10 },
      { startAt: day + 20 * hour, endAt: 2 * day + 7 * hour, durationHours: 11 },
    ]);
    // Call sites filter: only windows >= threshold count toward fastCount
    const threshold = 12;
    const qualifying = windows.filter((fast) => fast.durationHours >= threshold);
    expect(qualifying).toEqual([]);
  });

  it('uses recent carbs to provide a broad exercise window', () => {
    const now = Date.UTC(2026, 6, 25, 12);
    const result = calculateGymGuidance([entry('Oats', now - 30 * 60 * 1000, 45)], now);
    expect(result.state).toBe('window');
    expect(result.startAt).toBe(now + 30 * 60 * 1000);
    expect(result.endAt).toBe(now + 120 * 60 * 1000);
  });

  it('pushes sleep later after a heavy late meal', () => {
    const result = calculateSleepGuidance({
      wakeTime: '07:00',
      sleepHours: 8,
      lastEntryLocalMinutes: 22 * 60,
      lastEntryCalories: 600,
    });
    expect(result.recommendedMinutes).toBe(25 * 60);
    expect(result.explanation).toContain('3-hour');
  });
});

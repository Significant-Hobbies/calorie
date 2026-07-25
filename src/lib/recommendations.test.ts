import { describe, expect, it } from 'vitest';
import {
  calculateCompletedFasts,
  calculateGymGuidance,
  calculateNutritionTarget,
  calculateRestingEnergy,
  calculateSleepGuidance,
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
    expect(target.calorieTarget).toBe(2352);
    expect(target.proteinRangeG).toEqual([86, 115]);
    expect(target.fibreTargetG).toBe(33);
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
      fibreTargetG: 28,
      method: 'manual',
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

  it('counts threshold-crossing gaps but ignores water by construction', () => {
    const hour = 60 * 60 * 1000;
    expect(
      calculateCompletedFasts(
        [entry('dinner', 0, 20), entry('breakfast', 14 * hour, 30), entry('lunch', 19 * hour, 40)],
        12
      )
    ).toHaveLength(1);
  });

  it('uses recent carbs to provide a broad gym window', () => {
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

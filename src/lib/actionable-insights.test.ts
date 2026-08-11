import { describe, expect, it } from 'vitest';
import { analyzeActionableInsights } from './actionable-insights';
import type { FoodEntry, HistoryDay, NutritionTarget } from './types';

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

const day = (date: string, overrides: Partial<HistoryDay> = {}): HistoryDay => ({
  date,
  calories: 0,
  carbsG: 0,
  proteinG: 0,
  fibreG: 0,
  waterMl: 0,
  fastCount: 0,
  ...overrides,
});

const entry = (id: string, date: Date, overrides: Partial<FoodEntry> = {}): FoodEntry => ({
  id,
  foodId: 'oats',
  foodName: 'Oats',
  amount: 1,
  unitLabel: 'bowl',
  calories: 300,
  carbsG: 40,
  proteinG: 12,
  fibreG: 5,
  eatenAt: date.getTime(),
  ...overrides,
});

describe('analyzeActionableInsights', () => {
  it('marks a one-day sample as sparse without assigning a negative judgement', () => {
    const result = analyzeActionableInsights({
      days: [day('2026-01-01')],
      entries: [entry('one', new Date(2026, 0, 1, 12))],
      target: target(),
      waterTargetMl: 2000,
    });

    expect(result.confidence).toEqual({ loggedDays: 1, windowDays: 1, isSparse: true });
    expect(result.takeaway).toBe('Log food on another day to make your patterns clearer.');
  });

  it('calculates coverage from food-logged days and labels unavailable targets', () => {
    const result = analyzeActionableInsights({
      days: [
        day('2026-01-01', { calories: 1000, proteinG: 60, fibreG: 14, waterMl: 1000 }),
        day('2026-01-02', { calories: 2000, proteinG: 120, fibreG: 28, waterMl: 2000 }),
        day('2026-01-03', { calories: 0, proteinG: 0, fibreG: 0, waterMl: 0 }),
      ],
      entries: [
        entry('one', new Date(2026, 0, 1, 12)),
        entry('two', new Date(2026, 0, 2, 12), { id: 'two', foodId: 'dal', foodName: 'Dal' }),
      ],
      target: target({ fibreTargetG: null }),
      waterTargetMl: 2000,
    });

    expect(result.confidence).toEqual({ loggedDays: 2, windowDays: 3, isSparse: false });
    expect(result.coverage).toEqual([
      {
        key: 'calories',
        label: 'Calories',
        averagePercent: 75,
        targetDescription: '2,000 kcal daily limit',
      },
      {
        key: 'protein',
        label: 'Protein',
        averagePercent: 75,
        targetDescription: '120 g daily floor',
      },
      {
        key: 'water',
        label: 'Water',
        averagePercent: 75,
        targetDescription: '2,000 ml daily target',
      },
    ]);
    expect(result.takeaway).toBe(
      'Calories had the lowest average target coverage across your logged days (75%). Treat that as context—calories are a limit, not a target to fill.'
    );
  });

  it('uses a target-specific action when water is least covered', () => {
    const result = analyzeActionableInsights({
      days: [
        day('2026-01-01', { calories: 2000, proteinG: 120, fibreG: 28, waterMl: 500 }),
        day('2026-01-02', { calories: 2000, proteinG: 120, fibreG: 28, waterMl: 1000 }),
      ],
      entries: [entry('one', new Date(2026, 0, 1, 12)), entry('two', new Date(2026, 0, 2, 12))],
      target: target(),
      waterTargetMl: 2000,
    });

    expect(result.takeaway).toBe(
      'Water had the lowest average target coverage across your logged days (38%). Log drinks as you go if water is missing from today’s journal.'
    );
  });

  it('summarizes variety and repeated foods from recorded entries', () => {
    const result = analyzeActionableInsights({
      days: [day('2026-01-01'), day('2026-01-02')],
      entries: [
        entry('one', new Date(2026, 0, 1, 12)),
        entry('two', new Date(2026, 0, 1, 18)),
        entry('three', new Date(2026, 0, 2, 12), { foodId: 'dal', foodName: 'Dal' }),
      ],
      target: target({ calorieTarget: null, proteinRangeG: null, fibreTargetG: null }),
      waterTargetMl: 0,
    });

    expect(result.variety).toEqual({ distinctFoods: 2, repeatedFoods: 1, totalOccasions: 3 });
    expect(result.takeaway).toBe('Oats was your most repeated food: 2 logged occasions.');
  });

  it('compares selected and prior windows only when both contain logged food', () => {
    const result = analyzeActionableInsights({
      days: [day('2026-01-08', { calories: 1500 })],
      entries: [entry('now', new Date(2026, 0, 8, 12), { calories: 1500 })],
      previousDays: [day('2026-01-01', { calories: 1000 })],
      previousEntries: [entry('before', new Date(2026, 0, 1, 12), { calories: 1000 })],
      target: target(),
      waterTargetMl: 0,
    });

    expect(result.comparison).toEqual({ averageCaloriesDelta: 500, direction: 'higher' });
  });
});

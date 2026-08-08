import { describe, expect, it } from 'vitest';
import { analyzeCyclePeriod, compareCycleAnalyses } from './cycle-analytics';
import type { CyclePeriodData, GoalCycleSession, HistoryDay, WeightEntry } from './types';

function session(overrides: Partial<GoalCycleSession> = {}): GoalCycleSession {
  return {
    id: 'cycle',
    userId: 'user',
    cycle: 'cut',
    goal: 'lose_gentle',
    startOn: '2026-08-01',
    endOn: null,
    calorieRange: [1800, 2000],
    proteinRangeG: [120, 150],
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function day(date: string, calories: number, proteinG = 120): HistoryDay {
  return { date, calories, proteinG, carbsG: 0, fibreG: 0, waterMl: 0, fastCount: 0 };
}

function weight(id: string, dayOffset: number, weightKg: number): WeightEntry {
  return {
    id,
    weightKg,
    recordedAt: Date.UTC(2026, 7, 1 + dayOffset, 12),
  };
}

describe('cycle analytics', () => {
  it('uses only logged days and computes a smoothed weekly rate', () => {
    const period: CyclePeriodData = {
      session: session(),
      days: [
        day('2026-08-01', 1800),
        day('2026-08-02', 1900),
        day('2026-08-03', 0, 0),
        day('2026-08-04', 2000),
        day('2026-08-08', 1900),
      ],
      weights: [weight('a', 0, 72), weight('b', 7, 71.3), weight('c', 14, 70.6)],
    };
    const result = analyzeCyclePeriod(period, '2026-08-15');
    expect(result).toMatchObject({
      elapsedDays: 15,
      loggedDays: 4,
      averageCalories: 1900,
      weeklyWeightRateKg: -0.7,
      status: 'on_track',
    });
  });

  it('keeps sparse and mixed signals insufficient', () => {
    const sparse = analyzeCyclePeriod(
      { session: session(), days: [day('2026-08-01', 1900)], weights: [] },
      '2026-08-03'
    );
    expect(sparse.status).toBe('insufficient_data');

    const mixed = analyzeCyclePeriod(
      {
        session: session(),
        days: Array.from({ length: 4 }, (_, index) => day(`2026-08-0${index + 1}`, 1900)),
        weights: [weight('a', 0, 72), weight('b', 8, 72.5)],
      },
      '2026-08-09'
    );
    expect(mixed.status).toBe('insufficient_data');
  });

  it('marks review only when intake and direction both conflict', () => {
    const result = analyzeCyclePeriod(
      {
        session: session(),
        days: Array.from({ length: 4 }, (_, index) => day(`2026-08-0${index + 1}`, 2300)),
        weights: [weight('a', 0, 72), weight('b', 8, 72.8)],
      },
      '2026-08-09'
    );
    expect(result.status).toBe('review_target');
  });

  it('compares only supported matching samples', () => {
    const base = analyzeCyclePeriod(
      {
        session: session(),
        days: Array.from({ length: 4 }, (_, index) => day(`2026-08-0${index + 1}`, 1900, 125)),
        weights: [weight('a', 0, 72), weight('b', 8, 71.5)],
      },
      '2026-08-09'
    );
    expect(compareCycleAnalyses(base, { ...base, averageCalories: 1800 })).toMatchObject({
      caloriesDelta: 100,
    });
    expect(compareCycleAnalyses(base, { ...base, loggedDays: 2 })).toBeNull();
  });
});

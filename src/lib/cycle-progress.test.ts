import { describe, expect, it } from 'vitest';
import { summarizeCycleProgress } from './cycle-progress';
import type { HistoryDay, WeightEntry } from './types';

function day(input: Partial<HistoryDay> & Pick<HistoryDay, 'date'>): HistoryDay {
  return {
    calories: 0,
    carbsG: 0,
    proteinG: 0,
    fibreG: 0,
    waterMl: 0,
    fastCount: 0,
    ...input,
  };
}

describe('summarizeCycleProgress', () => {
  it('averages nutrition across logged days and reports coverage', () => {
    const result = summarizeCycleProgress(
      [
        day({ date: '2026-08-07', calories: 1800, proteinG: 120, fibreG: 24, waterMl: 2000 }),
        day({ date: '2026-08-08' }),
        day({ date: '2026-08-09', calories: 2200, proteinG: 140, fibreG: 30, waterMl: 2600 }),
      ],
      [],
      'metric'
    );

    expect(result).toMatchObject({
      loggedDays: 2,
      windowDays: 3,
      averageCalories: 2000,
      averageProtein: 130,
      averageFibre: 27,
      averageWater: 2300,
    });
  });

  it('returns a signed first-to-last weight change in the preferred units', () => {
    const weights: WeightEntry[] = [
      { id: 'new', weightKg: 70.5, recordedAt: 2 },
      { id: 'old', weightKg: 71, recordedAt: 1 },
    ];

    expect(summarizeCycleProgress([], weights, 'metric').weightChange).toEqual({
      value: -0.5,
      unit: 'kg',
    });
    expect(summarizeCycleProgress([], weights, 'imperial').weightChange).toEqual({
      value: -1.1,
      unit: 'lb',
    });
  });

  it('keeps sparse history neutral when fewer than two weights exist', () => {
    expect(
      summarizeCycleProgress([], [{ id: 'only', weightKg: 70, recordedAt: 1 }], 'metric')
        .weightChange
    ).toBeNull();
  });
});

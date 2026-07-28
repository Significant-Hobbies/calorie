import { describe, expect, it } from 'vitest';
import { analyzeMealTiming } from './meal-timing';
import type { FoodEntry } from './types';

const atUtc = (date: string, hours: number, minutes = 0) =>
  Date.parse(`${date}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00Z`);

function entry(input: {
  id: string;
  date: string;
  hours: number;
  minutes?: number;
  foodId?: string | null;
  foodName?: string;
  calories?: number;
  proteinG?: number;
}): FoodEntry {
  return {
    id: input.id,
    foodId: input.foodId ?? input.id,
    foodName: input.foodName ?? input.id,
    amount: 1,
    unitLabel: 'serving',
    calories: input.calories ?? 100,
    carbsG: 10,
    proteinG: input.proteinG ?? 10,
    fibreG: 2,
    eatenAt: atUtc(input.date, input.hours, input.minutes),
  };
}

describe('analyzeMealTiming', () => {
  it('counts only dates with entries and keeps a one-day sample sparse', () => {
    const analysis = analyzeMealTiming({
      entries: [
        entry({ id: 'breakfast', date: '2026-07-28', hours: 8 }),
        entry({ id: 'dinner', date: '2026-07-28', hours: 19 }),
      ],
      timezone: 'UTC',
      wakeTime: '07:00',
      sleepHours: 8,
    });

    expect(analysis.loggedDays).toBe(1);
    expect(analysis.entryCount).toBe(2);
    expect(analysis.averageEatingWindowMinutes).toBe(11 * 60);
    expect(analysis.eatingWindowDays).toBe(1);
  });

  it('uses a circular mean for clock times around midnight', () => {
    const analysis = analyzeMealTiming({
      entries: [
        entry({ id: 'late', date: '2026-07-26', hours: 23, minutes: 30 }),
        entry({ id: 'early', date: '2026-07-27', hours: 0, minutes: 30 }),
      ],
      timezone: 'UTC',
      wakeTime: '08:00',
      sleepHours: 8,
    });

    expect(analysis.typicalFirstMinutes).toBe(0);
    expect(analysis.typicalLastMinutes).toBe(0);
  });

  it('calculates time bands, repeated foods, and sleep-routine proximity', () => {
    const analysis = analyzeMealTiming({
      entries: [
        entry({
          id: 'oats-1',
          foodId: 'oats',
          foodName: 'Oats',
          date: '2026-07-27',
          hours: 8,
          calories: 300,
          proteinG: 12,
        }),
        entry({
          id: 'dal-1',
          foodId: 'dal',
          foodName: 'Dal',
          date: '2026-07-27',
          hours: 13,
          calories: 500,
          proteinG: 20,
        }),
        entry({
          id: 'paneer-1',
          foodId: 'paneer',
          foodName: 'Paneer',
          date: '2026-07-27',
          hours: 21,
          calories: 200,
          proteinG: 30,
        }),
        entry({
          id: 'oats-2',
          foodId: 'oats',
          foodName: 'Oats & berries',
          date: '2026-07-28',
          hours: 8,
          calories: 300,
          proteinG: 12,
        }),
        entry({
          id: 'oats-3',
          foodId: 'oats',
          foodName: 'Oats & berries',
          date: '2026-07-28',
          hours: 10,
          calories: 0,
          proteinG: 0,
        }),
        entry({
          id: 'dal-2',
          foodId: 'dal',
          foodName: 'Dal',
          date: '2026-07-28',
          hours: 13,
          calories: 500,
          proteinG: 20,
        }),
        entry({
          id: 'paneer-2',
          foodId: 'paneer',
          foodName: 'Paneer',
          date: '2026-07-28',
          hours: 21,
          calories: 200,
          proteinG: 30,
        }),
      ],
      timezone: 'UTC',
      wakeTime: '07:00',
      sleepHours: 8,
    });

    expect(analysis.loggedDays).toBe(2);
    expect(analysis.typicalFirstMinutes).toBe(8 * 60);
    expect(analysis.typicalLastMinutes).toBe(21 * 60);
    expect(analysis.averageEatingWindowMinutes).toBe(13 * 60);
    expect(analysis.nearSleepDays).toBe(2);
    expect(analysis.mostLoggedFood).toEqual({
      name: 'Oats & berries',
      entryCount: 3,
      typicalMinutes: 520,
    });
    expect(analysis.bands.map((band) => Math.round(band.calorieShare * 100))).toEqual([30, 50, 20]);
    expect(analysis.leadingProteinBand).toBe('after_five');
  });
});

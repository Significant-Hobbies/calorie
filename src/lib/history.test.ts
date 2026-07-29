import { describe, expect, it } from 'vitest';
import { entriesForLocalDate, entriesWithinRange } from './history';
import type { FoodEntry } from './types';

function entry(id: string, eatenAt: number): FoodEntry {
  return {
    id,
    foodId: id,
    foodName: `Food ${id}`,
    amount: 1.5,
    unitLabel: 'bowl',
    calories: 420,
    carbsG: 48,
    proteinG: 22,
    fibreG: 7,
    eatenAt,
  };
}

describe('history food entries', () => {
  it('keeps the start boundary, excludes the end boundary, and sorts chronologically', () => {
    const start = new Date(2026, 6, 10, 0, 0).getTime();
    const end = new Date(2026, 6, 11, 0, 0).getTime();
    const entries = [
      entry('late', new Date(2026, 6, 10, 20, 0).getTime()),
      entry('end', end),
      entry('start', start),
      entry('before', start - 1),
    ];

    expect(entriesWithinRange(entries, start, end).map((item) => item.id)).toEqual([
      'start',
      'late',
    ]);
  });

  it('returns only the selected local date with all row fields intact', () => {
    const entries = [
      entry('lunch', new Date(2026, 6, 10, 13, 0).getTime()),
      entry('breakfast', new Date(2026, 6, 10, 7, 30).getTime()),
      entry('tomorrow', new Date(2026, 6, 11, 7, 30).getTime()),
    ];

    expect(entriesForLocalDate(entries, '2026-07-10')).toEqual([
      expect.objectContaining({
        id: 'breakfast',
        foodName: 'Food breakfast',
        amount: 1.5,
        unitLabel: 'bowl',
        calories: 420,
        carbsG: 48,
        proteinG: 22,
        fibreG: 7,
      }),
      expect.objectContaining({ id: 'lunch' }),
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import type { HistoryResponse } from './types';
import { journalEventCount, weeklyEventsForDate } from './weekly-journal';

const day = '2026-08-10';
const at = (hour: number) => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00`).getTime();

const history: HistoryResponse = {
  days: [],
  entries: [
    {
      id: 'food',
      foodId: null,
      foodName: 'Lunch',
      amount: 1,
      unitLabel: 'plate',
      calories: 400,
      carbsG: 40,
      proteinG: 20,
      fibreG: 5,
      eatenAt: at(13),
    },
  ],
  weights: [{ id: 'weight', weightKg: 70, recordedAt: at(7) }],
  medicationEvents: [
    { id: 'medicine', medicationId: 'vitamin-d', medicationName: 'Vitamin D', takenAt: at(8) },
  ],
};

describe('weekly journal events', () => {
  it('combines mixed events in chronological order', () => {
    expect(weeklyEventsForDate(history, day).map((event) => event.type)).toEqual([
      'weight',
      'medicine',
      'food',
    ]);
  });

  it.each(['food', 'weight', 'medicine'] as const)('filters to %s events', (filter) => {
    expect(weeklyEventsForDate(history, day, filter).map((event) => event.type)).toEqual([filter]);
  });

  it('keeps empty and future dates neutral', () => {
    expect(weeklyEventsForDate(history, '2026-08-11')).toEqual([]);
  });

  it('uses singular and plural event counts', () => {
    expect(journalEventCount(1)).toBe('1 event');
    expect(journalEventCount(2)).toBe('2 events');
  });
});

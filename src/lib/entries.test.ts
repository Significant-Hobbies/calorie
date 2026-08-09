import { describe, expect, it, vi } from 'vitest';
import { directEntryError, foodFromDirectEntry, normalizeDirectEntry } from './entries';
import type { FoodEntry } from './types';

const entry = (overrides: Partial<FoodEntry> = {}): FoodEntry => ({
  id: 'entry-1',
  foodId: null,
  foodName: '  Lunch special  ',
  amount: 1,
  unitLabel: ' serving ',
  calories: 420,
  carbsG: 48,
  proteinG: 22,
  fibreG: 7,
  eatenAt: 1_700_000_000_000,
  ...overrides,
});

describe('direct entries', () => {
  it('normalizes a valid direct snapshot', () => {
    vi.setSystemTime(1_700_000_000_000);
    expect(normalizeDirectEntry(entry({ isPackaged: true }))).toMatchObject({
      foodId: null,
      foodName: 'Lunch special',
      unitLabel: 'serving',
      calories: 420,
      isPackaged: true,
    });
    vi.useRealTimers();
  });

  it('rejects invalid direct snapshots', () => {
    expect(directEntryError(entry({ foodName: ' ' }))).toContain('food name');
    expect(directEntryError(entry({ amount: 0 }))).toContain('amount');
    expect(directEntryError(entry({ proteinG: -1 }))).toContain('Nutrients');
    expect(directEntryError(entry({ foodId: 'saved-food' }))).toContain('saved food');
  });

  it('creates a reusable food scaled to the direct-entry serving', () => {
    vi.setSystemTime(1_700_000_000_000);
    expect(
      foodFromDirectEntry(
        entry({ amount: 2, calories: 420, proteinG: 22, isPackaged: true }),
        'food-1'
      )
    ).toMatchObject({
      id: 'food-1',
      name: 'Lunch special',
      servingMode: 'per_unit',
      unitLabel: 'serving',
      defaultAmount: 2,
      calories: 210,
      proteinG: 11,
      isPackaged: true,
    });
    vi.useRealTimers();
  });
});

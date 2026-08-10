import { describe, expect, it, vi } from 'vitest';
import {
  directEntryError,
  foodFromDirectEntry,
  mergeDashboardEntry,
  normalizeDirectEntry,
} from './entries';
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

describe('optimistic dashboard entries', () => {
  const dashboardDate = '2026-08-11';
  const timezone = 'Asia/Kolkata';

  it('does not insert a backdated entry into the current-day dashboard', () => {
    const current = entry({ id: 'today', eatenAt: Date.UTC(2026, 7, 11, 6) });
    const backdated = entry({ id: 'yesterday', eatenAt: Date.UTC(2026, 7, 10, 6) });

    expect(mergeDashboardEntry([current], backdated, dashboardDate, timezone)).toEqual([current]);
  });

  it('removes an edited entry that moved out of the dashboard date', () => {
    const original = entry({ id: 'moving', eatenAt: Date.UTC(2026, 7, 11, 6) });
    const edited = entry({ id: 'moving', eatenAt: Date.UTC(2026, 7, 10, 6) });
    const remaining = entry({ id: 'remaining', eatenAt: Date.UTC(2026, 7, 11, 8) });

    expect(mergeDashboardEntry([original, remaining], edited, dashboardDate, timezone)).toEqual([
      remaining,
    ]);
  });

  it('uses the dashboard timezone at a date boundary', () => {
    const midnightInKolkata = entry({ eatenAt: Date.UTC(2026, 7, 10, 18, 30) });

    expect(mergeDashboardEntry([], midnightInKolkata, dashboardDate, timezone)).toEqual([
      midnightInKolkata,
    ]);
  });
});

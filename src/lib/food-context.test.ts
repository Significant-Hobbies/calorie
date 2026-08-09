import { describe, expect, it } from 'vitest';
import { normalizeFoodLabels, normalizeIsPackaged } from './food-context';

describe('food context', () => {
  it('normalizes packaging and deterministically maps legacy kinds', () => {
    expect(normalizeIsPackaged(true)).toBe(true);
    expect(normalizeIsPackaged(false, 'packaged')).toBe(false);
    expect(normalizeIsPackaged(undefined, 'packaged')).toBe(true);
    expect(normalizeIsPackaged(undefined, 'whole_food')).toBe(false);
    expect(normalizeIsPackaged(undefined, 'supplement')).toBe(false);
  });

  it('deduplicates, trims, limits, and normalizes private labels', () => {
    expect(normalizeFoodLabels(' Breakfast, HIGH Protein, breakfast ')).toEqual([
      'breakfast',
      'high protein',
    ]);
    expect(
      normalizeFoodLabels(Array.from({ length: 12 }, (_, index) => `tag-${index}`))
    ).toHaveLength(8);
  });
});

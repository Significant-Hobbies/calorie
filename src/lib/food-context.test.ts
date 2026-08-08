import { describe, expect, it } from 'vitest';
import { normalizeFoodKind, normalizeFoodLabels } from './food-context';

describe('food context', () => {
  it('normalizes kinds without inventing an unknown category', () => {
    expect(normalizeFoodKind('whole_food')).toBe('whole_food');
    expect(normalizeFoodKind('mystery')).toBe('prepared');
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

import { describe, expect, it } from 'vitest';
import { detachFoodDefinition, foodsByLifecycle, normalizeFood } from './food-library';
import type { Food, FoodEntry } from './types';

const food = (id: string, archivedAt: number | null): Food => ({
  id,
  name: id,
  servingMode: 'per_unit',
  unitLabel: 'serving',
  defaultAmount: 1,
  calories: 300,
  carbsG: 40,
  proteinG: 20,
  fibreG: 5,
  favourite: false,
  lastUsedAt: null,
  archivedAt,
});

describe('food library lifecycle', () => {
  it('normalizes legacy foods as active', () => {
    const { archivedAt: _archivedAt, ...legacy } = food('legacy', null);
    expect(normalizeFood(legacy).archivedAt).toBeNull();
  });

  it('separates active and archived foods', () => {
    const foods = [food('active', null), food('archived', 1000)];
    expect(foodsByLifecycle(foods, 'active').map((item) => item.id)).toEqual(['active']);
    expect(foodsByLifecycle(foods, 'archived').map((item) => item.id)).toEqual(['archived']);
  });

  it('detaches a permanently deleted definition without changing entry snapshots', () => {
    const entry: FoodEntry = {
      id: 'entry-1',
      foodId: 'oats',
      foodName: 'Oats',
      amount: 1,
      unitLabel: 'bowl',
      calories: 300,
      carbsG: 40,
      proteinG: 12,
      fibreG: 5,
      eatenAt: 1000,
    };

    expect(detachFoodDefinition([entry], 'oats')).toEqual([{ ...entry, foodId: null }]);
  });
});

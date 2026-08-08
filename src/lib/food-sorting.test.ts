import { describe, expect, it } from 'vitest';
import { sortFoods } from './food-sorting';
import type { Food } from './types';

const food = (name: string, proteinG: number, fibreG: number, lastUsedAt: number | null): Food => ({
  id: name,
  name,
  servingMode: 'per_unit',
  unitLabel: 'serving',
  defaultAmount: 1,
  calories: 100,
  carbsG: 10,
  proteinG,
  fibreG,
  favourite: false,
  lastUsedAt,
  archivedAt: null,
});

describe('saved food ordering', () => {
  const foods = [food('Zucchini', 2, 4, null), food('Apple', 2, 3, 20), food('Beans', 8, 9, 10)];

  it('keeps the four owner-facing orders predictable', () => {
    expect(sortFoods(foods, 'recent').map((item) => item.name)).toEqual([
      'Apple',
      'Beans',
      'Zucchini',
    ]);
    expect(sortFoods(foods, 'name').map((item) => item.name)).toEqual([
      'Apple',
      'Beans',
      'Zucchini',
    ]);
    expect(sortFoods(foods, 'protein').map((item) => item.name)).toEqual([
      'Beans',
      'Apple',
      'Zucchini',
    ]);
    expect(sortFoods(foods, 'fibre').map((item) => item.name)).toEqual([
      'Beans',
      'Zucchini',
      'Apple',
    ]);
  });
});

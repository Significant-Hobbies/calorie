import type { Food } from './types';

export type FoodSortKey = 'recent' | 'name' | 'protein' | 'fibre';

export function sortFoods(foods: Food[], sort: FoodSortKey): Food[] {
  const byName = (a: Food, b: Food) => a.name.localeCompare(b.name);
  switch (sort) {
    case 'recent':
      return [...foods].sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0) || byName(a, b));
    case 'name':
      return [...foods].sort(byName);
    case 'protein':
      return [...foods].sort((a, b) => b.proteinG - a.proteinG || byName(a, b));
    case 'fibre':
      return [...foods].sort((a, b) => b.fibreG - a.fibreG || byName(a, b));
  }
}

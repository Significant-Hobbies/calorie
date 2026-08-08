import { normalizeFoodKind, normalizeFoodLabels } from './food-context';
import type { Food, FoodEntry } from './types';

export type FoodLifecycle = 'active' | 'archived';

type LegacyFood = Omit<Food, 'archivedAt'> & { archivedAt?: number | null };

export function normalizeFood(food: LegacyFood): Food {
  return {
    ...food,
    archivedAt: food.archivedAt ?? null,
    foodKind: normalizeFoodKind(food.foodKind),
    labels: normalizeFoodLabels(food.labels),
  };
}

export function detachFoodDefinition(entries: FoodEntry[], foodId: string): FoodEntry[] {
  return entries.map((entry) => (entry.foodId === foodId ? { ...entry, foodId: null } : entry));
}

export function isArchivedFood(food: Food): boolean {
  return food.archivedAt !== null;
}

export function foodsByLifecycle(foods: Food[], lifecycle: FoodLifecycle): Food[] {
  const archived = lifecycle === 'archived';
  return foods.map(normalizeFood).filter((food) => isArchivedFood(food) === archived);
}

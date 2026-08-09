import { normalizeFoodLabels, normalizeIsPackaged } from './food-context';
import type { Food, FoodEntry } from './types';

export type FoodLifecycle = 'active' | 'archived';

type LegacyFood = Omit<Food, 'archivedAt' | 'isPackaged'> & {
  archivedAt?: number | null;
  isPackaged?: unknown;
  foodKind?: unknown;
};

type LegacyFoodEntry = Omit<FoodEntry, 'isPackaged'> & {
  isPackaged?: unknown;
  foodKind?: unknown;
};

export function normalizeFood(food: LegacyFood): Food {
  return {
    ...food,
    archivedAt: food.archivedAt ?? null,
    isPackaged: normalizeIsPackaged(food.isPackaged, food.foodKind),
    labels: normalizeFoodLabels(food.labels),
  };
}

export function normalizeFoodEntry(entry: LegacyFoodEntry): FoodEntry {
  return {
    ...entry,
    isPackaged: normalizeIsPackaged(entry.isPackaged, entry.foodKind),
    labels: normalizeFoodLabels(entry.labels),
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

import { normalizeFoodLabels, normalizeIsPackaged } from './food-context';
import type { Food, FoodEntry } from './types';

const MAX_AMOUNT = 10_000;
const MAX_NUTRIENT = 100_000;

export function directEntryError(entry: FoodEntry): string | null {
  if (entry.foodId !== null) return 'A direct entry cannot reference a saved food.';
  if (!entry.foodName.trim() || entry.foodName.trim().length > 80) {
    return 'Add a food name up to 80 characters.';
  }
  if (!entry.unitLabel.trim() || entry.unitLabel.trim().length > 24) {
    return 'Add a unit up to 24 characters.';
  }
  if (!Number.isFinite(entry.amount) || entry.amount <= 0 || entry.amount > MAX_AMOUNT) {
    return 'Add an amount above zero.';
  }
  if (
    [entry.calories, entry.carbsG, entry.proteinG, entry.fibreG].some(
      (value) => !Number.isFinite(value) || value < 0 || value > MAX_NUTRIENT
    )
  ) {
    return 'Nutrients need to be zero or more.';
  }
  if (
    !Number.isFinite(entry.eatenAt) ||
    entry.eatenAt < 0 ||
    entry.eatenAt > Date.now() + 24 * 60 * 60 * 1000
  ) {
    return 'Choose a valid time.';
  }
  return null;
}

export function normalizeDirectEntry(entry: FoodEntry): FoodEntry {
  const error = directEntryError(entry);
  if (error) throw new Error(error);
  return {
    ...entry,
    foodName: entry.foodName.trim(),
    unitLabel: entry.unitLabel.trim(),
    isPackaged: normalizeIsPackaged(entry.isPackaged),
    labels: normalizeFoodLabels(entry.labels),
  };
}

export function foodFromDirectEntry(entry: FoodEntry, id: string): Food {
  const normalized = normalizeDirectEntry(entry);
  return {
    id,
    name: normalized.foodName,
    servingMode: 'per_unit',
    unitLabel: normalized.unitLabel,
    defaultAmount: normalized.amount,
    calories: normalized.calories / normalized.amount,
    carbsG: normalized.carbsG / normalized.amount,
    proteinG: normalized.proteinG / normalized.amount,
    fibreG: normalized.fibreG / normalized.amount,
    favourite: true,
    lastUsedAt: null,
    archivedAt: null,
    isPackaged: normalized.isPackaged,
    labels: normalized.labels,
  };
}

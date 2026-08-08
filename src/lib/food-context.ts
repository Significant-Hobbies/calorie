import type { FoodKind } from './types';

export const FOOD_KIND_LABELS: Record<FoodKind, string> = {
  whole_food: 'Whole food',
  prepared: 'Prepared meal',
  packaged: 'Packaged food',
  supplement: 'Supplement',
};

export function normalizeFoodKind(value: unknown): FoodKind {
  return value === 'whole_food' || value === 'packaged' || value === 'supplement'
    ? value
    : 'prepared';
}

export function normalizeFoodLabels(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  return [...new Set(raw.map((label) => String(label).trim().toLocaleLowerCase()).filter(Boolean))]
    .slice(0, 8)
    .map((label) => label.slice(0, 24));
}

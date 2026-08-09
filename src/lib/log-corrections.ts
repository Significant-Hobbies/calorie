import type { Units, WaterEntry } from './types';

export function waterTotal(entries: WaterEntry[]) {
  return entries.reduce((sum, entry) => sum + entry.amountMl, 0);
}

export function displayWeightValue(weightKg: number, units: Units) {
  return Math.round((units === 'imperial' ? weightKg * 2.20462 : weightKg) * 10) / 10;
}

export function storedWeightValue(value: number, units: Units) {
  if (!Number.isFinite(value)) return null;
  return Math.round((units === 'imperial' ? value / 2.20462 : value) * 10) / 10;
}

export function localDateInputValue(timestamp: number) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

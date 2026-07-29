import { localDateKey } from './calendar';
import type { FoodEntry } from './types';

export function entriesWithinRange(entries: FoodEntry[], startAt: number, endAt: number) {
  return entries
    .filter((entry) => entry.eatenAt >= startAt && entry.eatenAt < endAt)
    .sort((left, right) => left.eatenAt - right.eatenAt);
}

export function entriesForLocalDate(entries: FoodEntry[], date: string) {
  return entries
    .filter((entry) => localDateKey(new Date(entry.eatenAt)) === date)
    .sort((left, right) => left.eatenAt - right.eatenAt);
}

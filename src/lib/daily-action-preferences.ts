import type { DailyActionKey, UserProfile } from './types';

export const DEFAULT_DAILY_ACTION_ORDER: DailyActionKey[] = ['weight', 'creatine', 'food', 'water'];

function isDailyActionKey(value: unknown): value is DailyActionKey {
  return DEFAULT_DAILY_ACTION_ORDER.includes(value as DailyActionKey);
}

export function normalizeDailyActionOrder(value: unknown): DailyActionKey[] {
  const provided = Array.isArray(value) ? value : [];
  const unique = provided.filter(
    (item, index): item is DailyActionKey =>
      isDailyActionKey(item) && provided.indexOf(item) === index
  );
  return [...unique, ...DEFAULT_DAILY_ACTION_ORDER.filter((key) => !unique.includes(key))];
}

export function normalizeDailyActionHidden(value: unknown): DailyActionKey[] {
  const provided = Array.isArray(value) ? value : [];
  return provided.filter(
    (item, index): item is DailyActionKey =>
      isDailyActionKey(item) && provided.indexOf(item) === index
  );
}

export function enabledDailyActions(
  profile: Pick<UserProfile, 'dailyActionOrder' | 'dailyActionHidden'>
): DailyActionKey[] {
  const hidden = new Set(normalizeDailyActionHidden(profile.dailyActionHidden));
  return normalizeDailyActionOrder(profile.dailyActionOrder).filter((key) => !hidden.has(key));
}

export function moveDailyAction(
  value: unknown,
  key: DailyActionKey,
  direction: -1 | 1
): DailyActionKey[] {
  const order = normalizeDailyActionOrder(value);
  const index = order.indexOf(key);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= order.length) return order;
  const next = [...order];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next;
}

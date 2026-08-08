import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DAILY_ACTION_ORDER,
  enabledDailyActions,
  moveDailyAction,
  normalizeDailyActionHidden,
  normalizeDailyActionOrder,
} from './daily-action-preferences';

describe('daily action preferences', () => {
  it('defaults legacy profiles to all actions in the established order', () => {
    expect(normalizeDailyActionOrder(undefined)).toEqual(DEFAULT_DAILY_ACTION_ORDER);
    expect(normalizeDailyActionHidden(undefined)).toEqual([]);
  });

  it('keeps valid custom order while repairing duplicates and unknown keys', () => {
    expect(normalizeDailyActionOrder(['water', 'food', 'water', 'unknown'])).toEqual([
      'water',
      'food',
      'weight',
      'creatine',
    ]);
  });

  it('filters hidden actions without disturbing the saved order', () => {
    expect(
      enabledDailyActions({
        dailyActionOrder: ['water', 'food', 'creatine', 'weight'],
        dailyActionHidden: ['creatine', 'weight'],
      })
    ).toEqual(['water', 'food']);
  });

  it('moves one action by one accessible step', () => {
    expect(moveDailyAction(DEFAULT_DAILY_ACTION_ORDER, 'water', -1)).toEqual([
      'weight',
      'creatine',
      'water',
      'food',
    ]);
    expect(moveDailyAction(DEFAULT_DAILY_ACTION_ORDER, 'weight', -1)).toEqual(
      DEFAULT_DAILY_ACTION_ORDER
    );
  });
});

import { normalizeDailyActionHidden, normalizeDailyActionOrder } from './daily-action-preferences';
import type { UserProfile } from './types';

export function normalizeProfile(profile: UserProfile): UserProfile {
  const legacyTarget = profile.manualCalorieTarget;
  return {
    ...profile,
    manualCalorieRange:
      profile.manualCalorieRange ??
      (legacyTarget ? [Math.max(800, legacyTarget - 100), legacyTarget + 100] : null),
    dailyActionOrder: normalizeDailyActionOrder(profile.dailyActionOrder),
    dailyActionHidden: normalizeDailyActionHidden(profile.dailyActionHidden),
  };
}

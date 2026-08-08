import { describe, expect, it } from 'vitest';
import { normalizeProfile } from './profile';
import type { UserProfile } from './types';

const profile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  userId: 'user-1',
  displayName: 'Sam',
  units: 'metric',
  ageYears: 30,
  genderIdentity: null,
  equationProfile: 'none',
  heightCm: 175,
  activityLevel: 'moderate',
  goal: 'maintain',
  targetWeightKg: null,
  manualCalorieTarget: null,
  manualCalorieRange: null,
  wakeTime: '07:00',
  sleepHours: 8,
  fastingThresholdHours: 12,
  waterTargetMl: 2000,
  dailyActionOrder: ['weight', 'creatine', 'food', 'water'],
  dailyActionHidden: [],
  onboardingComplete: true,
  ...overrides,
});

describe('profile normalization', () => {
  it('preserves every legacy goal value for cycle mapping', () => {
    for (const goal of ['lose_gentle', 'lose_steady', 'maintain', 'gain_gentle'] as const) {
      expect(normalizeProfile(profile({ goal })).goal).toBe(goal);
    }
  });

  it('expands a legacy single calorie target without replacing an explicit range', () => {
    expect(normalizeProfile(profile({ manualCalorieTarget: 2000 })).manualCalorieRange).toEqual([
      1900, 2100,
    ]);
    expect(
      normalizeProfile(profile({ manualCalorieTarget: 2000, manualCalorieRange: [1850, 2050] }))
        .manualCalorieRange
    ).toEqual([1850, 2050]);
  });
});

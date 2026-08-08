import { describe, expect, it } from 'vitest';
import {
  createJournalExport,
  journalExportFileName,
  serializeJournalExport,
} from './journal-export';
import type { UserProfile } from './types';

const profile: UserProfile = {
  userId: 'user',
  displayName: 'Sam',
  units: 'metric',
  ageYears: null,
  genderIdentity: null,
  equationProfile: 'none',
  heightCm: null,
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
};

describe('journal export', () => {
  it('emits the complete stable contract without transport metadata', () => {
    const value = createJournalExport(
      {
        profile,
        foods: [],
        entries: [],
        waterEntries: [],
        medications: [],
        medicationCheckIns: [],
        weights: [],
        cycleSessions: [],
      },
      new Date('2026-08-09T10:00:00.000Z')
    );
    expect(value).toMatchObject({
      schema: 'calorie-journal-backup',
      version: 1,
      generatedAt: '2026-08-09T10:00:00.000Z',
    });
    const serialized = serializeJournalExport(value);
    expect(serialized).not.toContain('token');
    expect(serialized).not.toContain('pendingWrites');
    expect(Object.keys(value)).toEqual([
      'schema',
      'version',
      'generatedAt',
      'profile',
      'foods',
      'entries',
      'waterEntries',
      'medications',
      'medicationCheckIns',
      'weights',
      'cycleSessions',
    ]);
  });

  it('uses a readable date-stamped filename', () => {
    expect(journalExportFileName(new Date('2026-08-09T10:00:00.000Z'))).toBe(
      'calorie-backup-2026-08-09.json'
    );
  });
});

import { describe, expect, it } from 'vitest';
import { activeMedications, upsertMedicationCheckIn } from './medications';
import type { MedicationCheckIn } from './types';

describe('medication tracking', () => {
  it('keeps one check-off per medication and local date', () => {
    const original: MedicationCheckIn = {
      id: 'old',
      medicationId: 'vitamin-d',
      takenOn: '2026-07-27',
      takenAt: 100,
    };
    const replacement: MedicationCheckIn = {
      ...original,
      id: 'new',
      takenAt: 200,
    };
    expect(upsertMedicationCheckIn([original], replacement)).toEqual([replacement]);
  });

  it('keeps prior days independent and archives without deleting check-off history', () => {
    const prior: MedicationCheckIn = {
      id: 'prior',
      medicationId: 'vitamin-d',
      takenOn: '2026-07-26',
      takenAt: 100,
    };
    const today: MedicationCheckIn = {
      ...prior,
      id: 'today',
      takenOn: '2026-07-27',
      takenAt: 200,
    };
    expect(upsertMedicationCheckIn([prior], today)).toEqual([today, prior]);
    expect(
      activeMedications([
        {
          id: 'vitamin-d',
          name: 'Vitamin D',
          schedule: 'morning',
          createdAt: 50,
          archivedAt: 300,
        },
      ])
    ).toEqual([]);
  });
});

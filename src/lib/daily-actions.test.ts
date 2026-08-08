import { describe, expect, it } from 'vitest';
import { getDailyActionState, isCreatineRoutine } from './daily-actions';
import type { Medication } from './types';

const medication = (name: string): Medication => ({
  id: name,
  name,
  schedule: 'either',
  createdAt: 1,
  archivedAt: null,
});

const empty = {
  date: '2026-08-09',
  timezone: 'Asia/Kolkata',
  entries: [],
  waterEntries: [],
  medications: [],
  medicationCheckIns: [],
  latestWeight: null,
};

describe('daily action state', () => {
  it('starts with all four actions incomplete', () => {
    expect(getDailyActionState(empty).completed).toEqual({
      weight: false,
      creatine: false,
      food: false,
      water: false,
    });
  });

  it('matches creatine routines with common suffixes but not unrelated names', () => {
    expect(isCreatineRoutine(medication(' Creatine '))).toBe(true);
    expect(isCreatineRoutine(medication('Creatine monohydrate'))).toBe(true);
    expect(isCreatineRoutine(medication('Vitamin D'))).toBe(false);
  });

  it('uses the dashboard timezone for weight completion', () => {
    const instant = Date.UTC(2026, 7, 8, 20, 0);
    expect(
      getDailyActionState({
        ...empty,
        latestWeight: { id: 'weight', weightKg: 70, recordedAt: instant },
      }).completed.weight
    ).toBe(true);
    expect(
      getDailyActionState({
        ...empty,
        timezone: 'America/Los_Angeles',
        latestWeight: { id: 'weight', weightKg: 70, recordedAt: instant },
      }).completed.weight
    ).toBe(false);
  });

  it('completes creatine only after today’s matching check-in', () => {
    const creatine = medication('Creatine monohydrate');
    const result = getDailyActionState({
      ...empty,
      medications: [creatine],
      medicationCheckIns: [
        { id: 'check', medicationId: creatine.id, takenOn: empty.date, takenAt: 10 },
      ],
    });
    expect(result.creatineRoutine).toEqual(creatine);
    expect(result.completed.creatine).toBe(true);
  });
});

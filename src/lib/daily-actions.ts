import type {
  DailyActionKey,
  FoodEntry,
  Medication,
  MedicationCheckIn,
  WaterEntry,
  WeightEntry,
} from './types';

export type { DailyActionKey } from './types';

type Input = {
  date: string;
  timezone: string;
  entries: FoodEntry[];
  waterEntries: WaterEntry[];
  medications: Medication[];
  medicationCheckIns: MedicationCheckIn[];
  latestWeight: WeightEntry | null;
};

function dateKey(timestamp: number, timezone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(timestamp);
}

export function isCreatineRoutine(medication: Medication): boolean {
  return /^creatine(?:\s|$)/i.test(medication.name.trim());
}

export function getDailyActionState(input: Input) {
  const creatineRoutine = input.medications.find(isCreatineRoutine) ?? null;
  const creatineComplete = Boolean(
    creatineRoutine &&
      input.medicationCheckIns.some((checkIn) => checkIn.medicationId === creatineRoutine.id)
  );

  return {
    creatineRoutine,
    completed: {
      weight: Boolean(
        input.latestWeight && dateKey(input.latestWeight.recordedAt, input.timezone) === input.date
      ),
      creatine: creatineComplete,
      food: input.entries.length > 0,
      water: input.waterEntries.length > 0,
    } satisfies Record<DailyActionKey, boolean>,
  };
}

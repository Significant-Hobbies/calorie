import type { Medication, MedicationCheckIn } from './types';

export function activeMedications(medications: Medication[]) {
  return medications
    .filter((medication) => medication.archivedAt === null)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function upsertMedicationCheckIn(checkIns: MedicationCheckIn[], input: MedicationCheckIn) {
  return [
    input,
    ...checkIns.filter(
      (checkIn) =>
        checkIn.id !== input.id &&
        (checkIn.medicationId !== input.medicationId || checkIn.takenOn !== input.takenOn)
    ),
  ];
}

import type { JournalExport } from './types';

export type JournalExportData = Omit<JournalExport, 'schema' | 'version' | 'generatedAt'>;

export function createJournalExport(
  data: JournalExportData,
  generatedAt = new Date()
): JournalExport {
  return {
    schema: 'calorie-journal-backup',
    version: 2,
    generatedAt: generatedAt.toISOString(),
    profile: { ...data.profile },
    foods: data.foods.map((item) => ({ ...item })),
    entries: data.entries.map((item) => ({ ...item })),
    waterEntries: data.waterEntries.map((item) => ({ ...item })),
    medications: data.medications.map((item) => ({ ...item })),
    medicationCheckIns: data.medicationCheckIns.map((item) => ({ ...item })),
    weights: data.weights.map((item) => ({ ...item })),
    cycleSessions: data.cycleSessions.map((item) => ({ ...item })),
  };
}

export function serializeJournalExport(value: JournalExport) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function journalExportFileName(generatedAt = new Date()) {
  return `calorie-backup-${generatedAt.toISOString().slice(0, 10)}.json`;
}

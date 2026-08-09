import { localDateKey } from './calendar';
import { entriesForLocalDate } from './history';
import type { FoodEntry, HistoryResponse, MedicationHistoryEvent, WeightEntry } from './types';

export type WeeklyJournalFilter = 'all' | 'food' | 'weight' | 'medicine';

export type WeeklyJournalEvent =
  | { type: 'food'; id: string; at: number; entry: FoodEntry }
  | { type: 'weight'; id: string; at: number; weight: WeightEntry }
  | { type: 'medicine'; id: string; at: number; medication: MedicationHistoryEvent };

export function weeklyEventsForDate(
  history: HistoryResponse,
  date: string,
  filter: WeeklyJournalFilter = 'all'
): WeeklyJournalEvent[] {
  const events: WeeklyJournalEvent[] = [];

  if (filter === 'all' || filter === 'food') {
    events.push(
      ...entriesForLocalDate(history.entries ?? [], date).map(
        (entry): WeeklyJournalEvent => ({ type: 'food', id: entry.id, at: entry.eatenAt, entry })
      )
    );
  }
  if (filter === 'all' || filter === 'weight') {
    events.push(
      ...history.weights
        .filter((weight) => localDateKey(new Date(weight.recordedAt)) === date)
        .map(
          (weight): WeeklyJournalEvent => ({
            type: 'weight',
            id: weight.id,
            at: weight.recordedAt,
            weight,
          })
        )
    );
  }
  if (filter === 'all' || filter === 'medicine') {
    events.push(
      ...(history.medicationEvents ?? [])
        .filter((medication) => localDateKey(new Date(medication.takenAt)) === date)
        .map(
          (medication): WeeklyJournalEvent => ({
            type: 'medicine',
            id: medication.id,
            at: medication.takenAt,
            medication,
          })
        )
    );
  }

  return events.sort((left, right) => left.at - right.at || left.id.localeCompare(right.id));
}

export function journalEventCount(count: number) {
  return `${count} ${count === 1 ? 'event' : 'events'}`;
}

import { waterTotal } from '../../lib/log-corrections';
import type { Dashboard, FoodEntry, WaterEntry } from '../../lib/types';

export function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(timestamp);
}

export function formatDuration(hours: number) {
  const totalMinutes = Math.round(hours * 60);
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!wholeHours) return `${minutes}m`;
  return minutes ? `${wholeHours}h ${minutes}m` : `${wholeHours}h`;
}

export function greeting() {
  const hour = new Date().getHours();
  if (hour < 5) {
    return {
      title: 'Rest well',
      subtitle: 'It’s late—your journal will still be here after sleep.',
    };
  }
  if (hour < 12) return { title: 'Good morning', subtitle: 'Here’s your day at a glance.' };
  if (hour < 18) return { title: 'Good afternoon', subtitle: 'Here’s your day at a glance.' };
  return { title: 'Good evening', subtitle: 'Here’s your day at a glance.' };
}

export function withEntries(
  dashboard: Dashboard,
  entries: FoodEntry[],
  waterEntries: WaterEntry[]
): Dashboard {
  const nutrients = entries.reduce(
    (total, entry) => ({
      calories: total.calories + entry.calories,
      carbsG: total.carbsG + entry.carbsG,
      proteinG: total.proteinG + entry.proteinG,
      fibreG: total.fibreG + entry.fibreG,
    }),
    { calories: 0, carbsG: 0, proteinG: 0, fibreG: 0 }
  );
  return {
    ...dashboard,
    entries: [...entries].sort((a, b) => b.eatenAt - a.eatenAt),
    waterEntries: [...waterEntries].sort((a, b) => b.drankAt - a.drankAt),
    totals: {
      ...nutrients,
      waterMl: waterTotal(waterEntries),
    },
  };
}

export type UndoAction =
  | { kind: 'food'; id: string; label: string }
  | { kind: 'water'; id: string; label: string }
  | { kind: 'delete-water'; entry: WaterEntry; label: string }
  | { kind: 'delete-entry'; entry: FoodEntry; label: string };

export type EntryDraft = {
  entryId: string | null;
  mode: 'saved' | 'direct';
  foodId: string | null;
  foodName: string;
  amount: number;
  unitLabel: string;
  calories: number;
  carbsG: number;
  proteinG: number;
  fibreG: number;
  eatenAt: string;
  saveForLater: boolean;
  isPackaged: boolean;
  labels: string[];
};

export function toLocalInput(timestamp: number) {
  const date = new Date(timestamp);
  const local = new Date(timestamp - date.getTimezoneOffset() * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

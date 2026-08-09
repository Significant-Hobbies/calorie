import { Pill, Scale, Utensils } from 'lucide-react';
import { dateFromKey, localDateKey, weekDateKeys } from '../lib/calendar';
import {
  journalEventCount,
  weeklyEventsForDate,
  type WeeklyJournalFilter,
} from '../lib/weekly-journal';
import type { HistoryDay, HistoryResponse } from '../lib/types';
import { NutrientDensityBadge } from './NutrientDensityBadge';

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
    timestamp
  );
}

function displayWeight(weightKg: number, units: 'metric' | 'imperial') {
  return units === 'metric' ? `${weightKg.toFixed(1)} kg` : `${(weightKg * 2.20462).toFixed(1)} lb`;
}

function shortDate(date: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(dateFromKey(date));
}

function emptyDay(date: string): HistoryDay {
  return { date, calories: 0, carbsG: 0, proteinG: 0, fibreG: 0, waterMl: 0, fastCount: 0 };
}

export function HistoryWeek({
  weekStart,
  history,
  filter,
  units,
}: {
  weekStart: Date;
  history: HistoryResponse;
  filter: WeeklyJournalFilter;
  units: 'metric' | 'imperial';
}) {
  const todayKey = localDateKey(new Date());
  const byDate = new Map(history.days.map((day) => [day.date, day]));

  return (
    <div className="weekly-journal" aria-label="Weekly journal entries">
      {weekDateKeys(weekStart).map((date) => {
        const day = byDate.get(date) ?? emptyDay(date);
        const events = weeklyEventsForDate(history, date, filter);
        const isFuture = date > todayKey;
        const titleId = `weekly-day-${date}`;
        return (
          <section
            className={[
              'weekly-day',
              date === todayKey ? 'is-today' : '',
              isFuture ? 'is-future' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-labelledby={titleId}
            key={date}
          >
            <header>
              <div>
                <h3 id={titleId}>{shortDate(date)}</h3>
                <span>{isFuture ? 'Upcoming' : journalEventCount(events.length)}</span>
              </div>
              <strong>{day.calories > 0 ? `${Math.round(day.calories)} kcal` : '—'}</strong>
            </header>

            {isFuture ? (
              <p className="weekly-day-empty">This day has not arrived yet.</p>
            ) : events.length ? (
              <ol className="weekly-event-list">
                {events.map((event) => (
                  <li
                    className={`weekly-event weekly-event-${event.type}`}
                    key={`${event.type}-${event.id}`}
                  >
                    <time dateTime={new Date(event.at).toISOString()}>{formatTime(event.at)}</time>
                    <span className="weekly-event-icon" aria-hidden="true">
                      {event.type === 'food' ? (
                        <Utensils />
                      ) : event.type === 'weight' ? (
                        <Scale />
                      ) : (
                        <Pill />
                      )}
                    </span>
                    <div>
                      {event.type === 'food' ? (
                        <>
                          <strong>{event.entry.foodName}</strong>
                          <span>{Math.round(event.entry.calories)} kcal</span>
                          <NutrientDensityBadge nutrients={event.entry} />
                        </>
                      ) : event.type === 'weight' ? (
                        <>
                          <strong>Weight check-in</strong>
                          <span>{displayWeight(event.weight.weightKg, units)}</span>
                        </>
                      ) : (
                        <>
                          <strong>{event.medication.medicationName}</strong>
                          <span>Medicine taken</span>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="weekly-day-empty">
                {filter === 'all' ? 'Nothing logged.' : `No ${filter} entries.`}
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}

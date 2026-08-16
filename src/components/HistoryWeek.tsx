import { Pill, Scale, Utensils, X } from 'lucide-react';
import { type CSSProperties, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { dateFromKey, localDateKey, weekDateKeys } from '../lib/calendar';
import {
  calendarHourLabels,
  format24HourTime,
  initialCalendarHour,
  layoutWeeklyEvents,
  minuteOfLocalDay,
  WEEK_CALENDAR_DAY_HEIGHT,
  WEEK_CALENDAR_HOUR_HEIGHT,
} from '../lib/week-calendar-layout';
import {
  journalEventCount,
  weeklyEventsForDate,
  type WeeklyJournalEvent,
  type WeeklyJournalFilter,
} from '../lib/weekly-journal';
import { calculateEntryTrackedQuality } from '../lib/nutrient-density';
import type { Food, HistoryDay, HistoryResponse } from '../lib/types';
import { EntryTrackedQualityBadge } from './EntryTrackedQualityBadge';

const HOUR_LABELS = calendarHourLabels();
const DAY_FORMATTER = new Intl.DateTimeFormat(undefined, { day: 'numeric' });
const MONTH_FORMATTER = new Intl.DateTimeFormat(undefined, { month: 'short' });
const WEEKDAY_FORMATTER = new Intl.DateTimeFormat(undefined, { weekday: 'short' });

function displayWeight(weightKg: number, units: 'metric' | 'imperial') {
  return units === 'metric' ? `${weightKg.toFixed(1)} kg` : `${(weightKg * 2.20462).toFixed(1)} lb`;
}

function dayParts(date: string) {
  const value = dateFromKey(date);
  return {
    day: DAY_FORMATTER.format(value),
    month: MONTH_FORMATTER.format(value),
    weekday: WEEKDAY_FORMATTER.format(value),
  };
}

function emptyDay(date: string): HistoryDay {
  return { date, calories: 0, carbsG: 0, proteinG: 0, fibreG: 0, waterMl: 0, fastCount: 0 };
}

function eventLabel(event: WeeklyJournalEvent, units: 'metric' | 'imperial', foods: Food[]) {
  const time = format24HourTime(event.at);
  if (event.type === 'food') {
    const tracked = calculateEntryTrackedQuality(event.entry, foods);
    const score =
      tracked.quality.score === null
        ? 'tracked score unavailable'
        : `${tracked.quality.score} of 100 tracked`;
    return `${time}, ${event.entry.foodName}, ${Math.round(event.entry.calories)} calories, ${score}, ${tracked.basisLabel}`;
  }
  if (event.type === 'weight') {
    return `${time}, weight check-in, ${displayWeight(event.weight.weightKg, units)}`;
  }
  return `${time}, ${event.medication.medicationName}, medicine taken`;
}

function EventIcon({ type }: { type: WeeklyJournalEvent['type'] }) {
  if (type === 'food') return <Utensils aria-hidden="true" />;
  if (type === 'weight') return <Scale aria-hidden="true" />;
  return <Pill aria-hidden="true" />;
}

function eventKey(event: WeeklyJournalEvent) {
  return `${event.type}-${event.id}`;
}

export function HistoryWeek({
  weekStart,
  history,
  foods,
  filter,
  units,
}: {
  weekStart: Date;
  history: HistoryResponse;
  foods: Food[];
  filter: WeeklyJournalFilter;
  units: 'metric' | 'imperial';
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const eventButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const [selectedEvent, setSelectedEvent] = useState<WeeklyJournalEvent | null>(null);
  const [now, setNow] = useState(() => new Date());
  const todayKey = localDateKey(new Date());
  const dates = weekDateKeys(weekStart);
  const byDate = new Map(history.days.map((day) => [day.date, day]));
  const dayEvents = useMemo(
    () => dates.map((date) => weeklyEventsForDate(history, date, filter)),
    [dates.join(','), filter, history]
  );
  const visibleEvents = dayEvents.flat();
  const startingHour = initialCalendarHour(visibleEvents);
  const nowTop = (minuteOfLocalDay(now.getTime()) / 60) * WEEK_CALENDAR_HOUR_HEIGHT;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useLayoutEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = Math.max(0, startingHour * WEEK_CALENDAR_HOUR_HEIGHT - 12);
    setSelectedEvent(null);
  }, [filter, startingHour, weekStart]);

  const closeEventDetail = () => {
    if (!selectedEvent) return;
    const key = eventKey(selectedEvent);
    setSelectedEvent(null);
    requestAnimationFrame(() => eventButtonRefs.current.get(key)?.focus());
  };

  return (
    <section className="weekly-calendar" aria-label="Weekly journal time grid">
      <div
        className="weekly-calendar-scroll"
        ref={scrollRef}
        role="region"
        aria-label="24-hour weekly calendar; scroll horizontally between days and vertically through times"
        {...{ tabIndex: 0 }}
      >
        <div
          className="weekly-calendar-grid"
          style={{ '--week-day-height': `${WEEK_CALENDAR_DAY_HEIGHT}px` } as CSSProperties}
        >
          <div className="weekly-calendar-corner" aria-hidden="true">
            <span>Local time</span>
            <strong>24 hours</strong>
          </div>

          {dates.map((date, index) => {
            const parts = dayParts(date);
            const day = byDate.get(date) ?? emptyDay(date);
            const isFuture = date > todayKey;
            return (
              <header
                className={`weekly-calendar-day-header ${date === todayKey ? 'is-today' : ''}`}
                id={`weekly-day-${date}`}
                key={date}
              >
                <div>
                  <span>{parts.weekday}</span>
                  <strong>{parts.day}</strong>
                  <small>{parts.month}</small>
                </div>
                <p>
                  {isFuture
                    ? 'Upcoming'
                    : `${journalEventCount(dayEvents[index].length)} · ${
                        day.calories > 0 ? `${Math.round(day.calories)} kcal` : 'no food'
                      }`}
                </p>
              </header>
            );
          })}

          <div className="weekly-calendar-time-axis" aria-hidden="true">
            {HOUR_LABELS.map((label, hour) => (
              <span
                className={hour === 0 ? 'is-start' : hour === 24 ? 'is-end' : ''}
                key={label}
                style={{ top: hour * WEEK_CALENDAR_HOUR_HEIGHT }}
              >
                {label}
              </span>
            ))}
          </div>

          {dates.map((date, index) => {
            const events = dayEvents[index];
            const positionedEvents = layoutWeeklyEvents(events);
            const isFuture = date > todayKey;
            return (
              <section
                className={`weekly-calendar-day ${date === todayKey ? 'is-today' : ''} ${
                  isFuture ? 'is-future' : ''
                }`}
                aria-labelledby={`weekly-day-${date}`}
                key={date}
              >
                <div className="weekly-calendar-hour-lines" aria-hidden="true">
                  {HOUR_LABELS.map((label, hour) => (
                    <span key={label} style={{ top: hour * WEEK_CALENDAR_HOUR_HEIGHT }} />
                  ))}
                </div>

                {!isFuture && !events.length ? (
                  <span className="weekly-calendar-empty">
                    {filter === 'all' ? 'Nothing logged' : `No ${filter} entries`}
                  </span>
                ) : null}

                {date === todayKey ? (
                  <time
                    className="weekly-calendar-now"
                    dateTime={now.toISOString()}
                    aria-label={`Current time ${format24HourTime(now.getTime())}`}
                    style={{ top: nowTop }}
                  >
                    <span />
                  </time>
                ) : null}

                <ol className="weekly-calendar-events">
                  {positionedEvents.map(({ event, height, lane, laneCount, top }) => (
                    <li
                      className={`weekly-calendar-event weekly-calendar-event-${event.type} ${
                        laneCount > 1 ? 'is-compact' : ''
                      }`}
                      key={`${event.type}-${event.id}`}
                      style={
                        {
                          '--event-lane': lane,
                          '--event-lanes': laneCount,
                          height,
                          top,
                        } as CSSProperties
                      }
                    >
                      <button
                        className="weekly-calendar-event-button"
                        type="button"
                        ref={(node) => {
                          const key = eventKey(event);
                          if (node) eventButtonRefs.current.set(key, node);
                          else eventButtonRefs.current.delete(key);
                        }}
                        aria-controls="weekly-calendar-event-detail"
                        aria-expanded={
                          selectedEvent?.type === event.type && selectedEvent.id === event.id
                        }
                        aria-label={`${eventLabel(event, units, foods)}; show details`}
                        title={eventLabel(event, units, foods)}
                        onClick={() => setSelectedEvent(event)}
                      >
                        <div className="weekly-calendar-event-heading">
                          <EventIcon type={event.type} />
                          <time dateTime={new Date(event.at).toISOString()}>
                            {format24HourTime(event.at)}
                          </time>
                        </div>
                        {event.type === 'food' ? (
                          <>
                            <strong>{event.entry.foodName}</strong>
                            <span>{Math.round(event.entry.calories)} kcal</span>
                            <EntryTrackedQualityBadge entry={event.entry} foods={foods} />
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
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
            );
          })}
        </div>
      </div>
      {selectedEvent ? (
        <aside
          className={`weekly-calendar-event-detail weekly-calendar-event-detail-${selectedEvent.type}`}
          id="weekly-calendar-event-detail"
          aria-live="polite"
        >
          <span className="weekly-calendar-event-detail-icon">
            <EventIcon type={selectedEvent.type} />
          </span>
          <div>
            <time dateTime={new Date(selectedEvent.at).toISOString()}>
              {format24HourTime(selectedEvent.at)}
            </time>
            {selectedEvent.type === 'food' ? (
              <>
                <strong>{selectedEvent.entry.foodName}</strong>
                <p>
                  {selectedEvent.entry.amount.toLocaleString(undefined, {
                    maximumFractionDigits: 1,
                  })}{' '}
                  {selectedEvent.entry.unitLabel} · {Math.round(selectedEvent.entry.calories)} kcal
                  · {Math.round(selectedEvent.entry.carbsG)}g carbs ·{' '}
                  {Math.round(selectedEvent.entry.proteinG)}g protein ·{' '}
                  {Math.round(selectedEvent.entry.fibreG)}g fibre
                </p>
                <EntryTrackedQualityBadge entry={selectedEvent.entry} foods={foods} showBasis />
              </>
            ) : selectedEvent.type === 'weight' ? (
              <>
                <strong>Weight check-in</strong>
                <p>{displayWeight(selectedEvent.weight.weightKg, units)}</p>
              </>
            ) : (
              <>
                <strong>{selectedEvent.medication.medicationName}</strong>
                <p>Medicine taken</p>
              </>
            )}
          </div>
          <button type="button" aria-label="Close event details" onClick={closeEventDetail}>
            <X aria-hidden="true" />
          </button>
        </aside>
      ) : null}
    </section>
  );
}

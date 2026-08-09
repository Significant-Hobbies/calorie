import {
  Activity,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Droplets,
  Scale,
  Sprout,
  Utensils,
} from 'lucide-react';
import { memo, type KeyboardEvent } from 'react';
import { dateFromKey, isSameMonth, isSameWeek, localDateKey, weekDateKeys } from '../lib/calendar';
import { entriesForLocalDate } from '../lib/history';
import type { WeeklyJournalFilter } from '../lib/weekly-journal';
import type { HistoryDay, HistoryResponse, NutritionTarget, WeightEntry } from '../lib/types';
import { HistoryWeek } from './HistoryWeek';
import { NutrientDensityBadge } from './NutrientDensityBadge';

export type HistoryCalendarMode = 'week' | 'month';

type HistoryCalendarProps = {
  mode: HistoryCalendarMode;
  month: Date;
  weekStart: Date;
  filter: WeeklyJournalFilter;
  history: HistoryResponse;
  selectedDate: string;
  target: NutritionTarget;
  units: 'metric' | 'imperial';
  onModeChange: (mode: HistoryCalendarMode) => void;
  onFilterChange: (filter: WeeklyJournalFilter) => void;
  onPrevious: () => void;
  onNext: () => void;
  onSelectDate: (date: string) => void;
  onToday: () => void;
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function hasDayData(day: HistoryDay, weights: WeightEntry[], hasFoodEntry = false) {
  return (
    hasFoodEntry ||
    day.calories > 0 ||
    day.waterMl > 0 ||
    day.fastCount > 0 ||
    weights.some((entry) => localDateKey(new Date(entry.recordedAt)) === day.date)
  );
}

function cellCalories(calories: number) {
  if (calories < 1000) return String(Math.round(calories));
  return `${(calories / 1000).toFixed(1)}k`;
}

function displayWeight(weightKg: number, units: 'metric' | 'imperial') {
  return units === 'metric' ? `${weightKg.toFixed(1)} kg` : `${(weightKg * 2.20462).toFixed(1)} lb`;
}

function fullDate(date: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(dateFromKey(date));
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(timestamp);
}

function formatAmount(amount: number, unitLabel: string) {
  return `${amount.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${unitLabel}`;
}

function weekLabel(weekStart: Date) {
  const dates = weekDateKeys(weekStart);
  const start = dateFromKey(dates[0]);
  const end = dateFromKey(dates[6]);
  const startLabel = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(start);
  if (start.getFullYear() !== end.getFullYear()) {
    return `${startLabel}, ${start.getFullYear()}–${new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(end)}`;
  }
  if (start.getMonth() === end.getMonth()) {
    return `${startLabel}–${end.getDate()}, ${end.getFullYear()}`;
  }
  return `${startLabel}–${new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(end)}, ${end.getFullYear()}`;
}

function cellLabel(day: HistoryDay, weights: WeightEntry[], hasFoodEntry: boolean) {
  const parts = [fullDate(day.date)];
  if (day.calories > 0) parts.push(`${Math.round(day.calories)} calories`);
  else if (hasFoodEntry) parts.push('food logged');
  if (day.waterMl > 0) parts.push(`${day.waterMl} millilitres water`);
  if (day.fastCount > 0) parts.push(`${day.fastCount} completed fast`);
  if (weights.some((entry) => localDateKey(new Date(entry.recordedAt)) === day.date)) {
    parts.push('weight logged');
  }
  if (parts.length === 1) parts.push('no log');
  return parts.join(', ');
}

export const HistoryCalendar = memo(function HistoryCalendar({
  mode,
  month,
  weekStart,
  filter,
  history,
  selectedDate,
  target,
  units,
  onModeChange,
  onFilterChange,
  onPrevious,
  onNext,
  onSelectDate,
  onToday,
}: HistoryCalendarProps) {
  const today = new Date();
  const todayKey = localDateKey(today);
  const byDate = new Map(history.days.map((day) => [day.date, day]));
  const entryDates = new Set(
    (history.entries ?? []).map((entry) => localDateKey(new Date(entry.eatenAt)))
  );
  const selectedDay = byDate.get(selectedDate);
  const selectedWeights = history.weights.filter(
    (entry) => localDateKey(new Date(entry.recordedAt)) === selectedDate
  );
  const selectedEntries = entriesForLocalDate(history.entries ?? [], selectedDate);
  const selectedHasData = selectedDay
    ? hasDayData(selectedDay, history.weights, selectedEntries.length > 0)
    : false;
  const canMoveNext = mode === 'week' ? !isSameWeek(weekStart, today) : !isSameMonth(month, today);
  const canReturnToday = canMoveNext;
  const monthLabel = new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  }).format(month);
  const calendarStart = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  const mondayOffset = (calendarStart.getDay() + 6) % 7;
  calendarStart.setDate(calendarStart.getDate() - mondayOffset);

  const moveCalendarFocus = (event: KeyboardEvent<HTMLButtonElement>, dateKey: string) => {
    const date = dateFromKey(dateKey);
    const mondayIndex = (date.getDay() + 6) % 7;
    const dayDelta =
      event.key === 'ArrowLeft'
        ? -1
        : event.key === 'ArrowRight'
          ? 1
          : event.key === 'ArrowUp'
            ? -7
            : event.key === 'ArrowDown'
              ? 7
              : event.key === 'Home'
                ? -mondayIndex
                : event.key === 'End'
                  ? 6 - mondayIndex
                  : null;
    if (dayDelta === null) return;
    event.preventDefault();
    date.setDate(date.getDate() + dayDelta);
    const nextKey = localDateKey(date);
    if (!isSameMonth(date, month) || nextKey > todayKey) return;
    onSelectDate(nextKey);
    requestAnimationFrame(() => document.getElementById(`calendar-date-${nextKey}`)?.focus());
  };

  const renderMonthCell = (index: number) => {
    const date = new Date(calendarStart);
    date.setDate(date.getDate() + index);
    const dateKey = localDateKey(date);
    const inMonth =
      date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear();
    const isFuture = dateKey > todayKey;
    const day =
      byDate.get(dateKey) ??
      ({
        date: dateKey,
        calories: 0,
        carbsG: 0,
        proteinG: 0,
        fibreG: 0,
        waterMl: 0,
        fastCount: 0,
      } satisfies HistoryDay);
    const dayWeights = history.weights.filter(
      (entry) => localDateKey(new Date(entry.recordedAt)) === dateKey
    );
    const hasFoodEntry = entryDates.has(dateKey);
    const hasData = hasDayData(day, dayWeights, hasFoodEntry);

    if (!inMonth) {
      return (
        <span
          className="calendar-day is-outside"
          role="gridcell"
          aria-disabled="true"
          tabIndex={-1}
          key={dateKey}
        >
          <span>{date.getDate()}</span>
        </span>
      );
    }

    return (
      <button
        className={[
          'calendar-day',
          dateKey === todayKey ? 'is-today' : '',
          dateKey === selectedDate ? 'is-selected' : '',
          hasData ? 'has-data' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        type="button"
        role="gridcell"
        id={`calendar-date-${dateKey}`}
        key={dateKey}
        disabled={isFuture}
        tabIndex={dateKey === selectedDate ? 0 : -1}
        aria-selected={dateKey === selectedDate}
        aria-label={cellLabel(day, dayWeights, hasFoodEntry)}
        onClick={() => onSelectDate(dateKey)}
        onKeyDown={(event) => moveCalendarFocus(event, dateKey)}
      >
        <span className="calendar-day-number">{date.getDate()}</span>
        {day.calories > 0 ? (
          <strong>
            {cellCalories(day.calories)}
            <span className="sr-only"> calories</span>
          </strong>
        ) : (
          <strong aria-hidden="true">—</strong>
        )}
        <span className="calendar-signals" aria-hidden="true">
          {day.waterMl > 0 ? <i className="is-water" /> : null}
          {day.fastCount > 0 ? <i className="is-fast" /> : null}
          {dayWeights.length > 0 ? <i className="is-weight" /> : null}
        </span>
      </button>
    );
  };

  return (
    <section className="calendar-card" aria-labelledby="history-calendar-title">
      <header className="calendar-header">
        <div>
          <p>Your journal</p>
          <h2 id="history-calendar-title">{mode === 'week' ? weekLabel(weekStart) : monthLabel}</h2>
        </div>
        <div className="calendar-header-actions">
          <fieldset className="calendar-mode-toggle">
            <legend className="sr-only">Calendar layout</legend>
            {(['week', 'month'] as const).map((option) => (
              <button
                key={option}
                type="button"
                className={mode === option ? 'is-selected' : ''}
                aria-pressed={mode === option}
                onClick={() => onModeChange(option)}
              >
                {option === 'week' ? 'Week' : 'Month'}
              </button>
            ))}
          </fieldset>
          <nav className="calendar-nav" aria-label={`Browse by ${mode}`}>
            <button
              className="calendar-nav-period"
              type="button"
              onClick={onPrevious}
              aria-label={`Previous ${mode}`}
            >
              <ChevronLeft aria-hidden="true" />
              <span>Previous</span>
            </button>
            <button
              className="calendar-nav-today"
              type="button"
              onClick={onToday}
              disabled={!canReturnToday}
              aria-label={`Return to current ${mode}`}
            >
              <CalendarDays aria-hidden="true" />
              <span>Today</span>
            </button>
            <button
              className="calendar-nav-period"
              type="button"
              onClick={onNext}
              aria-label={`Next ${mode}`}
              disabled={!canMoveNext}
            >
              <span>Next</span>
              <ChevronRight aria-hidden="true" />
            </button>
          </nav>
        </div>
      </header>

      {mode === 'week' ? (
        <>
          <div className="calendar-filter-row">
            <fieldset className="calendar-filter">
              <legend className="sr-only">Journal entry type</legend>
              {(['all', 'food', 'weight', 'medicine'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={filter === option ? 'is-selected' : ''}
                  aria-pressed={filter === option}
                  onClick={() => onFilterChange(option)}
                >
                  {option[0].toUpperCase() + option.slice(1)}
                </button>
              ))}
            </fieldset>
            <p className="calendar-density-note">
              Food labels compare tracked protein and fibre per 100 kcal—not overall food quality.
            </p>
          </div>
          <HistoryWeek weekStart={weekStart} history={history} filter={filter} units={units} />
        </>
      ) : (
        <>
          <div className="calendar-weekdays" aria-hidden="true">
            {WEEKDAYS.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="calendar-grid" role="grid" aria-label={`${monthLabel} journal`}>
            {Array.from({ length: 6 }, (_, weekIndex) => (
              // The row is structural; its gridcell buttons own the roving keyboard focus.
              // biome-ignore lint/a11y/useFocusableInteractive: ARIA grid rows should not be tab stops.
              <div className="calendar-row" role="row" key={`week-${weekIndex + 1}`}>
                {Array.from({ length: 7 }, (_, dayIndex) =>
                  renderMonthCell(weekIndex * 7 + dayIndex)
                )}
              </div>
            ))}
          </div>

          <div className="calendar-legend" aria-hidden="true">
            <span>
              <i className="is-water" /> Water
            </span>
            <span>
              <i className="is-fast" /> Fast
            </span>
            <span>
              <i className="is-weight" /> Weight
            </span>
          </div>

          <article className="calendar-detail">
            <header>
              <div>
                <p>{selectedDate === todayKey ? 'Today' : 'Day detail'}</p>
                <h3>{fullDate(selectedDate)}</h3>
              </div>
              <div className="calendar-detail-status">
                <span className={selectedHasData ? 'day-status has-data' : 'day-status'}>
                  {selectedHasData ? 'Logged' : 'No log'}
                </span>
              </div>
            </header>
            <p className="sr-only" role="status">
              Showing {fullDate(selectedDate)}. {selectedHasData ? 'Log available.' : 'No log.'}
            </p>

            {selectedDay && selectedHasData ? (
              <>
                <div className="calendar-detail-grid">
                  <div>
                    <Utensils aria-hidden="true" />
                    <span>Calories</span>
                    <strong>{Math.round(selectedDay.calories).toLocaleString()} kcal</strong>
                  </div>
                  <div>
                    <Activity aria-hidden="true" />
                    <span>Carbs</span>
                    <strong>{Math.round(selectedDay.carbsG)} g</strong>
                  </div>
                  <div>
                    <Sprout aria-hidden="true" />
                    <span>Protein</span>
                    <strong>{Math.round(selectedDay.proteinG)} g</strong>
                  </div>
                  <div>
                    <Sprout aria-hidden="true" />
                    <span>Fibre</span>
                    <strong>{Math.round(selectedDay.fibreG)} g</strong>
                  </div>
                  <div>
                    <Droplets aria-hidden="true" />
                    <span>Water</span>
                    <strong>{(selectedDay.waterMl / 1000).toFixed(1)} L</strong>
                  </div>
                  <div>
                    <Activity aria-hidden="true" />
                    <span>Fasting windows</span>
                    <strong>{selectedDay.fastCount}</strong>
                  </div>
                </div>
                <section
                  className="calendar-foods"
                  aria-labelledby={`calendar-foods-${selectedDate}`}
                >
                  <header>
                    <h4 id={`calendar-foods-${selectedDate}`}>Food entries</h4>
                    <span>
                      {selectedEntries.length} {selectedEntries.length === 1 ? 'entry' : 'entries'}
                    </span>
                  </header>
                  {selectedEntries.length > 0 ? (
                    <ol className="calendar-food-list">
                      {selectedEntries.map((entry) => (
                        <li className="calendar-food-row" key={entry.id}>
                          <time dateTime={new Date(entry.eatenAt).toISOString()}>
                            {formatTime(entry.eatenAt)}
                          </time>
                          <span className="calendar-food-dot" aria-hidden="true" />
                          <div>
                            <span className="calendar-food-name">
                              <strong>{entry.foodName}</strong>
                              <b>{Math.round(entry.calories)} kcal</b>
                            </span>
                            <span>
                              {formatAmount(entry.amount, entry.unitLabel)} ·{' '}
                              {Math.round(entry.carbsG)}C · {Math.round(entry.proteinG)}P ·{' '}
                              {Math.round(entry.fibreG)}F
                            </span>
                            <NutrientDensityBadge nutrients={entry} />
                          </div>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="calendar-food-empty">No food entries were logged on this day.</p>
                  )}
                </section>
                {target.calorieRange ? (
                  <p className="calendar-target-note">
                    Your intake estimate for this goal is {target.calorieRange[0].toLocaleString()}–
                    {target.calorieRange[1].toLocaleString()} kcal. This day is context, not a
                    score.
                  </p>
                ) : null}
                {selectedWeights.length > 0 ? (
                  <div className="calendar-weight">
                    <Scale aria-hidden="true" />
                    <span>Weight check-in</span>
                    <strong>
                      {selectedWeights
                        .map((entry) => displayWeight(entry.weightKg, units))
                        .join(', ')}
                    </strong>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="calendar-empty">
                Nothing was logged here. A quiet day in your journal is just that—not a missed
                target.
              </p>
            )}
          </article>
        </>
      )}
    </section>
  );
});

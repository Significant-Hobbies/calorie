import {
  Activity,
  Apple,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Droplets,
  Flame,
  Leaf,
  Scale,
  Sprout,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { MacroStackedChart } from '../components/charts/MacroStackedChart';
import { TrendChart } from '../components/charts/TrendChart';
import { WaterChart } from '../components/charts/WaterChart';
import { WeightChart } from '../components/charts/WeightChart';
import { HistoryCalendar } from '../components/HistoryCalendar';
import { MealTimingInsights } from '../components/MealTimingInsights';
import { analyzeActionableInsights } from '../lib/actionable-insights';
import { addWeight, getCalendarHistory, getDashboard, getHistory } from '../lib/api';
import { calendarGrid, isSameMonth, localDateKey, shiftMonth } from '../lib/calendar';
import { analyzeFoodAnalytics, type FoodAnalyticsItem } from '../lib/food-analytics';
import { analyzeMealTiming } from '../lib/meal-timing';
import type { Dashboard, FoodEntry, HistoryResponse } from '../lib/types';

function displayWeight(weightKg: number, units: 'metric' | 'imperial') {
  return units === 'metric' ? `${weightKg.toFixed(1)} kg` : `${(weightKg * 2.20462).toFixed(1)} lb`;
}

function entriesInDays(entries: FoodEntry[], dates: Set<string>) {
  return entries.filter((entry) => dates.has(localDateKey(new Date(entry.eatenAt))));
}

function FoodRanking({
  items,
  metric,
  metricLabel,
  empty,
}: {
  items: FoodAnalyticsItem[];
  metric: (item: FoodAnalyticsItem) => string;
  metricLabel: string;
  empty: string;
}) {
  if (!items.length) return <p className="insights-empty">{empty}</p>;
  const maxMetric = Math.max(
    ...items.map((item) => (metric(item).includes('kcal') ? item.totalCalories : item.occasions)),
    1
  );
  return (
    <ol className="insights-ranking">
      {items.map((item, index) => {
        const barValue = metric(item).includes('kcal') ? item.totalCalories : item.occasions;
        const width = Math.max(8, (barValue / maxMetric) * 100);
        return (
          <li key={item.key} className="insights-rank-row">
            <span className="insights-rank-index" aria-hidden="true">
              {index + 1}
            </span>
            <div className="insights-rank-copy">
              <div className="insights-rank-head">
                <strong>{item.foodName}</strong>
                <span>{metric(item)}</span>
              </div>
              <div className="insights-rank-bar" aria-hidden="true">
                <span style={{ width: `${width}%` }} />
              </div>
              <small>
                {item.occasions} occasion{item.occasions === 1 ? '' : 's'} · avg {item.avgCalories}{' '}
                kcal · {item.avgProteinG}g protein · {item.avgFibreG}g fibre
              </small>
            </div>
          </li>
        );
      })}
      <span className="sr-only">{metricLabel}</span>
    </ol>
  );
}

export function ProgressPage() {
  const today = useMemo(() => new Date(), []);
  const [viewMode, setViewMode] = useState<'calendar' | 'trends'>('calendar');
  const [rangeDays, setRangeDays] = useState<7 | 30>(7);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [calendarHistory, setCalendarHistory] = useState<HistoryResponse | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1, 12)
  );
  const [selectedDate, setSelectedDate] = useState(() => localDateKey(today));
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [weight, setWeight] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setError(null);
    try {
      setDashboard(await getDashboard());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Progress could not load.');
    }
  }, []);

  const loadTrends = useCallback(async (days: 7 | 30) => {
    setError(null);
    try {
      setHistory(await getHistory(days));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Progress could not load.');
    }
  }, []);

  const loadCalendar = useCallback(async (month: Date) => {
    setError(null);
    try {
      const cells = calendarGrid(month);
      setCalendarHistory(await getCalendarHistory(cells.map((cell) => cell.date)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Calendar history could not load.');
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (viewMode === 'trends') void loadTrends(rangeDays);
  }, [viewMode, rangeDays, loadTrends]);

  useEffect(() => {
    if (viewMode === 'calendar') void loadCalendar(calendarMonth);
  }, [viewMode, calendarMonth, loadCalendar]);

  const summary = useMemo(() => {
    if (!history) return null;
    const logged = history.days.filter((day) => day.calories > 0);
    return {
      averageCalories: logged.length
        ? Math.round(logged.reduce((sum, day) => sum + day.calories, 0) / logged.length)
        : 0,
      averageProtein: logged.length
        ? Math.round(logged.reduce((sum, day) => sum + day.proteinG, 0) / logged.length)
        : 0,
      averageWater: logged.length
        ? Math.round(logged.reduce((sum, day) => sum + day.waterMl, 0) / logged.length)
        : 0,
      fasts: history.days.reduce((sum, day) => sum + day.fastCount, 0),
    };
  }, [history]);

  const mealTiming = useMemo(() => {
    if (!history || !dashboard) return null;
    return analyzeMealTiming({
      entries: history.entries ?? [],
      timezone: dashboard.timezone,
      wakeTime: dashboard.profile.wakeTime,
      sleepHours: dashboard.profile.sleepHours,
    });
  }, [dashboard, history]);

  // Insights-derived data (merged from the former Insights tab).
  const selected = useMemo(() => {
    if (!history) return null;
    const days = history.days.slice(-rangeDays);
    const dates = new Set(days.map((day) => day.date));
    const entries = entriesInDays(history.entries ?? [], dates);
    const previousDays =
      rangeDays === 7 && history.days.length >= 14 ? history.days.slice(-14, -7) : [];
    const previousEntries = entriesInDays(
      history.entries ?? [],
      new Set(previousDays.map((day) => day.date))
    );
    return { days, entries, previousDays, previousEntries };
  }, [history, rangeDays]);

  const analytics = useMemo(
    () => (selected ? analyzeFoodAnalytics(selected.entries) : null),
    [selected]
  );
  const insights = useMemo(
    () =>
      selected && dashboard
        ? analyzeActionableInsights({
            ...selected,
            target: dashboard.target,
            waterTargetMl: dashboard.profile.waterTargetMl,
          })
        : null,
    [dashboard, selected]
  );

  const saveWeight = async () => {
    if (!dashboard) return;
    let kilograms = Number(weight);
    if (dashboard.profile.units === 'imperial') kilograms /= 2.20462;
    if (!Number.isFinite(kilograms) || kilograms < 25 || kilograms > 400) {
      setError('Enter a weight between 25 and 400 kg (55 and 882 lb).');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await addWeight({
        id: crypto.randomUUID(),
        weightKg: Math.round(kilograms * 10) / 10,
        recordedAt: Date.now(),
      });
      setWeight('');
      await Promise.all([
        loadDashboard(),
        viewMode === 'calendar' ? loadCalendar(calendarMonth) : loadTrends(rangeDays),
      ]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Weight could not be logged.');
    } finally {
      setSaving(false);
    }
  };

  const moveMonth = (amount: number) => {
    const next = shiftMonth(calendarMonth, amount);
    if (amount > 0 && isSameMonth(calendarMonth, today)) return;
    setCalendarHistory(null);
    setCalendarMonth(next);
    setSelectedDate(
      isSameMonth(next, today)
        ? localDateKey(today)
        : localDateKey(new Date(next.getFullYear(), next.getMonth() + 1, 0, 12))
    );
  };

  const chartMax = history
    ? Math.max(...history.days.map((day) => day.calories), dashboard?.target.calorieTarget ?? 1, 1)
    : 1;
  const inRangeCount =
    history && dashboard?.target.calorieRange
      ? history.days.filter(
          (day) =>
            day.calories > 0 &&
            day.calories >= (dashboard.target.calorieRange?.[0] ?? 0) &&
            day.calories <= (dashboard.target.calorieRange?.[1] ?? Number.POSITIVE_INFINITY)
        ).length
      : 0;
  const visibleWeights =
    (viewMode === 'calendar' ? calendarHistory?.weights : history?.weights) ?? [];

  const hasEntries = (analytics?.totalOccasions ?? 0) > 0;
  const loading =
    !dashboard || (viewMode === 'trends' && (!history || !summary || !analytics || !insights));

  return (
    <div className="page-stack">
      <header className="page-heading split-heading progress-heading">
        <div>
          <p>A wider view</p>
          <h1>Your progress</h1>
          <span>Patterns are more useful than perfect days.</span>
        </div>
        <fieldset className="range-toggle view-toggle">
          <legend className="sr-only">Progress view</legend>
          {(['calendar', 'trends'] as const).map((view) => (
            <button
              key={view}
              type="button"
              className={viewMode === view ? 'is-selected' : ''}
              aria-pressed={viewMode === view}
              onClick={() => setViewMode(view)}
            >
              {view === 'calendar' ? 'Calendar' : 'Trends'}
            </button>
          ))}
        </fieldset>
      </header>

      {error ? (
        <div className="inline-error" role="alert">
          {error}
        </div>
      ) : null}

      {loading || (viewMode === 'calendar' && !calendarHistory) ? (
        <div className="page-stack" aria-busy="true">
          <div className="skeleton dashboard-skeleton" />
          <div className="skeleton dashboard-skeleton short" />
        </div>
      ) : (
        <>
          {viewMode === 'calendar' && calendarHistory ? (
            <>
              <HistoryCalendar
                month={calendarMonth}
                history={calendarHistory}
                selectedDate={selectedDate}
                target={dashboard.target}
                units={dashboard.profile.units}
                onPreviousMonth={() => moveMonth(-1)}
                onNextMonth={() => moveMonth(1)}
                onSelectDate={setSelectedDate}
              />
              {visibleWeights.length >= 2 ? (
                <WeightChart weights={visibleWeights} profile={dashboard.profile} />
              ) : null}
            </>
          ) : null}

          {viewMode === 'trends' && history && summary && analytics && insights ? (
            <>
              {!hasEntries ? (
                <section className="empty-state compact-empty">
                  <Apple aria-hidden="true" />
                  <h2>No entries in the last {rangeDays} days</h2>
                  <p>Log a few meals on different days and your food patterns will show up here.</p>
                </section>
              ) : (
                <section className="insights-focus" aria-labelledby="insights-focus-title">
                  <div>
                    <p>
                      Based on {insights.confidence.loggedDays} logged day
                      {insights.confidence.loggedDays === 1 ? '' : 's'} in this {rangeDays}-day
                      window
                    </p>
                    <h2 id="insights-focus-title">{insights.takeaway}</h2>
                  </div>
                  <span
                    className={
                      insights.confidence.isSparse
                        ? 'insights-confidence is-sparse'
                        : 'insights-confidence'
                    }
                  >
                    {insights.confidence.isSparse ? 'Early signal' : 'Pattern forming'}
                  </span>
                </section>
              )}

              <div className="trend-toolbar">
                <p>Choose a window for averages and rhythm.</p>
                <fieldset className="range-toggle">
                  <legend className="sr-only">History range</legend>
                  {([7, 30] as const).map((days) => (
                    <button
                      key={days}
                      type="button"
                      className={rangeDays === days ? 'is-selected' : ''}
                      aria-pressed={rangeDays === days}
                      onClick={() => setRangeDays(days)}
                    >
                      {days} days
                    </button>
                  ))}
                </fieldset>
              </div>

              <section className="metric-grid" aria-label="Period summary">
                <article>
                  <Activity aria-hidden="true" />
                  <span>Average intake</span>
                  <strong>{summary.averageCalories.toLocaleString()} kcal</strong>
                </article>
                <article>
                  <Sprout aria-hidden="true" />
                  <span>Average protein</span>
                  <strong>{summary.averageProtein} g</strong>
                </article>
                <article>
                  <Droplets aria-hidden="true" />
                  <span>Average water</span>
                  <strong>{(summary.averageWater / 1000).toFixed(1)} L</strong>
                </article>
                <article>
                  <CalendarDays aria-hidden="true" />
                  <span>Fasting windows</span>
                  <strong>{summary.fasts}</strong>
                </article>
              </section>

              <TrendChart days={history.days} dashboard={dashboard} rangeDays={rangeDays} />

              <section className="chart-card" aria-labelledby="intake-chart-title">
                <header>
                  <div>
                    <p>Daily calories</p>
                    <h2 id="intake-chart-title">A gentle rhythm</h2>
                  </div>
                  <span>
                    Range {dashboard.target.calorieRange?.[0]?.toLocaleString() ?? '—'}–
                    {dashboard.target.calorieRange?.[1]?.toLocaleString() ?? '—'}
                  </span>
                </header>
                <div
                  className="bar-chart"
                  role="img"
                  aria-label={`Calorie intake for the last ${rangeDays} days. ${inRangeCount} logged days were within the estimate.`}
                >
                  {history.days.map((day, index) => {
                    const height = day.calories ? Math.max(8, (day.calories / chartMax) * 100) : 3;
                    const inRange =
                      Boolean(dashboard.target.calorieRange) &&
                      day.calories >= (dashboard.target.calorieRange?.[0] ?? 0) &&
                      day.calories <=
                        (dashboard.target.calorieRange?.[1] ?? Number.POSITIVE_INFINITY);
                    const showLabel = rangeDays === 7 || index % 5 === 0 || index === 29;
                    return (
                      <div className="bar-column" key={day.date}>
                        <span
                          className={inRange ? 'bar is-in-range' : 'bar'}
                          style={{ height: `${height}%` }}
                          title={`${day.date}: ${Math.round(day.calories)} kcal${inRange ? ', within estimate' : ''}`}
                        />
                        <small>{showLabel ? shortDay(day.date) : ''}</small>
                      </div>
                    );
                  })}
                </div>
                <p className="chart-note">
                  <span className="range-key" aria-hidden="true" />
                  {inRangeCount} logged day{inRangeCount === 1 ? '' : 's'} sat inside your estimate.
                  Other days are context—not failures.
                </p>
              </section>

              <MacroStackedChart days={history.days} rangeDays={rangeDays} />

              <WaterChart
                days={history.days}
                targetMl={dashboard.profile.waterTargetMl}
                rangeDays={rangeDays}
              />

              {visibleWeights.length >= 2 ? (
                <WeightChart weights={visibleWeights} profile={dashboard.profile} />
              ) : null}

              {mealTiming ? (
                <MealTimingInsights analysis={mealTiming} rangeDays={rangeDays} />
              ) : null}

              {hasEntries ? (
                <>
                  <section className="insights-patterns" aria-label="Food-pattern summary">
                    <dl>
                      <div>
                        <dt>Logged occasions</dt>
                        <dd>{insights.variety.totalOccasions}</dd>
                        <small>Across {insights.confidence.loggedDays} logged days</small>
                      </div>
                      <div>
                        <dt>Food variety</dt>
                        <dd>{insights.variety.distinctFoods} foods</dd>
                        <small>{insights.variety.repeatedFoods} repeated in this window</small>
                      </div>
                      <div>
                        <dt>Most logged</dt>
                        <dd>{analytics.byOccasions[0]?.foodName ?? '—'}</dd>
                        <small>{analytics.byOccasions[0]?.occasions ?? 0} logged occasions</small>
                      </div>
                    </dl>
                    {insights.comparison ? (
                      <p className="insights-comparison">
                        {insights.comparison.direction === 'higher' ? (
                          <ArrowUpRight aria-hidden="true" />
                        ) : insights.comparison.direction === 'lower' ? (
                          <ArrowDownRight aria-hidden="true" />
                        ) : (
                          <Flame aria-hidden="true" />
                        )}
                        Average logged calories were{' '}
                        {insights.comparison.direction === 'steady'
                          ? 'close to the prior 7-day window.'
                          : `${Math.abs(insights.comparison.averageCaloriesDelta).toLocaleString()} kcal ${insights.comparison.direction} than the prior 7-day window.`}
                      </p>
                    ) : rangeDays === 30 ? (
                      <p className="insights-comparison">
                        A prior 30-day comparison needs a longer history window.
                      </p>
                    ) : null}
                  </section>

                  <section className="insights-coverage" aria-labelledby="coverage-title">
                    <header>
                      <div>
                        <p>Configured targets</p>
                        <h2 id="coverage-title">Average coverage on logged days</h2>
                      </div>
                      <span>{insights.confidence.loggedDays} day sample</span>
                    </header>
                    {insights.coverage.length ? (
                      <div className="coverage-list">
                        {insights.coverage.map((item) => (
                          <div key={item.key}>
                            <div className="coverage-label">
                              {item.key === 'protein' ? (
                                <Sprout aria-hidden="true" />
                              ) : item.key === 'fibre' ? (
                                <Leaf aria-hidden="true" />
                              ) : item.key === 'water' ? (
                                <Droplets aria-hidden="true" />
                              ) : (
                                <Flame aria-hidden="true" />
                              )}
                              <span>{item.label}</span>
                            </div>
                            <strong>{item.averagePercent}%</strong>
                            <div className="coverage-track" aria-hidden="true">
                              <span style={{ width: `${item.averagePercent}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="insights-empty">
                        Set a daily target in You to see target coverage here.
                      </p>
                    )}
                  </section>

                  <details className="insights-foldout">
                    <summary>
                      <span>
                        <strong>Food details</strong>
                        <small>See the foods shaping this window</small>
                      </span>
                      <span aria-hidden="true">View</span>
                    </summary>
                    <div className="insights-foldout-content">
                      <section aria-labelledby="most-logged-title">
                        <header>
                          <div>
                            <p>By occasions</p>
                            <h2 id="most-logged-title">Most logged foods</h2>
                          </div>
                          <span>{rangeDays}-day window</span>
                        </header>
                        <FoodRanking
                          items={analytics.byOccasions.slice(0, 8)}
                          metric={(item) => `${item.occasions}× logged`}
                          metricLabel="Ranked by number of logged occasions"
                          empty="No foods logged in this window yet."
                        />
                      </section>

                      <section aria-labelledby="calorie-contrib-title">
                        <header>
                          <div>
                            <p>By calories</p>
                            <h2 id="calorie-contrib-title">Biggest calorie contributors</h2>
                          </div>
                          <span>{rangeDays}-day window</span>
                        </header>
                        <FoodRanking
                          items={analytics.byCalories.slice(0, 8)}
                          metric={(item) => `${item.totalCalories.toLocaleString()} kcal`}
                          metricLabel="Ranked by total calories contributed"
                          empty="No calorie data in this window yet."
                        />
                      </section>
                    </div>
                  </details>
                </>
              ) : null}
            </>
          ) : null}

          <section className="weight-card" aria-labelledby="weight-title">
            <div className="weight-copy">
              <span className="section-icon small">
                <Scale aria-hidden="true" />
              </span>
              <div>
                <p>Weight check-in</p>
                <h2 id="weight-title">
                  {dashboard.latestWeight
                    ? displayWeight(dashboard.latestWeight.weightKg, dashboard.profile.units)
                    : 'No entries yet'}
                </h2>
                <span>
                  {dashboard.profile.targetWeightKg
                    ? `Your direction: ${displayWeight(
                        dashboard.profile.targetWeightKg,
                        dashboard.profile.units
                      )}`
                    : 'A trend appears after a few check-ins.'}
                </span>
              </div>
            </div>
            <div className="weight-entry">
              <label>
                <span className="sr-only">Current weight</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  placeholder={dashboard.profile.units === 'metric' ? 'kg' : 'lb'}
                  value={weight}
                  onChange={(event) => setWeight(event.target.value)}
                />
              </label>
              <button
                className="button button-primary"
                type="button"
                disabled={saving}
                onClick={() => void saveWeight()}
              >
                {saving ? 'Saving…' : 'Log'}
              </button>
            </div>
          </section>

          {visibleWeights.length > 1 ? (
            <section className="weight-history" aria-label="Recent weight entries">
              {[...visibleWeights]
                .sort((a, b) => b.recordedAt - a.recordedAt)
                .slice(0, 5)
                .map((entry) => (
                  <div key={entry.id}>
                    <span>
                      {new Intl.DateTimeFormat(undefined, {
                        month: 'short',
                        day: 'numeric',
                      }).format(entry.recordedAt)}
                    </span>
                    <strong>{displayWeight(entry.weightKg, dashboard.profile.units)}</strong>
                  </div>
                ))}
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

function shortDay(date: string) {
  return new Intl.DateTimeFormat(undefined, { weekday: 'narrow' }).format(
    new Date(`${date}T12:00:00`)
  );
}

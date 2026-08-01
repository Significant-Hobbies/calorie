import { Apple, ArrowDownRight, ArrowUpRight, Droplets, Flame, Leaf, Sprout } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { analyzeActionableInsights } from '../lib/actionable-insights';
import { getDashboard, getHistory } from '../lib/api';
import { localDateKey } from '../lib/calendar';
import { analyzeFoodAnalytics, type FoodAnalyticsItem } from '../lib/food-analytics';
import type { Dashboard, FoodEntry, HistoryResponse } from '../lib/types';

function rankLabel(index: number) {
  return `${index + 1}`;
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
              {rankLabel(index)}
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

function entriesInDays(entries: FoodEntry[], dates: Set<string>) {
  return entries.filter((entry) => dates.has(localDateKey(new Date(entry.eatenAt))));
}

export function InsightsPage() {
  const [rangeDays, setRangeDays] = useState<7 | 30>(7);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [nextHistory, nextDashboard] = await Promise.all([getHistory(30), getDashboard()]);
      setHistory(nextHistory);
      setDashboard(nextDashboard);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Insights could not load.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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

  return (
    <div className="page-stack">
      <header className="page-heading split-heading progress-heading">
        <div>
          <p>Food patterns</p>
          <h1>Insights</h1>
          <span>Patterns from your journal, with the context to read them clearly.</span>
        </div>
        <fieldset className="range-toggle view-toggle">
          <legend className="sr-only">Insights range</legend>
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
      </header>

      {error ? (
        <div className="inline-error" role="alert">
          {error}
        </div>
      ) : null}

      {!analytics || !insights ? (
        <div className="page-stack" aria-busy="true">
          <div className="skeleton dashboard-skeleton" />
          <div className="skeleton dashboard-skeleton short" />
        </div>
      ) : analytics.totalOccasions === 0 ? (
        <section className="empty-state compact-empty">
          <Apple aria-hidden="true" />
          <h2>No entries in the last {rangeDays} days</h2>
          <p>Log a few meals on different days and your food patterns will show up here.</p>
        </section>
      ) : (
        <>
          <section className="insights-focus" aria-labelledby="insights-focus-title">
            <div>
              <p>
                Based on {insights.confidence.loggedDays} logged day
                {insights.confidence.loggedDays === 1 ? '' : 's'} in this {rangeDays}-day window
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
      )}
    </div>
  );
}

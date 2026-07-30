import { Apple, Flame, Sprout, Utensils } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getHistory } from '../lib/api';
import { analyzeFoodAnalytics, type FoodAnalyticsItem } from '../lib/food-analytics';
import type { HistoryResponse } from '../lib/types';

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
  if (!items.length) {
    return <p className="insights-empty">{empty}</p>;
  }
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

export function InsightsPage() {
  const [rangeDays, setRangeDays] = useState<7 | 30>(7);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (days: 7 | 30) => {
    setError(null);
    try {
      setHistory(await getHistory(days));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Insights could not load.');
    }
  }, []);

  useEffect(() => {
    void load(rangeDays);
  }, [rangeDays, load]);

  const analytics = useMemo(
    () => (history ? analyzeFoodAnalytics(history.entries ?? []) : null),
    [history]
  );

  return (
    <div className="page-stack">
      <header className="page-heading split-heading progress-heading">
        <div>
          <p>Food patterns</p>
          <h1>Insights</h1>
          <span>What you actually eat, by frequency and contribution.</span>
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

      {!analytics ? (
        <div className="page-stack" aria-busy="true">
          <div className="skeleton dashboard-skeleton" />
          <div className="skeleton dashboard-skeleton short" />
        </div>
      ) : analytics.totalOccasions === 0 ? (
        <section className="empty-state compact-empty">
          <Apple aria-hidden="true" />
          <h2>No entries in the last {rangeDays} days</h2>
          <p>Log a few meals and your food patterns will show up here.</p>
        </section>
      ) : (
        <>
          <section className="metric-grid" aria-label="Insights summary">
            <article>
              <Utensils aria-hidden="true" />
              <span>Total occasions</span>
              <strong>{analytics.totalOccasions.toLocaleString()}</strong>
            </article>
            <article>
              <Apple aria-hidden="true" />
              <span>Distinct foods</span>
              <strong>{analytics.distinctFoods.toLocaleString()}</strong>
            </article>
            <article>
              <Flame aria-hidden="true" />
              <span>Top calorie source</span>
              <strong>{analytics.byCalories[0]?.foodName ?? '—'}</strong>
            </article>
            <article>
              <Sprout aria-hidden="true" />
              <span>Most logged</span>
              <strong>{analytics.byOccasions[0]?.foodName ?? '—'}</strong>
            </article>
          </section>

          <section className="chart-card" aria-labelledby="most-logged-title">
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

          <section className="chart-card" aria-labelledby="calorie-contrib-title">
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
        </>
      )}
    </div>
  );
}

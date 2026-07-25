import { Activity, CalendarDays, Droplets, Scale, Sprout } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { addWeight, getDashboard, getHistory } from '../lib/api';
import type { Dashboard, HistoryResponse } from '../lib/types';

function shortDay(date: string) {
  return new Intl.DateTimeFormat(undefined, { weekday: 'narrow' }).format(
    new Date(`${date}T12:00:00`)
  );
}

function displayWeight(weightKg: number, units: 'metric' | 'imperial') {
  return units === 'metric' ? `${weightKg.toFixed(1)} kg` : `${(weightKg * 2.20462).toFixed(1)} lb`;
}

export function ProgressPage() {
  const [rangeDays, setRangeDays] = useState<7 | 30>(7);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [weight, setWeight] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (days: 7 | 30) => {
    setError(null);
    try {
      const [nextHistory, nextDashboard] = await Promise.all([getHistory(days), getDashboard()]);
      setHistory(nextHistory);
      setDashboard(nextDashboard);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Progress could not load.');
    }
  }, []);

  useEffect(() => {
    void load(rangeDays);
  }, [rangeDays, load]);

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
      await load(rangeDays);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Weight could not be logged.');
    } finally {
      setSaving(false);
    }
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

  return (
    <div className="page-stack">
      <header className="page-heading split-heading">
        <div>
          <p>A wider view</p>
          <h1>Your progress</h1>
          <span>Patterns are more useful than perfect days.</span>
        </div>
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
      </header>

      {error ? (
        <div className="inline-error" role="alert">
          {error}
        </div>
      ) : null}

      {!history || !dashboard || !summary ? (
        <div className="page-stack" aria-busy="true">
          <div className="skeleton dashboard-skeleton" />
          <div className="skeleton dashboard-skeleton short" />
        </div>
      ) : (
        <>
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
                  day.calories <= (dashboard.target.calorieRange?.[1] ?? Number.POSITIVE_INFINITY);
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

          {history.weights.length > 1 ? (
            <section className="weight-history" aria-label="Recent weight entries">
              {[...history.weights]
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

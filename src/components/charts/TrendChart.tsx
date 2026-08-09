import { useMemo, useState } from 'react';
import type { Dashboard, HistoryDay } from '../../lib/types';
import { AccessibleChartTable } from './AccessibleChartTable';
import { areaPath, linePath, niceMax, type SeriesKey, scale, xPositions } from './chart-utils';

const METRICS: Array<{
  key: SeriesKey;
  label: string;
  unit: string;
  color: string;
  get: (day: HistoryDay) => number;
  target: (dashboard: Dashboard) => number | null;
  step: number;
}> = [
  {
    key: 'calories',
    label: 'Calories',
    unit: 'kcal',
    color: 'var(--cherry)',
    get: (day) => day.calories,
    target: (d) => d.target.calorieTarget,
    step: 200,
  },
  {
    key: 'protein',
    label: 'Protein',
    unit: 'g',
    color: 'var(--moss-600)',
    get: (day) => day.proteinG,
    target: (d) => d.target.proteinRangeG?.[0] ?? null,
    step: 20,
  },
  {
    key: 'carbs',
    label: 'Carbs',
    unit: 'g',
    color: 'var(--amber)',
    get: (day) => day.carbsG,
    target: () => null,
    step: 50,
  },
  {
    key: 'fibre',
    label: 'Fibre',
    unit: 'g',
    color: 'var(--sky)',
    get: (day) => day.fibreG,
    target: (d) => d.target.fibreTargetG,
    step: 10,
  },
];

const WIDTH = 320;
const HEIGHT = 180;
const PAD = 8;
const BASELINE = HEIGHT - 24;

export function TrendChart({
  days,
  dashboard,
  rangeDays,
}: {
  days: HistoryDay[];
  dashboard: Dashboard;
  rangeDays: 7 | 30;
}) {
  const [active, setActive] = useState<SeriesKey>('calories');
  const metric = METRICS.find((m) => m.key === active) ?? METRICS[0];

  const { points, area, targetY, target, avg } = useMemo(() => {
    const values = days.map(metric.get);
    const rawMax = Math.max(...values, metric.target(dashboard) ?? 0, 1);
    const max = niceMax(rawMax * 1.1, metric.step);
    const yScale = scale([0, max], [BASELINE, PAD]);
    const xs = xPositions(days.length, WIDTH, PAD);
    const points = days.map((day, i) => ({ x: xs[i], y: yScale(metric.get(day)) }));
    const target = metric.target(dashboard);
    const targetY = target != null ? yScale(target) : null;
    const logged = values.filter((v) => v > 0);
    const avg = logged.length ? Math.round(logged.reduce((s, v) => s + v, 0) / logged.length) : 0;
    return { points, area: areaPath(points, BASELINE), targetY, target, avg };
  }, [days, metric, dashboard]);

  const showLabel = (_: HistoryDay, i: number) =>
    rangeDays === 7 || i % 5 === 0 || i === days.length - 1;
  const shortDay = (date: string) =>
    new Intl.DateTimeFormat(undefined, { weekday: 'narrow' }).format(new Date(`${date}T12:00:00`));

  return (
    <section className="chart-card trend-chart" aria-labelledby="trend-chart-title">
      <header>
        <div>
          <p>Macro trends</p>
          <h2 id="trend-chart-title">How each macro moves</h2>
        </div>
        <span>
          Avg {avg.toLocaleString()} {metric.unit}
        </span>
      </header>

      <fieldset className="metric-toggle">
        <legend className="sr-only">Trend metric</legend>
        {METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            className={active === m.key ? 'is-selected' : ''}
            aria-pressed={active === m.key}
            onClick={() => setActive(m.key)}
          >
            <i aria-hidden="true" style={{ background: m.color }} />
            {m.label}
          </button>
        ))}
      </fieldset>

      <div className="chart-svg-wrap">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={`${metric.label} over the last ${rangeDays} days. Average ${avg} ${metric.unit}.`}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={`trend-fill-${metric.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={metric.color} stopOpacity="0.22" />
              <stop offset="100%" stopColor={metric.color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {targetY != null ? (
            <line
              x1={PAD}
              x2={WIDTH - PAD}
              y1={targetY}
              y2={targetY}
              className="chart-target-line"
              strokeDasharray="4 4"
            />
          ) : null}
          <path d={area} fill={`url(#trend-fill-${metric.key})`} />
          <path
            d={linePath(points)}
            fill="none"
            stroke={metric.color}
            strokeWidth="2"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {points.map((p, i) => (
            <circle
              key={days[i].date}
              cx={p.x}
              cy={p.y}
              r="2.5"
              fill={metric.color}
              className="chart-dot"
            />
          ))}
        </svg>
        <div className="chart-x-labels" aria-hidden="true">
          {days.map((day, i) => (
            <span key={day.date}>{showLabel(day, i) ? shortDay(day.date) : ''}</span>
          ))}
        </div>
      </div>

      <AccessibleChartTable
        caption={`${metric.label === 'Calories' ? 'Calorie' : metric.label} values for the last ${rangeDays} days`}
        columns={['Date', `${metric.label} (${metric.unit})`]}
        rows={days.map((day) => [day.date, metric.get(day)])}
      />

      <p className="chart-note">
        {target != null ? (
          <>
            Dashed line is your {metric.label.toLowerCase()} target of {target.toLocaleString()}{' '}
            {metric.unit}. Empty days are not counted as zero.
          </>
        ) : (
          <>No target set for {metric.label.toLowerCase()}. Empty days are not counted as zero.</>
        )}
      </p>
    </section>
  );
}

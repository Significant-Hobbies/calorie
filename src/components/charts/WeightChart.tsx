import { useMemo } from 'react';
import { displayWeightValue } from '../../lib/log-corrections';
import type { UserProfile, WeightEntry } from '../../lib/types';
import { AccessibleChartTable } from './AccessibleChartTable';
import { areaPath, linePath, scale } from './chart-utils';

const WIDTH = 320;
const HEIGHT = 180;
const PAD = 10;
const BASELINE = HEIGHT - 24;

function displayWeight(weightKg: number, units: 'metric' | 'imperial') {
  return units === 'metric' ? `${weightKg.toFixed(1)} kg` : `${(weightKg * 2.20462).toFixed(1)} lb`;
}

export function WeightChart({
  weights,
  profile,
}: {
  weights: WeightEntry[];
  profile: UserProfile;
}) {
  const sorted = useMemo(() => [...weights].sort((a, b) => a.recordedAt - b.recordedAt), [weights]);

  const { points, area, targetY, target, latest, earliest } = useMemo(() => {
    if (sorted.length < 2) {
      return {
        points: [],
        area: '',
        targetY: null,
        target: null,
        latest: null,
        earliest: null,
      };
    }
    const values = sorted.map((w) => w.weightKg);
    const target = profile.targetWeightKg;
    const lo = Math.min(...values, target ?? Number.POSITIVE_INFINITY);
    const hi = Math.max(...values, target ?? Number.NEGATIVE_INFINITY);
    const span = hi - lo || 1;
    const min = lo - span * 0.15;
    const max = hi + span * 0.15;
    const yScale = scale([min, max], [BASELINE, PAD]);
    const xScale = scale(
      [sorted[0].recordedAt, sorted[sorted.length - 1].recordedAt],
      [PAD, WIDTH - PAD]
    );
    const points = sorted.map((w) => ({ x: xScale(w.recordedAt), y: yScale(w.weightKg) }));
    return {
      points,
      area: areaPath(points, BASELINE),
      targetY: target != null ? yScale(target) : null,
      target,
      latest: sorted[sorted.length - 1],
      earliest: sorted[0],
    };
  }, [sorted, profile.targetWeightKg]);

  if (sorted.length < 2 || !latest || !earliest) {
    return (
      <section className="chart-card weight-chart" aria-labelledby="weight-chart-title">
        <header>
          <div>
            <p>Weight trend</p>
            <h2 id="weight-chart-title">A trend needs two check-ins</h2>
          </div>
        </header>
        <p className="chart-empty-note">
          Log your weight on two different days and the line appears here.
        </p>
      </section>
    );
  }

  const delta = latest.weightKg - earliest.weightKg;
  const deltaLabel =
    Math.abs(delta) < 0.05
      ? 'steady'
      : `${delta > 0 ? '+' : ''}${displayWeight(Math.abs(delta), profile.units)} ${delta > 0 ? 'up' : 'down'}`;

  return (
    <section className="chart-card weight-chart" aria-labelledby="weight-chart-title">
      <header>
        <div>
          <p>Weight trend</p>
          <h2 id="weight-chart-title">{displayWeight(latest.weightKg, profile.units)}</h2>
        </div>
        <span>{deltaLabel} since first</span>
      </header>

      <div className="chart-svg-wrap">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={`Weight trend from ${displayWeight(earliest.weightKg, profile.units)} to ${displayWeight(latest.weightKg, profile.units)}.`}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="weight-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--moss-600)" stopOpacity="0.2" />
              <stop offset="100%" stopColor="var(--moss-600)" stopOpacity="0" />
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
          <path d={area} fill="url(#weight-fill)" />
          <path
            d={linePath(points)}
            fill="none"
            stroke="var(--moss-700)"
            strokeWidth="2"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {points.map((p, i) => (
            <circle
              key={sorted[i].id}
              cx={p.x}
              cy={p.y}
              r="3"
              fill="var(--moss-700)"
              className="chart-dot"
            />
          ))}
        </svg>
        <div className="chart-x-labels" aria-hidden="true">
          <span>
            {new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(
              earliest.recordedAt
            )}
          </span>
          <span>
            {new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(
              latest.recordedAt
            )}
          </span>
        </div>
      </div>

      <AccessibleChartTable
        caption="Weight check-in values"
        columns={['Date', `Weight (${profile.units === 'metric' ? 'kg' : 'lb'})`]}
        rows={sorted.map((entry) => [
          new Intl.DateTimeFormat(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          }).format(entry.recordedAt),
          displayWeightValue(entry.weightKg, profile.units),
        ])}
      />

      <p className="chart-note">
        {target != null
          ? `Dashed line is your target of ${displayWeight(target, profile.units)}. ${sorted.length} check-in${sorted.length === 1 ? '' : 's'}.`
          : `${sorted.length} check-in${sorted.length === 1 ? '' : 's'}. Set a target weight in You to see a goal line.`}
      </p>
    </section>
  );
}

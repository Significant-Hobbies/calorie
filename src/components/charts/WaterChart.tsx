import { useMemo } from 'react';
import type { HistoryDay } from '../../lib/types';
import { niceMax, scale } from './chart-utils';

const WIDTH = 320;
const HEIGHT = 180;
const PAD = 8;
const BASELINE = HEIGHT - 24;

export function WaterChart({
  days,
  targetMl,
  rangeDays,
}: {
  days: HistoryDay[];
  targetMl: number;
  rangeDays: 7 | 30;
}) {
  const { max, targetY, avg } = useMemo(() => {
    const values = days.map((day) => day.waterMl);
    const max = niceMax(Math.max(...values, targetMl, 1) * 1.1, 500);
    const yScale = scale([0, max], [BASELINE, PAD]);
    const targetY = targetMl > 0 ? yScale(targetMl) : null;
    const logged = values.filter((v) => v > 0);
    const avg = logged.length ? Math.round(logged.reduce((s, v) => s + v, 0) / logged.length) : 0;
    return { max, targetY, avg };
  }, [days, targetMl]);

  const yScale = scale([0, max], [BASELINE, PAD]);
  const barGap = rangeDays === 7 ? 6 : 2;
  const barWidth = (WIDTH - PAD * 2 - barGap * (days.length - 1)) / days.length;

  const showLabel = (i: number) => rangeDays === 7 || i % 5 === 0 || i === days.length - 1;
  const shortDay = (date: string) =>
    new Intl.DateTimeFormat(undefined, { weekday: 'narrow' }).format(new Date(`${date}T12:00:00`));

  return (
    <section className="chart-card water-chart" aria-labelledby="water-chart-title">
      <header>
        <div>
          <p>Hydration</p>
          <h2 id="water-chart-title">Daily water</h2>
        </div>
        <span>Avg {(avg / 1000).toFixed(1)} L</span>
      </header>

      <div className="chart-svg-wrap">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={`Water intake for the last ${rangeDays} days. Average ${(avg / 1000).toFixed(1)} litres.`}
          preserveAspectRatio="none"
        >
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
          {days.map((day, i) => {
            const x = PAD + i * (barWidth + barGap);
            const h = day.waterMl > 0 ? BASELINE - yScale(day.waterMl) : 2;
            const over = targetMl > 0 && day.waterMl >= targetMl;
            return (
              <rect
                key={day.date}
                x={x}
                y={BASELINE - h}
                width={barWidth}
                height={h}
                rx={2}
                fill={over ? 'var(--sky)' : 'var(--sky-soft)'}
                stroke={over ? 'none' : 'var(--sky)'}
                strokeWidth="1"
              >
                <title>{`${day.date}: ${(day.waterMl / 1000).toFixed(2)} L`}</title>
              </rect>
            );
          })}
        </svg>
        <div className="chart-x-labels" aria-hidden="true">
          {days.map((day, i) => (
            <span key={day.date}>{showLabel(i) ? shortDay(day.date) : ''}</span>
          ))}
        </div>
      </div>

      <p className="chart-note">
        {targetMl > 0
          ? `Dashed line is your ${(targetMl / 1000).toFixed(1)} L target. Filled bars hit or pass it.`
          : 'Set a water target in You to see a goal line here.'}
      </p>
    </section>
  );
}

import { useMemo } from 'react';
import type { HistoryDay } from '../../lib/types';
import { niceMax, scale } from './chart-utils';

const WIDTH = 320;
const HEIGHT = 180;
const PAD = 8;
const BASELINE = HEIGHT - 24;

const SEGMENTS = [
  { key: 'carbsG', label: 'Carbs', color: 'var(--amber)' },
  { key: 'proteinG', label: 'Protein', color: 'var(--moss-600)' },
  { key: 'fibreG', label: 'Fibre', color: 'var(--sky)' },
] as const;

export function MacroStackedChart({ days, rangeDays }: { days: HistoryDay[]; rangeDays: 7 | 30 }) {
  const max = useMemo(() => {
    const totals = days.map((day) => day.carbsG + day.proteinG + day.fibreG);
    return niceMax(Math.max(...totals, 1) * 1.1, 50);
  }, [days]);

  const yScale = scale([0, max], [BASELINE, PAD]);
  const barGap = rangeDays === 7 ? 6 : 2;
  const barWidth = (WIDTH - PAD * 2 - barGap * (days.length - 1)) / days.length;

  const showLabel = (i: number) => rangeDays === 7 || i % 5 === 0 || i === days.length - 1;
  const shortDay = (date: string) =>
    new Intl.DateTimeFormat(undefined, { weekday: 'narrow' }).format(new Date(`${date}T12:00:00`));

  return (
    <section className="chart-card macro-stacked-chart" aria-labelledby="macro-stacked-title">
      <header>
        <div>
          <p>Macro breakdown</p>
          <h2 id="macro-stacked-title">Carbs, protein, fibre per day</h2>
        </div>
        <span>Stacked grams</span>
      </header>

      <div className="chart-svg-wrap">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={`Stacked carbs, protein and fibre in grams for the last ${rangeDays} days.`}
          preserveAspectRatio="none"
        >
          {days.map((day, i) => {
            const x = PAD + i * (barWidth + barGap);
            let offset = BASELINE;
            return (
              <g key={day.date}>
                {SEGMENTS.map((seg) => {
                  const value = day[seg.key];
                  if (value <= 0) return null;
                  const h = BASELINE - yScale(value);
                  offset -= h;
                  return (
                    <rect
                      key={seg.key}
                      x={x}
                      y={offset}
                      width={barWidth}
                      height={h}
                      fill={seg.color}
                      rx={seg.key === 'fibreG' ? 2 : 0}
                    >
                      <title>{`${day.date}: ${Math.round(value)}g ${seg.label}`}</title>
                    </rect>
                  );
                })}
              </g>
            );
          })}
        </svg>
        <div className="chart-x-labels" aria-hidden="true">
          {days.map((day, i) => (
            <span key={day.date}>{showLabel(i) ? shortDay(day.date) : ''}</span>
          ))}
        </div>
      </div>

      <ul className="chart-legend">
        {SEGMENTS.map((seg) => (
          <li key={seg.key}>
            <i aria-hidden="true" style={{ background: seg.color }} />
            {seg.label}
          </li>
        ))}
      </ul>
    </section>
  );
}

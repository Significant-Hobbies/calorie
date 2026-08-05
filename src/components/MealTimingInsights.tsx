import { Clock3, MoonStar, Sprout, Sunrise, Utensils } from 'lucide-react';
import { type CSSProperties, memo } from 'react';
import type { MealTimingAnalysis, MealTimingBandKey } from '../lib/types';

const BAND_LABELS: Record<MealTimingBandKey, string> = {
  before_noon: 'Before noon',
  midday: 'Noon–5 pm',
  after_five: 'After 5 pm',
};

function formatClock(minutes: number | null) {
  if (minutes === null) return '—';
  const date = new Date(2026, 0, 1, Math.floor(minutes / 60), minutes % 60);
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatDuration(minutes: number | null) {
  if (minutes === null) return 'Not enough entries';
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder} min`;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}

function markerPosition(minutes: number | null) {
  if (minutes === null) return '50%';
  return `${Math.max(2, Math.min(98, (minutes / (24 * 60)) * 100))}%`;
}

export const MealTimingInsights = memo(function MealTimingInsights({
  analysis,
  rangeDays,
}: {
  analysis: MealTimingAnalysis;
  rangeDays: 7 | 30;
}) {
  const isSparse = analysis.loggedDays < 2;
  const leadingProteinBand = analysis.leadingProteinBand
    ? BAND_LABELS[analysis.leadingProteinBand]
    : null;
  const leadingCalorieBand = analysis.bands.some((band) => band.calories > 0)
    ? [...analysis.bands].sort((left, right) => right.calories - left.calories)[0]
    : null;
  const firstPosition = {
    '--timing-position': markerPosition(analysis.typicalFirstMinutes),
  } as CSSProperties;
  const lastPosition = {
    '--timing-position': markerPosition(analysis.typicalLastMinutes),
  } as CSSProperties;

  return (
    <section className="timing-insights" aria-labelledby="timing-insights-title">
      <header className="timing-header">
        <div>
          <p>Meal timing</p>
          <h2 id="timing-insights-title">Your eating rhythm</h2>
        </div>
        <span>
          {analysis.loggedDays} logged day{analysis.loggedDays === 1 ? '' : 's'}
        </span>
      </header>

      {isSparse ? (
        <div className="timing-empty">
          <span className="section-icon small">
            <Clock3 aria-hidden="true" />
          </span>
          <div>
            <h3>
              {analysis.loggedDays ? 'One more day makes a rhythm' : 'A rhythm needs two days'}
            </h3>
            <p>
              {analysis.loggedDays
                ? 'Keep logging normally. Your first timing pattern appears after another logged day.'
                : 'Log food on two different days to see when your eating pattern usually begins and ends.'}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div
            className="timing-clock"
            role="img"
            aria-label={`Typical first food at ${formatClock(
              analysis.typicalFirstMinutes
            )}; typical last food at ${formatClock(analysis.typicalLastMinutes)}.`}
          >
            <div className="timing-clock-labels" aria-hidden="true">
              <span>Midnight</span>
              <span>Noon</span>
              <span>Midnight</span>
            </div>
            <div className="timing-rail" aria-hidden="true">
              <span className="timing-tick is-noon" />
              <span className="timing-marker is-first" style={firstPosition}>
                <Sunrise />
              </span>
              <span className="timing-marker is-last" style={lastPosition}>
                <MoonStar />
              </span>
            </div>
            <div className="timing-clock-values">
              <div>
                <Sunrise aria-hidden="true" />
                <span>Typical first food</span>
                <strong>{formatClock(analysis.typicalFirstMinutes)}</strong>
              </div>
              <div>
                <MoonStar aria-hidden="true" />
                <span>Typical last food</span>
                <strong>{formatClock(analysis.typicalLastMinutes)}</strong>
              </div>
            </div>
          </div>

          <dl className="timing-facts">
            <div>
              <dt>Eating window</dt>
              <dd>{formatDuration(analysis.averageEatingWindowMinutes)}</dd>
              <small>
                {analysis.eatingWindowDays} day{analysis.eatingWindowDays === 1 ? '' : 's'} with
                multiple entries
              </small>
            </div>
            <div>
              <dt>Near estimated sleep</dt>
              <dd>
                {analysis.nearSleepDays} of {analysis.loggedDays} days
              </dd>
              <small>
                Last food within 2 hr either side of {formatClock(analysis.sleepRoutineMinutes)}
              </small>
            </div>
            <div>
              <dt>Most logged food</dt>
              <dd>{analysis.mostLoggedFood?.name ?? '—'}</dd>
              <small>
                {analysis.mostLoggedFood
                  ? `${analysis.mostLoggedFood.entryCount} ${
                      analysis.mostLoggedFood.entryCount === 1 ? 'entry' : 'entries'
                    } · usually around ${formatClock(analysis.mostLoggedFood.typicalMinutes)}`
                  : 'No repeated food yet'}
              </small>
            </div>
          </dl>

          <div className="timing-distribution">
            <div className="timing-distribution-heading">
              <div>
                <Utensils aria-hidden="true" />
                <div>
                  <h3>When calories land</h3>
                  <p>
                    Most logged calories land{' '}
                    {leadingCalorieBand
                      ? BAND_LABELS[leadingCalorieBand.key].toLowerCase()
                      : 'across the day'}
                  </p>
                </div>
              </div>
              <span>{analysis.entryCount} entries</span>
            </div>
            <div
              className="timing-band-bar"
              role="img"
              aria-label={analysis.bands
                .map(
                  (band) =>
                    `${BAND_LABELS[band.key]} ${Math.round(band.calorieShare * 100)} percent`
                )
                .join(', ')}
            >
              {analysis.bands.map((band) => (
                <span
                  className={`timing-band is-${band.key}`}
                  key={band.key}
                  style={{ flexGrow: band.calories }}
                />
              ))}
            </div>
            <ul className="timing-band-legend">
              {analysis.bands.map((band) => (
                <li key={band.key}>
                  <span>
                    <i className={`is-${band.key}`} aria-hidden="true" />
                    {BAND_LABELS[band.key]}
                  </span>
                  <strong>{Math.round(band.calorieShare * 100)}%</strong>
                </li>
              ))}
            </ul>
            {leadingProteinBand ? (
              <p className="timing-protein-note">
                <Sprout aria-hidden="true" />
                The largest share of logged protein lands {leadingProteinBand.toLowerCase()}.
              </p>
            ) : null}
          </div>
        </>
      )}

      <p className="timing-footnote">
        Based on {rangeDays}-day logged entries only. Missing days are not counted, and these
        patterns do not establish cause and effect. Sleep time is estimated from your saved wake
        time and sleep duration.
      </p>
    </section>
  );
});

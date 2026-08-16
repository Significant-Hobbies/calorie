import { ChevronRight, Dumbbell, Moon, RotateCcw } from 'lucide-react';
import { minutesToTime } from '../../lib/recommendations';
import type { FastWindow, GymGuidance, SleepGuidance } from '../../lib/types';
import { formatDuration, formatTime } from './today-utils';

export function TodayTiming({
  gym,
  sleep,
  latestFast,
}: {
  gym: GymGuidance | null;
  sleep: SleepGuidance | null;
  latestFast: FastWindow | null;
}) {
  return (
    <section className="recommendations" aria-labelledby="timing-title">
      <div className="section-heading">
        <div>
          <h2 id="timing-title">Your timing</h2>
          <p>Useful estimates from today’s log.</p>
        </div>
      </div>

      <details className="recommendation-row">
        <summary>
          <span className="recommendation-icon">
            <Dumbbell aria-hidden="true" />
          </span>
          <span>
            <strong>Next best exercise window</strong>
            <small>
              {gym?.state === 'window'
                ? `${gym.carbsG} g carbs in ${gym.sourceEntry}`
                : 'No recent carb signal'}
            </small>
          </span>
          <b>
            {gym?.startAt && gym.endAt
              ? gym.phase === 'active'
                ? `Now–${formatTime(gym.endAt)}`
                : `${formatTime(gym.startAt)}–${formatTime(gym.endAt)}`
              : 'Any time'}
          </b>
          <ChevronRight aria-hidden="true" />
        </summary>
        <p>{gym?.explanation} This is a practical estimate, not a requirement.</p>
      </details>

      <details className="recommendation-row">
        <summary>
          <span className="recommendation-icon">
            <Moon aria-hidden="true" />
          </span>
          <span>
            <strong>Wind down after</strong>
            <small>Routine + last food</small>
          </span>
          <b>{sleep ? minutesToTime(sleep.recommendedMinutes) : '—'}</b>
          <ChevronRight aria-hidden="true" />
        </summary>
        <p>{sleep?.explanation} Adjust this if your body or clinician tells you differently.</p>
      </details>

      <div className="fast-count">
        <span>
          <RotateCcw aria-hidden="true" />
        </span>
        <div>
          <strong>{latestFast ? formatDuration(latestFast.durationHours) : '—'}</strong>
          <small>
            {latestFast
              ? `Latest fasting window · ${formatTime(latestFast.startAt)}–${formatTime(latestFast.endAt)}`
              : 'Your last food and next first food set this automatically'}
          </small>
        </div>
      </div>
    </section>
  );
}

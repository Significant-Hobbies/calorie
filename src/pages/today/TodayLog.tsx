import { Leaf, Plus } from 'lucide-react';
import { DailyScoreBadge } from '../../components/DailyScoreBadge';
import { EntryTrackedQualityBadge } from '../../components/EntryTrackedQualityBadge';
import { calculateDailyScore, calculateEntryTrackedQuality } from '../../lib/nutrient-density';
import type { Dashboard, FoodEntry } from '../../lib/types';
import { formatTime } from './today-utils';

export function TodayLog({
  dashboard,
  onOpenNewEntry,
  onOpenEntry,
}: {
  dashboard: Dashboard;
  onOpenNewEntry: () => void;
  onOpenEntry: (entry: FoodEntry) => void;
}) {
  const dailyScore = calculateDailyScore({
    entries: dashboard.entries,
    foods: dashboard.foods,
    target: dashboard.target,
    isCurrentDay: true,
  });

  return (
    <section className="today-log" aria-labelledby="today-log-title">
      <div className="section-heading">
        <div>
          <h2 id="today-log-title">Today’s log</h2>
          <p>
            {dashboard.entries.length} food entr
            {dashboard.entries.length === 1 ? 'y' : 'ies'}
          </p>
        </div>
        <button
          className="button button-primary button-compact"
          type="button"
          onClick={onOpenNewEntry}
        >
          <Plus size={18} aria-hidden="true" />
          Add entry
        </button>
      </div>
      {dashboard.entries.length ? (
        <div className="daily-menu-quality daily-score-summary">
          <div>
            <strong>{dailyScore.label}</strong>
            <span>
              Based on {dashboard.entries.length} logged food{' '}
              {dashboard.entries.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>
          <DailyScoreBadge result={dailyScore} />
        </div>
      ) : null}
      {dashboard.entries.length ? (
        <div className="entry-list">
          {dashboard.entries.map((entry) => {
            const tracked = calculateEntryTrackedQuality(entry, dashboard.foods);
            const score =
              tracked.quality.score === null
                ? 'tracked score unavailable'
                : `${tracked.quality.score} of 100 tracked`;
            return (
              <button
                className="entry-row"
                key={entry.id}
                type="button"
                aria-label={`Edit ${entry.foodName}, ${formatTime(entry.eatenAt)}, ${score}, ${tracked.basisLabel}`}
                onClick={() => onOpenEntry(entry)}
              >
                <time dateTime={new Date(entry.eatenAt).toISOString()}>
                  {formatTime(entry.eatenAt)}
                </time>
                <span className="entry-dot" />
                <div>
                  <strong>{entry.foodName}</strong>
                  <span>
                    {entry.amount} {entry.unitLabel} · {Math.round(entry.carbsG)}C ·{' '}
                    {Math.round(entry.proteinG)}P · {Math.round(entry.fibreG)}F
                  </span>
                  <EntryTrackedQualityBadge entry={entry} foods={dashboard.foods} />
                </div>
                <b>{Math.round(entry.calories)} kcal</b>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="empty-inline">
          <Leaf aria-hidden="true" />
          <div>
            <strong>Nothing logged yet</strong>
            <span>Tap a usual food above, or add a one-off entry.</span>
          </div>
        </div>
      )}
    </section>
  );
}

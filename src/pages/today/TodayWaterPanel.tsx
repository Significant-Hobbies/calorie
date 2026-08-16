import { Droplets, Pencil, Plus, Trash2 } from 'lucide-react';
import type { WaterEntry } from '../../lib/types';
import { formatTime } from './today-utils';

export function TodayWaterPanel({
  summary,
  editor,
  handlers,
}: {
  summary: {
    waterMl: number;
    waterTargetMl: number;
    waterPercent: number;
    waterBarProgress: number;
    waterEntries: WaterEntry[];
  };
  editor: {
    pendingId: string | null;
    editingWaterId: string | null;
    waterAmount: string;
    waterTime: string;
  };
  handlers: {
    onQuickWater: (amountMl: number) => void;
    onBeginEdit: (entry: WaterEntry) => void;
    onAmountChange: (value: string) => void;
    onTimeChange: (value: string) => void;
    onSaveEdit: () => void;
    onCancelEdit: () => void;
    onRemove: (entry: WaterEntry) => void;
  };
}) {
  const { waterMl, waterTargetMl, waterPercent, waterBarProgress, waterEntries } = summary;
  const { pendingId, editingWaterId, waterAmount, waterTime } = editor;
  const {
    onQuickWater,
    onBeginEdit,
    onAmountChange,
    onTimeChange,
    onSaveEdit,
    onCancelEdit,
    onRemove,
  } = handlers;
  return (
    <section className="water-panel" aria-labelledby="water-title">
      <div className="water-main">
        <span className="water-icon">
          <Droplets aria-hidden="true" />
        </span>
        <div>
          <h2 id="water-title">Water</h2>
          <strong>
            {waterMl.toLocaleString()}
            <small> / {waterTargetMl.toLocaleString()} ml target</small>
          </strong>
        </div>
        <span className="water-percent">{Math.round(waterPercent)}%</span>
      </div>
      <div className="water-track" aria-hidden="true">
        <span style={{ width: `${waterBarProgress}%` }} />
      </div>
      <fieldset className="water-presets">
        <legend className="sr-only">Quick log water</legend>
        {[250, 350, 500].map((amount) => (
          <button
            key={amount}
            type="button"
            disabled={Boolean(pendingId)}
            onClick={() => onQuickWater(amount)}
          >
            <Plus size={16} aria-hidden="true" />
            {amount} ml
          </button>
        ))}
      </fieldset>
      <section className="water-log" aria-label="Today’s water check-ins">
        <div className="water-log-heading">
          <strong>Today’s check-ins</strong>
          <small>{waterEntries.length} logged</small>
        </div>
        {waterEntries.length ? (
          waterEntries.map((entry) =>
            editingWaterId === entry.id ? (
              <div className="water-log-editor" key={entry.id}>
                <label>
                  <span className="sr-only">Water amount in millilitres</span>
                  <input
                    type="number"
                    min="1"
                    max="5000"
                    value={waterAmount}
                    onChange={(event) => onAmountChange(event.target.value)}
                  />
                </label>
                <label>
                  <span className="sr-only">Water check-in time</span>
                  <input
                    type="datetime-local"
                    value={waterTime}
                    onChange={(event) => onTimeChange(event.target.value)}
                  />
                </label>
                <button
                  className="button button-primary button-compact"
                  type="button"
                  onClick={onSaveEdit}
                >
                  Save
                </button>
                <button className="button button-quiet" type="button" onClick={onCancelEdit}>
                  Cancel
                </button>
              </div>
            ) : (
              <div className="water-log-row" key={entry.id}>
                <span>
                  <strong>{entry.amountMl.toLocaleString()} ml</strong>
                  <small>{formatTime(entry.drankAt)}</small>
                </span>
                <button
                  className="button button-quiet"
                  type="button"
                  aria-label={`Edit ${entry.amountMl} ml water check-in`}
                  onClick={() => onBeginEdit(entry)}
                >
                  <Pencil aria-hidden="true" />
                </button>
                <button
                  className="button button-quiet danger-button"
                  type="button"
                  aria-label={`Remove ${entry.amountMl} ml water check-in`}
                  onClick={() => onRemove(entry)}
                >
                  <Trash2 aria-hidden="true" />
                </button>
              </div>
            )
          )
        ) : (
          <p className="water-log-empty">
            No water yet. A quick amount above is the fastest start.
          </p>
        )}
      </section>
    </section>
  );
}

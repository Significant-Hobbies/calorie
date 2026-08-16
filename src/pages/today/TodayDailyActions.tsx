import { Apple, ChevronRight, Droplets, Pill, Scale } from 'lucide-react';
import type { RefObject } from 'react';
import type { DailyActionKey, getDailyActionState } from '../../lib/daily-actions';
import type { Units } from '../../lib/types';

export function TodayDailyActions({
  actions,
  weight,
  onAction,
  onWeight,
}: {
  actions: {
    incomplete: DailyActionKey[];
    state: ReturnType<typeof getDailyActionState> | null;
    pendingId: string | null;
    sectionRef: RefObject<HTMLElement | null>;
  };
  weight: {
    editorOpen: boolean;
    value: string;
    units: Units;
    inputRef: RefObject<HTMLInputElement | null>;
  };
  onAction: (action: DailyActionKey) => void;
  onWeight: {
    onValueChange: (value: string) => void;
    onCancel: () => void;
    onSave: () => void;
  };
}) {
  const {
    incomplete: incompleteActions,
    state: dailyActionState,
    pendingId,
    sectionRef: dailyActionsRef,
  } = actions;
  const {
    editorOpen: weightEditorOpen,
    value: weightValue,
    units,
    inputRef: weightInputRef,
  } = weight;
  const {
    onValueChange: onWeightValueChange,
    onCancel: onCancelWeight,
    onSave: onSaveWeight,
  } = onWeight;
  if (!incompleteActions.length) return null;

  return (
    <section className="daily-actions" aria-labelledby="daily-actions-title" ref={dailyActionsRef}>
      <div className="daily-actions-heading">
        <div>
          <p>Daily basics</p>
          <h2 id="daily-actions-title">Up next</h2>
        </div>
      </div>

      <div className="daily-action-grid">
        {incompleteActions.map((action) => {
          const details = {
            weight: { label: 'Check in weight', hint: 'Today’s measurement', Icon: Scale },
            creatine: {
              label: dailyActionState?.creatineRoutine ? 'Log creatine' : 'Set up creatine',
              hint: dailyActionState?.creatineRoutine ? 'One-tap check-in' : 'Create the routine',
              Icon: Pill,
            },
            food: { label: 'Log food', hint: 'Add your first meal', Icon: Apple },
            water: { label: 'Add water', hint: '+250 ml', Icon: Droplets },
          }[action];
          const Icon = details.Icon;
          return (
            <button
              className={`daily-action daily-action-${action}`}
              type="button"
              key={action}
              disabled={Boolean(pendingId)}
              onClick={() => onAction(action)}
            >
              <span>
                <Icon size={21} aria-hidden="true" />
              </span>
              <span>
                <strong>{details.label}</strong>
                <small>{details.hint}</small>
              </span>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          );
        })}
      </div>

      {weightEditorOpen ? (
        <form
          className="weight-quick-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSaveWeight();
          }}
        >
          <label className="field">
            <span>Today’s weight</span>
            <div className="input-with-unit">
              <input
                ref={weightInputRef}
                type="number"
                inputMode="decimal"
                step="0.1"
                value={weightValue}
                onChange={(event) => onWeightValueChange(event.target.value)}
              />
              <b>{units === 'imperial' ? 'lb' : 'kg'}</b>
            </div>
          </label>
          <div>
            <button className="button button-secondary" type="button" onClick={onCancelWeight}>
              Cancel
            </button>
            <button className="button button-primary" type="submit" disabled={Boolean(pendingId)}>
              Check in
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

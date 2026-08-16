import { Check, Clock3, Plus, Save, Trash2, X } from 'lucide-react';
import type { KeyboardEvent, RefObject } from 'react';
import { NutrientDensityBadge } from '../../components/NutrientDensityBadge';
import { scaleNutrients } from '../../lib/recommendations';
import type { Dashboard } from '../../lib/types';
import { type EntryDraft, toLocalInput } from './today-utils';

export function TodayEntrySheet({
  dashboard,
  entryDraft,
  entryError,
  pendingId,
  entrySheetBackdropRef,
  entrySheetRef,
  entryFoodSelectRef,
  entryNameInputRef,
  onKeyDown,
  onClose,
  onChooseMode,
  onChooseFood,
  onDraftChange,
  onClearEntryError,
  onSave,
  onRemove,
}: {
  dashboard: Dashboard;
  entryDraft: EntryDraft;
  entryError: string | null;
  pendingId: string | null;
  entrySheetBackdropRef: RefObject<HTMLDivElement | null>;
  entrySheetRef: RefObject<HTMLElement | null>;
  entryFoodSelectRef: RefObject<HTMLSelectElement | null>;
  entryNameInputRef: RefObject<HTMLInputElement | null>;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  onClose: () => void;
  onChooseMode: (mode: EntryDraft['mode']) => void;
  onChooseFood: (foodId: string) => void;
  onDraftChange: (updater: (current: EntryDraft) => EntryDraft) => void;
  onClearEntryError: () => void;
  onSave: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="sheet-backdrop" ref={entrySheetBackdropRef}>
      <section
        className="edit-sheet entry-sheet"
        ref={entrySheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-sheet-title"
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className="sheet-handle" aria-hidden="true" />
        <header>
          <div>
            <p>{entryDraft.entryId ? 'Correct your log' : 'Add to today'}</p>
            <h2 id="entry-sheet-title">{entryDraft.entryId ? 'Edit entry' : 'New entry'}</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="Close food entry"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>

        <div className="sheet-fields">
          <fieldset className="segmented entry-source-toggle">
            <legend className="sr-only">Entry source</legend>
            <button
              className={
                entryDraft.mode === 'saved' ||
                (dashboard.foods.length === 0 && entryDraft.saveForLater)
                  ? 'is-selected'
                  : ''
              }
              type="button"
              aria-pressed={
                entryDraft.mode === 'saved' ||
                (dashboard.foods.length === 0 && entryDraft.saveForLater)
              }
              onClick={() => {
                if (dashboard.foods.length) {
                  onChooseMode('saved');
                  return;
                }
                onClearEntryError();
                onDraftChange((current) => ({
                  ...current,
                  mode: 'direct',
                  foodId: null,
                  saveForLater: true,
                }));
              }}
            >
              {dashboard.foods.length ? 'Saved food' : 'Save new food'}
            </button>
            <button
              className={
                entryDraft.mode === 'direct' &&
                (dashboard.foods.length > 0 || !entryDraft.saveForLater)
                  ? 'is-selected'
                  : ''
              }
              type="button"
              aria-pressed={
                entryDraft.mode === 'direct' &&
                (dashboard.foods.length > 0 || !entryDraft.saveForLater)
              }
              onClick={() => {
                onChooseMode('direct');
                onDraftChange((current) =>
                  current.mode === 'direct' ? { ...current, saveForLater: false } : current
                );
              }}
            >
              Just this entry
            </button>
          </fieldset>

          {entryDraft.mode === 'saved' ? (
            <>
              <label className="field">
                <span>Saved food</span>
                <select
                  ref={entryFoodSelectRef}
                  value={entryDraft.foodId ?? ''}
                  onChange={(event) => onChooseFood(event.target.value)}
                >
                  {!entryDraft.foodId ? <option value="">Choose a food</option> : null}
                  {dashboard.foods.map((food) => (
                    <option value={food.id} key={food.id}>
                      {food.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="field-row">
                <label className="field">
                  <span>Amount</span>
                  <div className="input-with-unit">
                    <input
                      type="number"
                      min="0.1"
                      max="10000"
                      step="0.1"
                      inputMode="decimal"
                      value={entryDraft.amount}
                      onChange={(event) =>
                        onDraftChange((current) => ({
                          ...current,
                          amount: Number(event.target.value) || 0,
                        }))
                      }
                    />
                    <b>
                      {dashboard.foods.find((food) => food.id === entryDraft.foodId)
                        ?.servingMode === 'per_100g'
                        ? 'g'
                        : (dashboard.foods.find((food) => food.id === entryDraft.foodId)
                            ?.unitLabel ?? 'unit')}
                    </b>
                  </div>
                </label>
                <label className="field">
                  <span>Time eaten</span>
                  <div className="input-with-leading-icon">
                    <Clock3 size={17} aria-hidden="true" />
                    <input
                      type="datetime-local"
                      max={toLocalInput(Date.now() + 24 * 60 * 60 * 1000)}
                      value={entryDraft.eatenAt}
                      onChange={(event) =>
                        onDraftChange((current) => ({ ...current, eatenAt: event.target.value }))
                      }
                    />
                  </div>
                </label>
              </div>

              {entryDraft.foodId ? (
                <div className="entry-preview">
                  {(() => {
                    const food = dashboard.foods.find((item) => item.id === entryDraft.foodId);
                    if (!food) return null;
                    const preview = scaleNutrients(food, food.servingMode, entryDraft.amount);
                    return (
                      <>
                        <strong>{preview.calories} kcal</strong>
                        <span>
                          {preview.carbsG}g carbs · {preview.proteinG}g protein · {preview.fibreG}g
                          fibre
                        </span>
                      </>
                    );
                  })()}
                </div>
              ) : null}
            </>
          ) : (
            <>
              <p className="direct-entry-note">
                {entryDraft.saveForLater
                  ? 'This serving will be saved for future one-tap logging.'
                  : 'Add the totals once. This won’t create a saved food.'}
              </p>
              <button
                className={`save-food-toggle${entryDraft.saveForLater ? ' is-selected' : ''}`}
                type="button"
                aria-pressed={entryDraft.saveForLater}
                onClick={() =>
                  onDraftChange((current) => ({ ...current, saveForLater: !current.saveForLater }))
                }
              >
                <span>
                  {entryDraft.saveForLater ? (
                    <Check size={18} aria-hidden="true" />
                  ) : (
                    <Plus size={18} aria-hidden="true" />
                  )}
                </span>
                <span>
                  <strong>Save this food for next time</strong>
                  <small>Its current serving and nutrients become a reusable shortcut.</small>
                </span>
              </button>
              <label className="field">
                <span>Food name</span>
                <input
                  ref={entryNameInputRef}
                  maxLength={80}
                  placeholder="e.g. Lunch special"
                  value={entryDraft.foodName}
                  onChange={(event) =>
                    onDraftChange((current) => ({ ...current, foodName: event.target.value }))
                  }
                />
              </label>

              <div className="field-row">
                <label className="field">
                  <span>Packaging</span>
                  <select
                    value={entryDraft.isPackaged ? 'packaged' : 'not-packaged'}
                    onChange={(event) =>
                      onDraftChange((current) => ({
                        ...current,
                        isPackaged: event.target.value === 'packaged',
                      }))
                    }
                  >
                    <option value="not-packaged">Not packaged</option>
                    <option value="packaged">Packaged</option>
                  </select>
                </label>
                <label className="field">
                  <span>
                    Labels <small>Optional</small>
                  </span>
                  <input
                    value={entryDraft.labels.join(', ')}
                    placeholder="late snack, protein"
                    onChange={(event) =>
                      onDraftChange((current) => ({
                        ...current,
                        labels: event.target.value.split(','),
                      }))
                    }
                  />
                </label>
              </div>

              <div className="field-row">
                <label className="field">
                  <span>Amount</span>
                  <input
                    type="number"
                    min="0.1"
                    max="10000"
                    step="0.1"
                    inputMode="decimal"
                    value={entryDraft.amount}
                    onChange={(event) =>
                      onDraftChange((current) => ({
                        ...current,
                        amount: Number(event.target.value) || 0,
                      }))
                    }
                  />
                </label>
                <label className="field">
                  <span>Unit</span>
                  <input
                    maxLength={24}
                    placeholder="serving"
                    value={entryDraft.unitLabel}
                    onChange={(event) =>
                      onDraftChange((current) => ({ ...current, unitLabel: event.target.value }))
                    }
                  />
                </label>
              </div>

              <fieldset className="field macro-fieldset">
                <legend>Totals for this entry</legend>
                <div className="macro-grid">
                  {(
                    [
                      ['calories', 'Calories', '1'],
                      ['carbsG', 'Carbs (g)', '0.1'],
                      ['proteinG', 'Protein (g)', '0.1'],
                      ['fibreG', 'Fibre (g)', '0.1'],
                    ] as const
                  ).map(([key, label, step]) => (
                    <label className="field" key={key}>
                      <span>{label}</span>
                      <input
                        type="number"
                        min="0"
                        max="100000"
                        step={step}
                        inputMode="decimal"
                        value={entryDraft[key] || ''}
                        onChange={(event) =>
                          onDraftChange((current) => ({
                            ...current,
                            [key]: Number(event.target.value) || 0,
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="nutrient-density-preview is-compact">
                <NutrientDensityBadge nutrients={entryDraft} showBasis />
                <p>
                  This score uses only tracked protein and fibre per calorie, not overall health
                  quality.
                </p>
              </div>

              <label className="field">
                <span>Time eaten</span>
                <div className="input-with-leading-icon">
                  <Clock3 size={17} aria-hidden="true" />
                  <input
                    type="datetime-local"
                    max={toLocalInput(Date.now() + 24 * 60 * 60 * 1000)}
                    value={entryDraft.eatenAt}
                    onChange={(event) =>
                      onDraftChange((current) => ({ ...current, eatenAt: event.target.value }))
                    }
                  />
                </div>
              </label>
            </>
          )}
        </div>

        {entryError ? (
          <p className="form-error" role="alert">
            {entryError}
          </p>
        ) : null}

        <footer>
          {entryDraft.entryId ? (
            <button
              className="button button-danger"
              type="button"
              disabled={Boolean(pendingId)}
              onClick={onRemove}
            >
              <Trash2 size={18} aria-hidden="true" />
              Remove
            </button>
          ) : (
            <span />
          )}
          <button
            className="button button-primary"
            type="button"
            disabled={Boolean(pendingId)}
            onClick={onSave}
          >
            <Save size={18} aria-hidden="true" />
            {pendingId ? 'Saving…' : 'Save entry'}
          </button>
        </footer>
      </section>
    </div>
  );
}

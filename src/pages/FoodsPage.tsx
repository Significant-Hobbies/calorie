import { Apple, Archive, Pencil, Plus, RotateCcw, Search, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NutrientDensityBadge } from '../components/NutrientDensityBadge';
import { createFood, deleteFood, getFoods, saveFood, setFoodArchived } from '../lib/api';
import { normalizeFoodLabels } from '../lib/food-context';
import type { FoodLifecycle } from '../lib/food-library';
import { type FoodSortKey, sortFoods } from '../lib/food-sorting';
import type { Food, ServingMode } from '../lib/types';

type SortOption = { key: FoodSortKey; label: string; hint: string };

const SORT_OPTIONS: SortOption[] = [
  { key: 'recent', label: 'Recent', hint: 'Last used first' },
  { key: 'name', label: 'Name', hint: 'A to Z' },
  { key: 'protein', label: 'Protein', hint: 'Most protein per saved basis' },
  { key: 'fibre', label: 'Fibre', hint: 'Most fibre per saved basis' },
];

const emptyFood = (): Food => ({
  id: crypto.randomUUID(),
  name: '',
  servingMode: 'per_unit',
  unitLabel: 'serving',
  defaultAmount: 1,
  calories: 0,
  carbsG: 0,
  proteinG: 0,
  fibreG: 0,
  favourite: true,
  lastUsedAt: null,
  archivedAt: null,
  isPackaged: false,
  labels: [],
});

function nutrientSummary(food: Food) {
  const basis = food.servingMode === 'per_100g' ? 'per 100 g' : `per ${food.unitLabel || 'unit'}`;
  return `${Math.round(food.calories)} kcal · ${Math.round(food.carbsG)}C · ${Math.round(food.proteinG)}P · ${Math.round(food.fibreG)}F · ${basis}`;
}

export function FoodsPage({ cloudRevision }: { cloudRevision: number }) {
  const [foods, setFoods] = useState<Food[]>([]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<FoodSortKey>('recent');
  const [lifecycle, setLifecycle] = useState<FoodLifecycle>('active');
  const [draft, setDraft] = useState<Food | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const foodSheetOpen = draft !== null;

  const loadFoods = useCallback((status: FoodLifecycle) => {
    setLoading(true);
    setError(null);
    void getFoods(status)
      .then(setFoods)
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : 'Foods could not load.')
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => loadFoods(lifecycle), [lifecycle, loadFoods, cloudRevision]);

  useEffect(() => {
    if (foodSheetOpen) nameInputRef.current?.focus();
  }, [foodSheetOpen]);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    const matched = foods.filter(
      (food) =>
        !term ||
        food.name.toLocaleLowerCase().includes(term) ||
        food.labels?.some((label) => label.includes(term))
    );
    return sortFoods(matched, sort);
  }, [foods, query, sort]);

  const openNew = () => {
    setIsNew(true);
    setDraft(emptyFood());
    setError(null);
    setNameError(null);
    setConfirmArchive(false);
  };

  const openEdit = (food: Food) => {
    setIsNew(false);
    setDraft({ ...food });
    setError(null);
    setNameError(null);
    setConfirmArchive(false);
  };

  const submit = async () => {
    if (!draft?.name.trim()) {
      setNameError('Give this food a name.');
      return;
    }
    if (
      [draft.calories, draft.carbsG, draft.proteinG, draft.fibreG].some(
        (value) => value < 0 || !Number.isFinite(value)
      )
    ) {
      setError('Macros need to be zero or more.');
      return;
    }
    if (draft.defaultAmount <= 0 || !Number.isFinite(draft.defaultAmount)) {
      setError('The quick-log amount needs to be above zero.');
      return;
    }

    setSaving(true);
    setError(null);
    setNameError(null);
    try {
      const normalized = {
        ...draft,
        name: draft.name.trim(),
        unitLabel: draft.servingMode === 'per_100g' ? 'g' : draft.unitLabel.trim() || 'unit',
        labels: normalizeFoodLabels(draft.labels),
      };
      const saved = isNew ? await createFood(normalized) : await saveFood(normalized);
      setFoods((current) =>
        isNew ? [saved, ...current] : current.map((food) => (food.id === saved.id ? saved : food))
      );
      setDraft(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Food could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const archive = async () => {
    if (!draft || isNew) return;
    setSaving(true);
    setError(null);
    try {
      await setFoodArchived(draft, Date.now());
      setFoods((current) => current.filter((food) => food.id !== draft.id));
      setDraft(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Food could not be archived.');
    } finally {
      setSaving(false);
    }
  };

  const restore = async (food: Food) => {
    setSaving(true);
    setError(null);
    try {
      await setFoodArchived(food, null);
      setFoods((current) => current.filter((item) => item.id !== food.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Food could not be restored.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (food: Food) => {
    setSaving(true);
    setError(null);
    try {
      await deleteFood(food.id);
      setFoods((current) => current.filter((item) => item.id !== food.id));
      setConfirmDeleteId(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Food could not be permanently deleted.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-stack">
      <header className="page-heading split-heading">
        <div>
          <p>Your library</p>
          <h1>{lifecycle === 'active' ? 'Saved foods' : 'Archived foods'}</h1>
          <span>
            {lifecycle === 'active'
              ? 'Keep your everyday foods ready for one-tap logging.'
              : 'Restore foods whenever they return to your routine.'}
          </span>
        </div>
        {lifecycle === 'active' ? (
          <button className="button button-primary compact-button" type="button" onClick={openNew}>
            <Plus size={18} aria-hidden="true" />
            Add food
          </button>
        ) : null}
      </header>

      <fieldset className="segmented library-tabs">
        <legend className="sr-only">Food library view</legend>
        {(['active', 'archived'] as FoodLifecycle[]).map((status) => (
          <button
            type="button"
            key={status}
            className={lifecycle === status ? 'is-selected' : ''}
            aria-pressed={lifecycle === status}
            onClick={() => {
              setLifecycle(status);
              setConfirmDeleteId(null);
            }}
          >
            {status === 'active' ? 'Active' : 'Archived'}
          </button>
        ))}
      </fieldset>

      <label className="search-field">
        <Search size={19} aria-hidden="true" />
        <span className="sr-only">Search saved foods</span>
        <input
          type="search"
          placeholder="Search oats, dal, banana…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {query ? (
          <button type="button" aria-label="Clear search" onClick={() => setQuery('')}>
            <X size={18} />
          </button>
        ) : null}
      </label>

      {lifecycle === 'active' ? (
        <fieldset className="sort-bar" aria-label="Sort foods">
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              className={sort === option.key ? 'is-selected' : ''}
              aria-pressed={sort === option.key}
              title={option.hint}
              onClick={() => setSort(option.key)}
            >
              {option.label}
            </button>
          ))}
        </fieldset>
      ) : null}

      {error && !draft ? (
        <div className="inline-error" role="alert">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="food-list" aria-busy="true">
          <div className="skeleton list-skeleton" />
          <div className="skeleton list-skeleton" />
          <div className="skeleton list-skeleton" />
        </div>
      ) : filtered.length ? (
        <section className="food-list" aria-label={`${lifecycle} foods`}>
          {filtered.map((food) =>
            lifecycle === 'active' ? (
              <button
                className="food-row"
                key={food.id}
                type="button"
                onClick={() => openEdit(food)}
              >
                <span className="food-glyph">
                  <Apple aria-hidden="true" />
                </span>
                <span className="food-row-copy">
                  <strong>{food.name}</strong>
                  <small>{nutrientSummary(food)}</small>
                  <NutrientDensityBadge nutrients={food} />
                  <span className="food-context-line">
                    {food.isPackaged ? 'Packaged' : 'Not packaged'}
                    {food.labels?.length ? ` · ${food.labels.join(' · ')}` : ''}
                  </span>
                </span>
                <Pencil size={17} aria-hidden="true" />
              </button>
            ) : (
              <div className="food-row archived-food-row" key={food.id}>
                <span className="food-glyph">
                  <Archive aria-hidden="true" />
                </span>
                <span className="food-row-copy">
                  <strong>{food.name}</strong>
                  <small>{nutrientSummary(food)}</small>
                  <NutrientDensityBadge nutrients={food} />
                </span>
                <span className="archived-food-actions">
                  <button
                    className="icon-button subtle"
                    type="button"
                    disabled={saving}
                    aria-label={`Restore ${food.name}`}
                    onClick={() => void restore(food)}
                  >
                    <RotateCcw size={17} aria-hidden="true" />
                  </button>
                  <button
                    className="icon-button subtle danger-icon"
                    type="button"
                    disabled={saving}
                    aria-label={`Permanently delete ${food.name}`}
                    onClick={() => setConfirmDeleteId(food.id)}
                  >
                    <Trash2 size={17} aria-hidden="true" />
                  </button>
                </span>
                {confirmDeleteId === food.id ? (
                  <div className="archive-delete-confirmation" role="alert">
                    <span>Delete permanently? Earlier log entries will keep their snapshots.</span>
                    <span>
                      <button type="button" onClick={() => setConfirmDeleteId(null)}>
                        Cancel
                      </button>
                      <button type="button" disabled={saving} onClick={() => void remove(food)}>
                        Delete
                      </button>
                    </span>
                  </div>
                ) : null}
              </div>
            )
          )}
        </section>
      ) : (
        <section className="empty-state compact-empty">
          {lifecycle === 'active' ? <Apple aria-hidden="true" /> : <Archive aria-hidden="true" />}
          <h2>
            {query
              ? 'No matching foods'
              : lifecycle === 'active'
                ? 'Save your first regular'
                : 'Nothing archived'}
          </h2>
          <p>
            {query
              ? lifecycle === 'active'
                ? 'Try another name, or add it as a new food.'
                : 'Try another archived food name.'
              : lifecycle === 'active'
                ? 'Store its macros once, then log it from Today with one tap.'
                : 'Foods you archive will wait here until you restore them.'}
          </p>
          {lifecycle === 'active' ? (
            <button className="button button-secondary" type="button" onClick={openNew}>
              <Plus size={18} aria-hidden="true" />
              Add food
            </button>
          ) : null}
        </section>
      )}

      {draft ? (
        <div className="sheet-backdrop">
          <section
            className="edit-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="food-sheet-title"
          >
            <div className="sheet-handle" aria-hidden="true" />
            <header>
              <div>
                <p>{isNew ? 'New shortcut' : 'Edit shortcut'}</p>
                <h2 id="food-sheet-title">{isNew ? 'Save a food' : draft.name}</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="Close food editor"
                onClick={() => setDraft(null)}
              >
                <X size={20} />
              </button>
            </header>

            <div className="sheet-fields">
              <label className="field">
                <span>Food name</span>
                <input
                  ref={nameInputRef}
                  value={draft.name}
                  placeholder="e.g. Masala oats"
                  aria-invalid={Boolean(nameError)}
                  aria-describedby={nameError ? 'food-name-error' : undefined}
                  onChange={(event) => {
                    setNameError(null);
                    setDraft((current) =>
                      current ? { ...current, name: event.target.value } : current
                    );
                  }}
                />
                {nameError ? (
                  <small className="field-error" id="food-name-error">
                    {nameError}
                  </small>
                ) : null}
              </label>

              <div className="field-row">
                <label className="field">
                  <span>Packaging</span>
                  <select
                    value={draft.isPackaged ? 'packaged' : 'not-packaged'}
                    onChange={(event) =>
                      setDraft((current) =>
                        current
                          ? { ...current, isPackaged: event.target.value === 'packaged' }
                          : current
                      )
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
                    value={draft.labels?.join(', ') ?? ''}
                    placeholder="breakfast, high protein"
                    onChange={(event) =>
                      setDraft((current) =>
                        current ? { ...current, labels: event.target.value.split(',') } : current
                      )
                    }
                  />
                </label>
              </div>

              <fieldset className="field">
                <legend>Macros are saved</legend>
                <div className="segmented">
                  {(
                    [
                      ['per_unit', 'Per unit'],
                      ['per_100g', 'Per 100 g'],
                    ] as Array<[ServingMode, string]>
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      className={draft.servingMode === mode ? 'is-selected' : ''}
                      aria-pressed={draft.servingMode === mode}
                      onClick={() =>
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                servingMode: mode,
                                unitLabel: mode === 'per_100g' ? 'g' : 'serving',
                                defaultAmount: mode === 'per_100g' ? 100 : 1,
                              }
                            : current
                        )
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>

              {draft.servingMode === 'per_unit' ? (
                <label className="field">
                  <span>Unit name</span>
                  <input
                    value={draft.unitLabel}
                    placeholder="bowl, banana, scoop…"
                    onChange={(event) =>
                      setDraft((current) =>
                        current ? { ...current, unitLabel: event.target.value } : current
                      )
                    }
                  />
                </label>
              ) : null}

              <div className="macro-grid">
                {(
                  [
                    ['calories', 'Calories', 'kcal'],
                    ['carbsG', 'Carbs', 'g'],
                    ['proteinG', 'Protein', 'g'],
                    ['fibreG', 'Fibre', 'g'],
                  ] as const
                ).map(([key, label, unit]) => (
                  <label className="field" key={key}>
                    <span>{label}</span>
                    <div className="input-with-unit">
                      <input
                        type="number"
                        min="0"
                        step={key === 'calories' ? '1' : '0.1'}
                        inputMode="decimal"
                        value={draft[key] || ''}
                        onChange={(event) =>
                          setDraft((current) =>
                            current
                              ? { ...current, [key]: Number(event.target.value) || 0 }
                              : current
                          )
                        }
                      />
                      <b>{unit}</b>
                    </div>
                  </label>
                ))}
              </div>

              <div className="nutrient-density-preview">
                <NutrientDensityBadge nutrients={draft} showBasis />
                <p>
                  This score uses tracked protein and fibre per calorie. It does not assess
                  ingredients, vitamins, minerals, sodium, added sugars, fat quality, dietary
                  variety, or overall health quality.
                </p>
              </div>

              <label className="field">
                <span>One-tap amount</span>
                <div className="input-with-unit">
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    inputMode="decimal"
                    value={draft.defaultAmount}
                    onChange={(event) =>
                      setDraft((current) =>
                        current
                          ? { ...current, defaultAmount: Number(event.target.value) || 0 }
                          : current
                      )
                    }
                  />
                  <b>{draft.servingMode === 'per_100g' ? 'g' : draft.unitLabel || 'unit'}</b>
                </div>
              </label>
            </div>

            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}

            {confirmArchive ? (
              <div className="delete-confirmation" role="alert">
                <span>
                  Archive <strong>{draft.name}</strong>? It leaves logging shortcuts, while earlier
                  entries stay in your history.
                </span>
                <button type="button" onClick={() => setConfirmArchive(false)}>
                  Cancel
                </button>
              </div>
            ) : null}

            <footer>
              {!isNew ? (
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={saving}
                  onClick={() => (confirmArchive ? void archive() : setConfirmArchive(true))}
                >
                  <Archive size={18} aria-hidden="true" />
                  {confirmArchive ? 'Yes, archive' : 'Archive'}
                </button>
              ) : (
                <span />
              )}
              <button
                className="button button-primary"
                type="button"
                disabled={saving}
                onClick={() => void submit()}
              >
                {saving ? 'Saving…' : 'Save food'}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}

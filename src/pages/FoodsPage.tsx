import { Apple, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createFood, deleteFood, getDashboard, saveFood } from '../lib/api';
import type { Food, ServingMode } from '../lib/types';

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
});

function nutrientSummary(food: Food) {
  const basis = food.servingMode === 'per_100g' ? 'per 100 g' : `per ${food.unitLabel || 'unit'}`;
  return `${Math.round(food.calories)} kcal · ${Math.round(food.carbsG)}C · ${Math.round(food.proteinG)}P · ${Math.round(food.fibreG)}F · ${basis}`;
}

export function FoodsPage() {
  const [foods, setFoods] = useState<Food[]>([]);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<Food | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const foodSheetOpen = draft !== null;

  useEffect(() => {
    void getDashboard()
      .then((dashboard) => setFoods(dashboard.foods))
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : 'Foods could not load.')
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (foodSheetOpen) nameInputRef.current?.focus();
  }, [foodSheetOpen]);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return [...foods]
      .filter((food) => !term || food.name.toLocaleLowerCase().includes(term))
      .sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0) || a.name.localeCompare(b.name));
  }, [foods, query]);

  const openNew = () => {
    setIsNew(true);
    setDraft(emptyFood());
    setError(null);
    setNameError(null);
    setConfirmDelete(false);
  };

  const openEdit = (food: Food) => {
    setIsNew(false);
    setDraft({ ...food });
    setError(null);
    setNameError(null);
    setConfirmDelete(false);
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

  const remove = async () => {
    if (!draft || isNew) return;
    setSaving(true);
    setError(null);
    try {
      await deleteFood(draft.id);
      setFoods((current) => current.filter((food) => food.id !== draft.id));
      setDraft(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Food could not be removed.');
      setSaving(false);
    }
  };

  return (
    <div className="page-stack">
      <header className="page-heading split-heading">
        <div>
          <p>Your library</p>
          <h1>Saved foods</h1>
          <span>Make tomorrow’s logging a one-tap job.</span>
        </div>
        <button className="button button-primary compact-button" type="button" onClick={openNew}>
          <Plus size={18} aria-hidden="true" />
          Add food
        </button>
      </header>

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
        <section className="food-list" aria-label="Saved foods">
          {filtered.map((food) => (
            <button className="food-row" key={food.id} type="button" onClick={() => openEdit(food)}>
              <span className="food-glyph">
                <Apple aria-hidden="true" />
              </span>
              <span className="food-row-copy">
                <strong>{food.name}</strong>
                <small>{nutrientSummary(food)}</small>
              </span>
              <Pencil size={17} aria-hidden="true" />
            </button>
          ))}
        </section>
      ) : (
        <section className="empty-state compact-empty">
          <Apple aria-hidden="true" />
          <h2>{query ? 'No matching foods' : 'Save your first regular'}</h2>
          <p>
            {query
              ? 'Try another name, or add it as a new food.'
              : 'Store its macros once, then log it from Today with one tap.'}
          </p>
          <button className="button button-secondary" type="button" onClick={openNew}>
            <Plus size={18} aria-hidden="true" />
            Add food
          </button>
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

            {confirmDelete ? (
              <div className="delete-confirmation" role="alert">
                <span>
                  Remove <strong>{draft.name}</strong> from saved foods? Existing log entries stay
                  in your history.
                </span>
                <button type="button" onClick={() => setConfirmDelete(false)}>
                  Keep it
                </button>
              </div>
            ) : null}

            <footer>
              {!isNew ? (
                <button
                  className="button button-danger"
                  type="button"
                  disabled={saving}
                  onClick={() => (confirmDelete ? void remove() : setConfirmDelete(true))}
                >
                  <Trash2 size={18} aria-hidden="true" />
                  {confirmDelete ? 'Yes, remove' : 'Remove'}
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

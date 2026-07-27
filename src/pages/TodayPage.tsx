import {
  Apple,
  Archive,
  Check,
  ChevronRight,
  Clock3,
  Droplets,
  Dumbbell,
  Flame,
  Leaf,
  Moon,
  Pencil,
  Pill,
  Plus,
  RotateCcw,
  Save,
  Sprout,
  Trash2,
  Wheat,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addFoodEntry,
  addMedicationCheckIn,
  addWater,
  archiveMedication,
  deleteFoodEntry,
  deleteMedicationCheckIn,
  deleteWater,
  getDashboard,
  saveMedication,
  updateFoodEntry,
  updateMedication,
} from '../lib/api';
import { directEntryError } from '../lib/entries';
import {
  calculateGymGuidance,
  calculateSleepGuidance,
  formatCalorieAdjustmentRange,
  minutesToTime,
  scaleNutrients,
} from '../lib/recommendations';
import type {
  Dashboard,
  Food,
  FoodEntry,
  Medication,
  MedicationSchedule,
  WaterEntry,
} from '../lib/types';

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(timestamp);
}

function formatDuration(hours: number) {
  const totalMinutes = Math.round(hours * 60);
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!wholeHours) return `${minutes}m`;
  return minutes ? `${wholeHours}h ${minutes}m` : `${wholeHours}h`;
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function withEntries(
  dashboard: Dashboard,
  entries: FoodEntry[],
  waterEntries: WaterEntry[]
): Dashboard {
  const nutrients = entries.reduce(
    (total, entry) => ({
      calories: total.calories + entry.calories,
      carbsG: total.carbsG + entry.carbsG,
      proteinG: total.proteinG + entry.proteinG,
      fibreG: total.fibreG + entry.fibreG,
    }),
    { calories: 0, carbsG: 0, proteinG: 0, fibreG: 0 }
  );
  return {
    ...dashboard,
    entries: [...entries].sort((a, b) => b.eatenAt - a.eatenAt),
    waterEntries: [...waterEntries].sort((a, b) => b.drankAt - a.drankAt),
    totals: {
      ...nutrients,
      waterMl: waterEntries.reduce((sum, entry) => sum + entry.amountMl, 0),
    },
  };
}

type UndoAction =
  | { kind: 'food'; id: string; label: string }
  | { kind: 'water'; id: string; label: string }
  | { kind: 'delete-entry'; entry: FoodEntry; label: string };

type EntryDraft = {
  entryId: string | null;
  mode: 'saved' | 'direct';
  foodId: string | null;
  foodName: string;
  amount: number;
  unitLabel: string;
  calories: number;
  carbsG: number;
  proteinG: number;
  fibreG: number;
  eatenAt: string;
};

function toLocalInput(timestamp: number) {
  const date = new Date(timestamp);
  const local = new Date(timestamp - date.getTimezoneOffset() * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

export function TodayPage({ onOpenFoods }: { onOpenFoods: () => void }) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [undo, setUndo] = useState<UndoAction | null>(null);
  const [entryDraft, setEntryDraft] = useState<EntryDraft | null>(null);
  const [entryError, setEntryError] = useState<string | null>(null);
  const [medicationEditorOpen, setMedicationEditorOpen] = useState(false);
  const [medicationName, setMedicationName] = useState('');
  const [medicationSchedule, setMedicationSchedule] = useState<MedicationSchedule>('morning');
  const [editingMedicationId, setEditingMedicationId] = useState<string | null>(null);
  const entryFoodSelectRef = useRef<HTMLSelectElement>(null);
  const entryNameInputRef = useRef<HTMLInputElement>(null);
  const entrySheetOpen = entryDraft !== null;

  const load = useCallback(async () => {
    setError(null);
    try {
      setDashboard(await getDashboard());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Today could not load.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!undo) return;
    const timer = window.setTimeout(() => setUndo(null), 6000);
    return () => window.clearTimeout(timer);
  }, [undo]);

  useEffect(() => {
    if (!entrySheetOpen) return;
    if (entryDraft?.mode === 'direct') entryNameInputRef.current?.focus();
    else entryFoodSelectRef.current?.focus();
  }, [entryDraft?.mode, entrySheetOpen]);

  const gym = useMemo(
    () => (dashboard ? calculateGymGuidance(dashboard.entries) : null),
    [dashboard]
  );
  const sleep = useMemo(() => {
    if (!dashboard) return null;
    const last = [...dashboard.entries].sort((a, b) => b.eatenAt - a.eatenAt)[0];
    const lastDate = last ? new Date(last.eatenAt) : null;
    return calculateSleepGuidance({
      wakeTime: dashboard.profile.wakeTime,
      sleepHours: dashboard.profile.sleepHours,
      lastEntryLocalMinutes: lastDate ? lastDate.getHours() * 60 + lastDate.getMinutes() : null,
      lastEntryCalories: last?.calories ?? null,
    });
  }, [dashboard]);
  const latestFast = useMemo(() => dashboard?.completedFasts.at(-1) ?? null, [dashboard]);

  const quickAdd = async (food: Food) => {
    if (!dashboard || pendingId) return;
    const id = crypto.randomUUID();
    const nutrients = scaleNutrients(food, food.servingMode, food.defaultAmount);
    const optimistic: FoodEntry = {
      id,
      foodId: food.id,
      foodName: food.name,
      amount: food.defaultAmount,
      unitLabel: food.servingMode === 'per_100g' ? 'g' : food.unitLabel,
      ...nutrients,
      eatenAt: Date.now(),
    };
    setPendingId(food.id);
    setDashboard(
      withEntries(dashboard, [optimistic, ...dashboard.entries], dashboard.waterEntries)
    );
    try {
      const saved = await addFoodEntry({
        ...optimistic,
        optimistic,
      });
      setDashboard((current) =>
        current
          ? withEntries(
              current,
              current.entries.map((entry) => (entry.id === id ? saved : entry)),
              current.waterEntries
            )
          : current
      );
      setUndo({ kind: 'food', id, label: `${food.name} logged` });
    } catch (caught) {
      setDashboard(dashboard);
      setError(caught instanceof Error ? caught.message : 'Food could not be logged.');
    } finally {
      setPendingId(null);
    }
  };

  const quickWater = async (amountMl: number) => {
    if (!dashboard || pendingId) return;
    const entry: WaterEntry = {
      id: crypto.randomUUID(),
      amountMl,
      drankAt: Date.now(),
    };
    setPendingId(`water-${amountMl}`);
    setDashboard(withEntries(dashboard, dashboard.entries, [entry, ...dashboard.waterEntries]));
    try {
      await addWater(entry);
      setUndo({ kind: 'water', id: entry.id, label: `${amountMl} ml water logged` });
    } catch (caught) {
      setDashboard(dashboard);
      setError(caught instanceof Error ? caught.message : 'Water could not be logged.');
    } finally {
      setPendingId(null);
    }
  };

  const addMedication = async () => {
    const name = medicationName.trim();
    if (!dashboard || !name || pendingId) return;
    const editing = dashboard.medications.find(
      (medication) => medication.id === editingMedicationId
    );
    const medication: Medication = {
      id: editing?.id ?? crypto.randomUUID(),
      name,
      schedule: medicationSchedule,
      createdAt: editing?.createdAt ?? Date.now(),
      archivedAt: null,
    };
    setPendingId(`medication-${medication.id}`);
    setDashboard({
      ...dashboard,
      medications: editing
        ? dashboard.medications.map((item) => (item.id === medication.id ? medication : item))
        : [...dashboard.medications, medication],
    });
    try {
      if (editing) await updateMedication(medication);
      else await saveMedication(medication);
      setMedicationName('');
      setMedicationSchedule('morning');
      setEditingMedicationId(null);
    } catch (caught) {
      setDashboard(dashboard);
      setError(caught instanceof Error ? caught.message : 'Medication could not be saved.');
    } finally {
      setPendingId(null);
    }
  };

  const removeMedication = async (medication: Medication) => {
    if (!dashboard || pendingId) return;
    setPendingId(`archive-medication-${medication.id}`);
    setDashboard({
      ...dashboard,
      medications: dashboard.medications.filter((item) => item.id !== medication.id),
    });
    try {
      await archiveMedication(medication);
    } catch (caught) {
      setDashboard(dashboard);
      setError(caught instanceof Error ? caught.message : 'Medication could not be archived.');
    } finally {
      setPendingId(null);
    }
  };

  const toggleMedication = async (medication: Medication) => {
    if (!dashboard || pendingId) return;
    const existing = dashboard.medicationCheckIns.find(
      (checkIn) => checkIn.medicationId === medication.id
    );
    setPendingId(`medication-check-in-${medication.id}`);
    if (existing) {
      setDashboard({
        ...dashboard,
        medicationCheckIns: dashboard.medicationCheckIns.filter(
          (checkIn) => checkIn.id !== existing.id
        ),
      });
      try {
        await deleteMedicationCheckIn(existing.id);
      } catch (caught) {
        setDashboard(dashboard);
        setError(caught instanceof Error ? caught.message : 'Check-off could not be updated.');
      } finally {
        setPendingId(null);
      }
      return;
    }

    const checkIn = {
      id: crypto.randomUUID(),
      medicationId: medication.id,
      takenOn: dashboard.date,
      takenAt: Date.now(),
    };
    setDashboard({
      ...dashboard,
      medicationCheckIns: [checkIn, ...dashboard.medicationCheckIns],
    });
    try {
      await addMedicationCheckIn(checkIn);
    } catch (caught) {
      setDashboard(dashboard);
      setError(caught instanceof Error ? caught.message : 'Check-off could not be updated.');
    } finally {
      setPendingId(null);
    }
  };

  const undoLast = async () => {
    if (!undo || !dashboard) return;
    const action = undo;
    setUndo(null);
    if (action.kind === 'food') {
      setDashboard(
        withEntries(
          dashboard,
          dashboard.entries.filter((entry) => entry.id !== action.id),
          dashboard.waterEntries
        )
      );
      await deleteFoodEntry(action.id).catch(() => void load());
    } else if (action.kind === 'water') {
      setDashboard(
        withEntries(
          dashboard,
          dashboard.entries,
          dashboard.waterEntries.filter((entry) => entry.id !== action.id)
        )
      );
      await deleteWater(action.id).catch(() => void load());
    } else {
      const entry = action.entry;
      setDashboard(withEntries(dashboard, [entry, ...dashboard.entries], dashboard.waterEntries));
      await addFoodEntry({
        ...entry,
        optimistic: entry,
      }).catch(() => void load());
    }
  };

  const openNewEntry = () => {
    if (!dashboard) return;
    const food = dashboard.foods[0];
    setEntryError(null);
    setEntryDraft({
      entryId: null,
      mode: food ? 'saved' : 'direct',
      foodId: food?.id ?? null,
      foodName: food?.name ?? '',
      amount: food?.defaultAmount ?? 1,
      unitLabel: food ? (food.servingMode === 'per_100g' ? 'g' : food.unitLabel) : 'serving',
      ...(food
        ? scaleNutrients(food, food.servingMode, food.defaultAmount)
        : { calories: 0, carbsG: 0, proteinG: 0, fibreG: 0 }),
      eatenAt: toLocalInput(Date.now()),
    });
  };

  const openEntry = (entry: FoodEntry) => {
    const hasSavedFood = dashboard?.foods.some((food) => food.id === entry.foodId) ?? false;
    setEntryError(null);
    setEntryDraft({
      entryId: entry.id,
      mode: hasSavedFood ? 'saved' : 'direct',
      foodId: hasSavedFood ? entry.foodId : null,
      foodName: entry.foodName,
      amount: entry.amount,
      unitLabel: entry.unitLabel,
      calories: entry.calories,
      carbsG: entry.carbsG,
      proteinG: entry.proteinG,
      fibreG: entry.fibreG,
      eatenAt: toLocalInput(entry.eatenAt),
    });
  };

  const chooseEntryFood = (foodId: string) => {
    if (!dashboard) return;
    const food = dashboard.foods.find((item) => item.id === foodId);
    setEntryDraft((current) =>
      current && food
        ? {
            ...current,
            foodId,
            foodName: food.name,
            amount: food.defaultAmount,
            unitLabel: food.servingMode === 'per_100g' ? 'g' : food.unitLabel,
            ...scaleNutrients(food, food.servingMode, food.defaultAmount),
          }
        : current
    );
  };

  const chooseEntryMode = (mode: EntryDraft['mode']) => {
    if (!dashboard) return;
    setEntryError(null);
    setEntryDraft((current) => {
      if (!current || current.mode === mode) return current;
      if (mode === 'direct') {
        if (current.entryId) {
          const food = dashboard.foods.find((item) => item.id === current.foodId);
          const nutrients = food
            ? scaleNutrients(food, food.servingMode, current.amount)
            : {
                calories: current.calories,
                carbsG: current.carbsG,
                proteinG: current.proteinG,
                fibreG: current.fibreG,
              };
          return {
            ...current,
            mode,
            foodId: null,
            foodName: food?.name ?? current.foodName,
            unitLabel:
              food?.servingMode === 'per_100g' ? 'g' : (food?.unitLabel ?? current.unitLabel),
            ...nutrients,
          };
        }
        return {
          ...current,
          mode,
          foodId: null,
          foodName: '',
          amount: 1,
          unitLabel: 'serving',
          calories: 0,
          carbsG: 0,
          proteinG: 0,
          fibreG: 0,
        };
      }

      const food = dashboard.foods[0];
      if (!food) return current;
      return {
        ...current,
        mode,
        foodId: food.id,
        foodName: food.name,
        amount: food.defaultAmount,
        unitLabel: food.servingMode === 'per_100g' ? 'g' : food.unitLabel,
        ...scaleNutrients(food, food.servingMode, food.defaultAmount),
      };
    });
  };

  const saveEntry = async () => {
    if (!dashboard || !entryDraft || pendingId) return;
    const food = dashboard.foods.find((item) => item.id === entryDraft.foodId);
    const eatenAt = new Date(entryDraft.eatenAt).getTime();
    if (entryDraft.mode === 'saved' && !food) {
      setEntryError('Choose a saved food.');
      return;
    }
    if (!Number.isFinite(entryDraft.amount) || entryDraft.amount <= 0) {
      setEntryError('Add an amount above zero.');
      return;
    }
    if (!Number.isFinite(eatenAt) || eatenAt > Date.now() + 24 * 60 * 60 * 1000) {
      setEntryError('Choose a valid time.');
      return;
    }

    const id = entryDraft.entryId ?? crypto.randomUUID();
    const optimistic: FoodEntry =
      entryDraft.mode === 'saved' && food
        ? {
            id,
            foodId: food.id,
            foodName: food.name,
            amount: entryDraft.amount,
            unitLabel: food.servingMode === 'per_100g' ? 'g' : food.unitLabel,
            ...scaleNutrients(food, food.servingMode, entryDraft.amount),
            eatenAt,
          }
        : {
            id,
            foodId: null,
            foodName: entryDraft.foodName,
            amount: entryDraft.amount,
            unitLabel: entryDraft.unitLabel,
            calories: entryDraft.calories,
            carbsG: entryDraft.carbsG,
            proteinG: entryDraft.proteinG,
            fibreG: entryDraft.fibreG,
            eatenAt,
          };
    const directError = optimistic.foodId === null ? directEntryError(optimistic) : null;
    if (directError) {
      setEntryError(directError);
      return;
    }

    const previous = dashboard;
    const nextEntries = entryDraft.entryId
      ? dashboard.entries.map((entry) => (entry.id === id ? optimistic : entry))
      : [optimistic, ...dashboard.entries];
    setPendingId(`entry-${id}`);
    setDashboard(withEntries(dashboard, nextEntries, dashboard.waterEntries));
    try {
      const saved = entryDraft.entryId
        ? await updateFoodEntry({
            ...optimistic,
            optimistic,
          })
        : await addFoodEntry({
            ...optimistic,
            optimistic,
          });
      setDashboard((current) =>
        current
          ? withEntries(
              current,
              current.entries.map((entry) => (entry.id === id ? saved : entry)),
              current.waterEntries
            )
          : current
      );
      if (!entryDraft.entryId) {
        setUndo({ kind: 'food', id, label: `${optimistic.foodName} logged` });
      }
      setEntryDraft(null);
    } catch (caught) {
      setDashboard(previous);
      setEntryError(caught instanceof Error ? caught.message : 'Entry could not be saved.');
    } finally {
      setPendingId(null);
    }
  };

  const removeEntry = async () => {
    if (!dashboard || !entryDraft?.entryId || pendingId) return;
    const entry = dashboard.entries.find((item) => item.id === entryDraft.entryId);
    if (!entry) return;
    const previous = dashboard;
    setPendingId(`entry-${entry.id}`);
    setDashboard(
      withEntries(
        dashboard,
        dashboard.entries.filter((item) => item.id !== entry.id),
        dashboard.waterEntries
      )
    );
    setEntryDraft(null);
    try {
      await deleteFoodEntry(entry.id);
      setUndo({ kind: 'delete-entry', entry, label: `${entry.foodName} removed` });
    } catch (caught) {
      setDashboard(previous);
      setError(caught instanceof Error ? caught.message : 'Entry could not be removed.');
    } finally {
      setPendingId(null);
    }
  };

  if (!dashboard && !error) {
    return (
      <div className="page-stack" aria-busy="true">
        <div className="skeleton skeleton-title" />
        <div className="skeleton dashboard-skeleton" />
        <div className="skeleton dashboard-skeleton short" />
      </div>
    );
  }

  if (!dashboard) {
    return (
      <section className="empty-state">
        <Sprout aria-hidden="true" />
        <h1>Your day is waiting</h1>
        <p>{error}</p>
        <button className="button button-primary" type="button" onClick={() => void load()}>
          Try again
        </button>
      </section>
    );
  }

  const target = dashboard.target.calorieTarget;
  const calorieProgress = target
    ? Math.min(100, Math.max(0, (dashboard.totals.calories / target) * 100))
    : 0;
  const proteinTarget = dashboard.target.proteinRangeG?.[0] ?? null;
  const fibreTarget = dashboard.target.fibreTargetG;
  const waterPercent = Math.max(
    0,
    (dashboard.totals.waterMl / dashboard.profile.waterTargetMl) * 100
  );
  const waterBarProgress = Math.min(100, waterPercent);

  const nutrients = [
    {
      label: 'Calories',
      value: Math.round(dashboard.totals.calories),
      unit: 'kcal',
      target,
      icon: Flame,
      className: 'nutrient-calories',
    },
    {
      label: 'Carbs',
      value: Math.round(dashboard.totals.carbsG),
      unit: 'g',
      target: null,
      icon: Wheat,
      className: 'nutrient-carbs',
    },
    {
      label: 'Protein',
      value: Math.round(dashboard.totals.proteinG),
      unit: 'g',
      target: proteinTarget,
      icon: Sprout,
      className: 'nutrient-protein',
    },
    {
      label: 'Fibre',
      value: Math.round(dashboard.totals.fibreG),
      unit: 'g',
      target: fibreTarget,
      icon: Leaf,
      className: 'nutrient-fibre',
    },
  ];

  return (
    <div className="page-stack">
      <header className="page-heading today-heading">
        <div>
          <p>
            {new Intl.DateTimeFormat(undefined, {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            }).format(new Date())}
          </p>
          <h1>
            {greeting()}, {dashboard.profile.displayName}
          </h1>
          <span>Here’s your day at a glance.</span>
        </div>
        <div className="botanical-motif" aria-hidden="true">
          <i />
          <i />
          <b />
        </div>
      </header>

      {error ? (
        <div className="inline-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      <section className="daily-summary" aria-labelledby="daily-summary-title">
        <div className="summary-topline">
          <div>
            <span id="daily-summary-title">Daily range</span>
            <strong>
              {target
                ? `${dashboard.target.calorieRange?.[0].toLocaleString()}–${dashboard.target.calorieRange?.[1].toLocaleString()} kcal`
                : 'Set a target'}
            </strong>
            {dashboard.target.maintenanceCalories ? (
              <small className="goal-context">
                {dashboard.target.maintenanceCalories.toLocaleString()} maintenance{' '}
                {formatCalorieAdjustmentRange(dashboard.target.goalAdjustmentRangeCalories)} for
                your goal
              </small>
            ) : null}
          </div>
          <span>{target ? `${Math.round(calorieProgress)}%` : '—'}</span>
        </div>
        <div className="progress-bar" aria-hidden="true">
          <span style={{ width: `${calorieProgress}%` }} />
        </div>
        <div className="nutrient-strip">
          {nutrients.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className={item.className}>
                <Icon size={18} aria-hidden="true" />
                <strong>
                  {item.value}
                  <small>{item.unit}</small>
                </strong>
                <span>
                  {item.label}
                  {item.target ? ` · ${item.target}` : ''}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="quick-section" aria-labelledby="quick-food-title">
        <div className="section-heading">
          <div>
            <h2 id="quick-food-title">Tap to log</h2>
            <p>Your usual amount, right now.</p>
          </div>
          <button className="text-button" type="button" onClick={onOpenFoods}>
            Manage foods
          </button>
        </div>
        <div className="quick-foods">
          {dashboard.foods.slice(0, 4).map((food) => (
            <button
              key={food.id}
              className="quick-food"
              type="button"
              disabled={Boolean(pendingId)}
              onClick={() => void quickAdd(food)}
            >
              <span className="food-glyph" aria-hidden="true">
                <Apple size={20} />
              </span>
              <span>
                <strong>{food.name}</strong>
                <small>
                  {food.defaultAmount} {food.servingMode === 'per_100g' ? 'g' : food.unitLabel}
                </small>
              </span>
              <Plus size={18} aria-hidden="true" />
            </button>
          ))}
          {dashboard.foods.length === 0 ? (
            <button className="quick-food quick-food-empty" type="button" onClick={onOpenFoods}>
              <span className="food-glyph">
                <Plus size={20} />
              </span>
              <span>
                <strong>Save your first food</strong>
                <small>Then it becomes a one-tap shortcut</small>
              </span>
            </button>
          ) : null}
        </div>
      </section>

      <section className="water-panel" aria-labelledby="water-title">
        <div className="water-main">
          <span className="water-icon">
            <Droplets aria-hidden="true" />
          </span>
          <div>
            <h2 id="water-title">Water</h2>
            <strong>
              {dashboard.totals.waterMl.toLocaleString()}
              <small> / {dashboard.profile.waterTargetMl.toLocaleString()} ml target</small>
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
              onClick={() => void quickWater(amount)}
            >
              <Plus size={16} aria-hidden="true" />
              {amount} ml
            </button>
          ))}
        </fieldset>
      </section>

      <section className="medication-panel" aria-labelledby="medication-title">
        <div className="section-heading medication-heading">
          <div>
            <h2 id="medication-title">
              <Pill size={19} aria-hidden="true" />
              Medications
            </h2>
            <p>Track the routine you set for today.</p>
          </div>
          <button
            className="text-button"
            type="button"
            onClick={() => setMedicationEditorOpen((open) => !open)}
          >
            {medicationEditorOpen ? 'Done' : 'Manage'}
          </button>
        </div>

        {dashboard.medications.length ? (
          <div className="medication-list">
            {dashboard.medications.map((medication) => {
              const checked = dashboard.medicationCheckIns.some(
                (checkIn) => checkIn.medicationId === medication.id
              );
              return (
                <div className="medication-row" key={medication.id}>
                  <button
                    className={`medication-check${checked ? ' is-checked' : ''}`}
                    type="button"
                    disabled={Boolean(pendingId)}
                    aria-pressed={checked}
                    onClick={() => void toggleMedication(medication)}
                  >
                    <span>{checked ? <Check size={17} aria-hidden="true" /> : null}</span>
                    <span>
                      <strong>{medication.name}</strong>
                      <small>
                        {medication.schedule === 'either'
                          ? 'Morning or evening'
                          : medication.schedule === 'morning'
                            ? 'Morning'
                            : 'Evening'}
                      </small>
                    </span>
                  </button>
                  {medicationEditorOpen ? (
                    <span className="medication-actions">
                      <button
                        className="icon-button subtle"
                        type="button"
                        disabled={Boolean(pendingId)}
                        aria-label={`Edit ${medication.name}`}
                        onClick={() => {
                          setEditingMedicationId(medication.id);
                          setMedicationName(medication.name);
                          setMedicationSchedule(medication.schedule);
                        }}
                      >
                        <Pencil size={17} aria-hidden="true" />
                      </button>
                      <button
                        className="icon-button subtle"
                        type="button"
                        disabled={Boolean(pendingId)}
                        aria-label={`Archive ${medication.name}`}
                        onClick={() => void removeMedication(medication)}
                      >
                        <Archive size={17} aria-hidden="true" />
                      </button>
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="medication-empty">Add your routine, then check it off here each day.</p>
        )}

        {medicationEditorOpen ? (
          <form
            className="medication-form"
            onSubmit={(event) => {
              event.preventDefault();
              void addMedication();
            }}
          >
            <label className="field">
              <span>Medication name</span>
              <input
                value={medicationName}
                maxLength={80}
                placeholder="e.g. Vitamin D"
                onChange={(event) => setMedicationName(event.target.value)}
              />
            </label>
            <label className="field">
              <span>When</span>
              <select
                value={medicationSchedule}
                onChange={(event) =>
                  setMedicationSchedule(event.target.value as MedicationSchedule)
                }
              >
                <option value="morning">Morning</option>
                <option value="evening">Evening</option>
                <option value="either">Either</option>
              </select>
            </label>
            <button
              className="button button-primary"
              type="submit"
              disabled={!medicationName.trim()}
            >
              <Plus size={17} aria-hidden="true" />
              {editingMedicationId ? 'Save changes' : 'Add medication'}
            </button>
            {editingMedicationId ? (
              <button
                className="text-button medication-cancel"
                type="button"
                onClick={() => {
                  setEditingMedicationId(null);
                  setMedicationName('');
                  setMedicationSchedule('morning');
                }}
              >
                Cancel editing
              </button>
            ) : null}
            <small className="medication-note">
              Routine tracking only—not dosage or medical advice.
            </small>
          </form>
        ) : null}
      </section>

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
                ? `${formatTime(gym.startAt)}–${formatTime(gym.endAt)}`
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

      <section className="today-log" aria-labelledby="today-log-title">
        <div className="section-heading">
          <div>
            <h2 id="today-log-title">Today’s log</h2>
            <p>{dashboard.entries.length} food entries</p>
          </div>
          <button
            className="button button-primary button-compact"
            type="button"
            onClick={openNewEntry}
          >
            <Plus size={18} aria-hidden="true" />
            Add entry
          </button>
        </div>
        {dashboard.entries.length ? (
          <div className="entry-list">
            {dashboard.entries.map((entry) => (
              <button
                className="entry-row"
                key={entry.id}
                type="button"
                aria-label={`Edit ${entry.foodName}, ${formatTime(entry.eatenAt)}`}
                onClick={() => openEntry(entry)}
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
                </div>
                <b>{Math.round(entry.calories)} kcal</b>
              </button>
            ))}
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

      {entryDraft ? (
        <div className="sheet-backdrop">
          <section
            className="edit-sheet entry-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="entry-sheet-title"
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
                onClick={() => setEntryDraft(null)}
              >
                <X size={20} />
              </button>
            </header>

            <div className="sheet-fields">
              <fieldset className="segmented entry-source-toggle">
                <legend className="sr-only">Entry source</legend>
                <button
                  className={entryDraft.mode === 'saved' ? 'is-selected' : ''}
                  type="button"
                  disabled={dashboard.foods.length === 0}
                  aria-pressed={entryDraft.mode === 'saved'}
                  onClick={() => chooseEntryMode('saved')}
                >
                  Saved food
                </button>
                <button
                  className={entryDraft.mode === 'direct' ? 'is-selected' : ''}
                  type="button"
                  aria-pressed={entryDraft.mode === 'direct'}
                  onClick={() => chooseEntryMode('direct')}
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
                      onChange={(event) => chooseEntryFood(event.target.value)}
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
                            setEntryDraft((current) =>
                              current
                                ? { ...current, amount: Number(event.target.value) || 0 }
                                : current
                            )
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
                            setEntryDraft((current) =>
                              current ? { ...current, eatenAt: event.target.value } : current
                            )
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
                              {preview.carbsG}g carbs · {preview.proteinG}g protein ·{' '}
                              {preview.fibreG}g fibre
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
                    Add the totals once. This won’t create a saved food.
                  </p>
                  <label className="field">
                    <span>Food name</span>
                    <input
                      ref={entryNameInputRef}
                      maxLength={80}
                      placeholder="e.g. Lunch special"
                      value={entryDraft.foodName}
                      onChange={(event) =>
                        setEntryDraft((current) =>
                          current ? { ...current, foodName: event.target.value } : current
                        )
                      }
                    />
                  </label>

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
                          setEntryDraft((current) =>
                            current
                              ? { ...current, amount: Number(event.target.value) || 0 }
                              : current
                          )
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
                          setEntryDraft((current) =>
                            current ? { ...current, unitLabel: event.target.value } : current
                          )
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
                              setEntryDraft((current) =>
                                current
                                  ? { ...current, [key]: Number(event.target.value) || 0 }
                                  : current
                              )
                            }
                          />
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <label className="field">
                    <span>Time eaten</span>
                    <div className="input-with-leading-icon">
                      <Clock3 size={17} aria-hidden="true" />
                      <input
                        type="datetime-local"
                        max={toLocalInput(Date.now() + 24 * 60 * 60 * 1000)}
                        value={entryDraft.eatenAt}
                        onChange={(event) =>
                          setEntryDraft((current) =>
                            current ? { ...current, eatenAt: event.target.value } : current
                          )
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
                  onClick={() => void removeEntry()}
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
                onClick={() => void saveEntry()}
              >
                <Save size={18} aria-hidden="true" />
                {pendingId ? 'Saving…' : 'Save entry'}
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {undo ? (
        <div className="undo-toast" role="status">
          <span>{undo.label}</span>
          <button type="button" onClick={() => void undoLast()}>
            Undo
          </button>
        </div>
      ) : null}
    </div>
  );
}

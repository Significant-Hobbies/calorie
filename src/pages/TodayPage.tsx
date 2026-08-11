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
  Scale,
  Sprout,
  Trash2,
  Wheat,
  X,
} from 'lucide-react';
import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NutrientDensityBadge } from '../components/NutrientDensityBadge';
import {
  addFoodEntry,
  addMedicationCheckIn,
  addWater,
  addWeight,
  archiveMedication,
  createFood,
  deleteFoodEntry,
  deleteMedicationCheckIn,
  deleteWater,
  getDashboard,
  saveMedication,
  updateFoodEntry,
  updateMedication,
  updateWater,
} from '../lib/api';
import { enabledDailyActions } from '../lib/daily-action-preferences';
import { type DailyActionKey, getDailyActionState } from '../lib/daily-actions';
import { directEntryError, foodFromDirectEntry, mergeDashboardEntry } from '../lib/entries';
import { normalizeFoodLabels } from '../lib/food-context';
import { waterTotal } from '../lib/log-corrections';
import { computeMacroCompletion } from '../lib/macro-completion';
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
  WeightEntry,
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
  if (hour < 5) {
    return {
      title: 'Rest well',
      subtitle: 'It’s late—your journal will still be here after sleep.',
    };
  }
  if (hour < 12) return { title: 'Good morning', subtitle: 'Here’s your day at a glance.' };
  if (hour < 18) return { title: 'Good afternoon', subtitle: 'Here’s your day at a glance.' };
  return { title: 'Good evening', subtitle: 'Here’s your day at a glance.' };
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
      waterMl: waterTotal(waterEntries),
    },
  };
}

type UndoAction =
  | { kind: 'food'; id: string; label: string }
  | { kind: 'water'; id: string; label: string }
  | { kind: 'delete-water'; entry: WaterEntry; label: string }
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
  saveForLater: boolean;
  isPackaged: boolean;
  labels: string[];
};

function toLocalInput(timestamp: number) {
  const date = new Date(timestamp);
  const local = new Date(timestamp - date.getTimezoneOffset() * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

export function TodayPage({
  onOpenFoods,
  onOpenSettings,
}: {
  onOpenFoods: () => void;
  onOpenSettings: () => void;
}) {
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
  const [weightEditorOpen, setWeightEditorOpen] = useState(false);
  const [weightValue, setWeightValue] = useState('');
  const [dailyAnnouncement, setDailyAnnouncement] = useState('');
  const [editingWaterId, setEditingWaterId] = useState<string | null>(null);
  const [waterAmount, setWaterAmount] = useState('');
  const [waterTime, setWaterTime] = useState('');
  const entryFoodSelectRef = useRef<HTMLSelectElement>(null);
  const entryNameInputRef = useRef<HTMLInputElement>(null);
  const entrySheetRef = useRef<HTMLElement>(null);
  const entrySheetBackdropRef = useRef<HTMLDivElement>(null);
  const entrySheetOpenerRef = useRef<HTMLElement | null>(null);
  const pageStackRef = useRef<HTMLDivElement>(null);
  const weightInputRef = useRef<HTMLInputElement>(null);
  const dailyActionsRef = useRef<HTMLElement>(null);
  const previousIncompleteRef = useRef<DailyActionKey[] | null>(null);
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
    entrySheetOpenerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const inertTargets = [
      document.querySelector<HTMLElement>('.app-header'),
      document.querySelector<HTMLElement>('.offline-banner'),
      document.querySelector<HTMLElement>('.desktop-nav'),
      document.querySelector<HTMLElement>('.bottom-nav'),
      ...Array.from(pageStackRef.current?.children ?? []).filter(
        (element): element is HTMLElement =>
          element instanceof HTMLElement && element !== entrySheetBackdropRef.current
      ),
    ].filter((element): element is HTMLElement => Boolean(element));
    const inertState = inertTargets.map((element) => ({
      element,
      wasInert: element.hasAttribute('inert'),
    }));
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    for (const { element } of inertState) element.setAttribute('inert', '');

    return () => {
      document.body.style.overflow = previousOverflow;
      for (const { element, wasInert } of inertState) {
        if (!wasInert) element.removeAttribute('inert');
      }
      const opener = entrySheetOpenerRef.current;
      entrySheetOpenerRef.current = null;
      window.requestAnimationFrame(() => opener?.focus());
    };
  }, [entrySheetOpen]);

  useEffect(() => {
    if (!entrySheetOpen) return;
    if (entryDraft?.mode === 'direct') entryNameInputRef.current?.focus();
    else entryFoodSelectRef.current?.focus();
  }, [entryDraft?.mode, entrySheetOpen]);

  const handleEntrySheetKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setEntryDraft(null);
      return;
    }
    if (event.key !== 'Tab') return;
    const sheet = entrySheetRef.current;
    if (!sheet) return;
    const focusable = Array.from(
      sheet.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])'
      )
    ).filter((element) => !element.hasAttribute('hidden'));
    if (!focusable.length) {
      event.preventDefault();
      sheet.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  useEffect(() => {
    if (!weightEditorOpen) return;
    window.requestAnimationFrame(() => weightInputRef.current?.focus());
  }, [weightEditorOpen]);

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
  const completion = useMemo(
    () =>
      dashboard?.target.calorieTarget
        ? computeMacroCompletion({
            totals: dashboard.totals,
            target: dashboard.target,
            foods: dashboard.foods,
          })
        : null,
    [dashboard]
  );
  const quickFoods = useMemo(
    () =>
      dashboard
        ? [...dashboard.foods].sort(
            (a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0) || a.name.localeCompare(b.name)
          )
        : [],
    [dashboard]
  );
  const dailyActionState = useMemo(
    () =>
      dashboard
        ? getDailyActionState({
            date: dashboard.date,
            timezone: dashboard.timezone,
            entries: dashboard.entries,
            waterEntries: dashboard.waterEntries,
            medications: dashboard.medications,
            medicationCheckIns: dashboard.medicationCheckIns,
            latestWeight: dashboard.latestWeight,
          })
        : null,
    [dashboard]
  );
  const incompleteActions = useMemo(
    () =>
      (dashboard ? enabledDailyActions(dashboard.profile) : []).filter(
        (key) => !dailyActionState?.completed[key]
      ),
    [dailyActionState, dashboard]
  );

  useEffect(() => {
    const previous = previousIncompleteRef.current;
    previousIncompleteRef.current = incompleteActions;
    if (!previous || incompleteActions.length >= previous.length) return;
    window.requestAnimationFrame(() => {
      const next = dailyActionsRef.current?.querySelector<HTMLElement>(
        'button:not([disabled]), input:not([disabled])'
      );
      next?.focus();
    });
  }, [incompleteActions]);

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
      setDailyAnnouncement(`Food logged. ${food.name} is in today’s journal.`);
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
      setDailyAnnouncement(`${amountMl} ml water logged.`);
    } catch (caught) {
      setDashboard(dashboard);
      setError(caught instanceof Error ? caught.message : 'Water could not be logged.');
    } finally {
      setPendingId(null);
    }
  };

  const beginWaterEdit = (entry: WaterEntry) => {
    setEditingWaterId(entry.id);
    setWaterAmount(String(entry.amountMl));
    setWaterTime(toLocalInput(entry.drankAt));
  };

  const saveWaterEdit = async () => {
    if (!dashboard || !editingWaterId) return;
    const amountMl = Number(waterAmount);
    const drankAt = new Date(waterTime).getTime();
    if (
      !Number.isFinite(amountMl) ||
      amountMl < 1 ||
      amountMl > 5000 ||
      !Number.isFinite(drankAt)
    ) {
      setError('Enter water between 1 and 5,000 ml and choose a valid time.');
      return;
    }
    const prior = dashboard;
    const updated: WaterEntry = { id: editingWaterId, amountMl: Math.round(amountMl), drankAt };
    setDashboard(
      withEntries(
        dashboard,
        dashboard.entries,
        dashboard.waterEntries.map((entry) => (entry.id === updated.id ? updated : entry))
      )
    );
    setEditingWaterId(null);
    try {
      await updateWater(updated);
      setDailyAnnouncement(`${updated.amountMl} ml water check-in updated.`);
    } catch (caught) {
      setDashboard(prior);
      setError(caught instanceof Error ? caught.message : 'Water check-in could not be updated.');
    }
  };

  const removeWater = async (entry: WaterEntry) => {
    if (!dashboard) return;
    const prior = dashboard;
    setDashboard(
      withEntries(
        dashboard,
        dashboard.entries,
        dashboard.waterEntries.filter((item) => item.id !== entry.id)
      )
    );
    setUndo({ kind: 'delete-water', entry, label: `${entry.amountMl} ml water removed` });
    try {
      await deleteWater(entry.id);
      setDailyAnnouncement('Water check-in removed.');
    } catch (caught) {
      setDashboard(prior);
      setUndo(null);
      setError(caught instanceof Error ? caught.message : 'Water check-in could not be removed.');
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
      if (/^creatine(?:\s|$)/i.test(medication.name)) {
        setDailyAnnouncement('Creatine routine is ready to check in.');
      }
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
        setDailyAnnouncement(`${medication.name} check-in removed.`);
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
      setDailyAnnouncement(`${medication.name} checked in for today.`);
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
    } else if (action.kind === 'delete-entry') {
      const entry = action.entry;
      setDashboard(withEntries(dashboard, [entry, ...dashboard.entries], dashboard.waterEntries));
      await addFoodEntry({
        ...entry,
        optimistic: entry,
      }).catch(() => void load());
    } else {
      const entry = action.entry;
      setDashboard(withEntries(dashboard, dashboard.entries, [entry, ...dashboard.waterEntries]));
      await addWater(entry).catch(() => void load());
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
      saveForLater: false,
      isPackaged: food?.isPackaged ?? false,
      labels: food?.labels ?? [],
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
      saveForLater: false,
      isPackaged: entry.isPackaged ?? false,
      labels: entry.labels ?? [],
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
            isPackaged: food.isPackaged ?? false,
            labels: food.labels ?? [],
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
            saveForLater: false,
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
          saveForLater: false,
          isPackaged: false,
          labels: [],
        };
      }

      const food = dashboard.foods[0];
      if (!food) return current;
      return {
        ...current,
        mode,
        saveForLater: false,
        foodId: food.id,
        foodName: food.name,
        amount: food.defaultAmount,
        unitLabel: food.servingMode === 'per_100g' ? 'g' : food.unitLabel,
        ...scaleNutrients(food, food.servingMode, food.defaultAmount),
        isPackaged: food.isPackaged ?? false,
        labels: food.labels ?? [],
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
    const directEntry: FoodEntry =
      entryDraft.mode === 'saved' && food
        ? {
            id,
            foodId: food.id,
            foodName: food.name,
            amount: entryDraft.amount,
            unitLabel: food.servingMode === 'per_100g' ? 'g' : food.unitLabel,
            ...scaleNutrients(food, food.servingMode, entryDraft.amount),
            eatenAt,
            isPackaged: food.isPackaged,
            labels: food.labels,
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
            isPackaged: entryDraft.isPackaged,
            labels: normalizeFoodLabels(entryDraft.labels),
          };
    const directError = directEntry.foodId === null ? directEntryError(directEntry) : null;
    if (directError) {
      setEntryError(directError);
      return;
    }

    const reusableFood =
      directEntry.foodId === null && entryDraft.saveForLater
        ? foodFromDirectEntry(directEntry, crypto.randomUUID())
        : null;
    const optimistic: FoodEntry = reusableFood
      ? { ...directEntry, foodId: reusableFood.id, foodName: reusableFood.name }
      : directEntry;
    const previous = dashboard;
    const nextEntries = mergeDashboardEntry(
      dashboard.entries,
      optimistic,
      dashboard.date,
      dashboard.timezone
    );
    let savedFood: Food | null = null;
    setPendingId(`entry-${id}`);
    try {
      savedFood = reusableFood ? await createFood(reusableFood) : null;
      setDashboard(
        withEntries(
          { ...dashboard, foods: savedFood ? [savedFood, ...dashboard.foods] : dashboard.foods },
          nextEntries,
          dashboard.waterEntries
        )
      );
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
        setUndo({
          kind: 'food',
          id,
          label: savedFood
            ? `${optimistic.foodName} saved and logged`
            : `${optimistic.foodName} logged`,
        });
        setDailyAnnouncement(`${optimistic.foodName} logged.`);
      }
      setEntryDraft(null);
    } catch (caught) {
      setDashboard(
        savedFood
          ? withEntries(
              { ...previous, foods: [savedFood, ...previous.foods] },
              previous.entries,
              previous.waterEntries
            )
          : previous
      );
      setEntryError(
        savedFood
          ? 'Food was saved, but this entry could not be logged. Try logging it again.'
          : caught instanceof Error
            ? caught.message
            : 'Entry could not be saved.'
      );
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

  const saveWeightCheckIn = async () => {
    if (!dashboard || pendingId) return;
    let weightKg = Number(weightValue);
    if (dashboard.profile.units === 'imperial') weightKg /= 2.20462;
    if (!Number.isFinite(weightKg) || weightKg < 30 || weightKg > 400) {
      setError('Enter a weight between 30 and 400 kg (66 and 882 lb).');
      return;
    }
    const entry: WeightEntry = {
      id: crypto.randomUUID(),
      weightKg: Math.round(weightKg * 10) / 10,
      recordedAt: Date.now(),
    };
    const previous = dashboard;
    setPendingId('weight-check-in');
    setDashboard({ ...dashboard, latestWeight: entry });
    try {
      await addWeight(entry);
      setWeightEditorOpen(false);
      setWeightValue('');
      setDailyAnnouncement('Weight checked in for today.');
    } catch (caught) {
      setDashboard(previous);
      setError(caught instanceof Error ? caught.message : 'Weight could not be logged.');
    } finally {
      setPendingId(null);
    }
  };

  const handleDailyAction = (action: DailyActionKey) => {
    if (!dashboard || pendingId) return;
    if (action === 'weight') {
      const latest = dashboard.latestWeight?.weightKg ?? null;
      const display =
        latest === null
          ? ''
          : dashboard.profile.units === 'imperial'
            ? String(Math.round(latest * 2.20462 * 10) / 10)
            : String(latest);
      setWeightValue(display);
      setWeightEditorOpen(true);
      return;
    }
    if (action === 'food') {
      openNewEntry();
      return;
    }
    if (action === 'water') {
      void quickWater(250);
      return;
    }
    if (dailyActionState?.creatineRoutine) {
      void toggleMedication(dailyActionState.creatineRoutine);
      return;
    }
    setMedicationEditorOpen(true);
    setEditingMedicationId(null);
    setMedicationName('Creatine');
    setMedicationSchedule('either');
    setDailyAnnouncement('Creatine setup opened below.');
    window.requestAnimationFrame(() =>
      document.getElementById('medication-editor')?.scrollIntoView({ block: 'center' })
    );
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

  const loggingLaunchpad = (
    <section className="quick-section logging-launchpad" aria-labelledby="quick-food-title">
      <div className="section-heading">
        <div>
          <p className="launchpad-kicker">Your journal</p>
          <h2 id="quick-food-title">Log food now</h2>
          <p>Start with a usual food, or add anything else.</p>
        </div>
        <div className="launchpad-actions">
          <button
            className="button button-primary button-compact"
            type="button"
            onClick={openNewEntry}
          >
            <Plus size={18} aria-hidden="true" />
            Log food
          </button>
          <button className="text-button" type="button" onClick={onOpenFoods}>
            Manage
          </button>
        </div>
      </div>
      <div className="quick-foods">
        {quickFoods.slice(0, 4).map((food) => (
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
  );

  return (
    <div className="page-stack" ref={pageStackRef}>
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
            {greeting().title}, {dashboard.profile.displayName}
          </h1>
          <span>{greeting().subtitle}</span>
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

      {loggingLaunchpad}

      {incompleteActions.length ? (
        <section
          className="daily-actions"
          aria-labelledby="daily-actions-title"
          ref={dailyActionsRef}
        >
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
                  hint: dailyActionState?.creatineRoutine
                    ? 'One-tap check-in'
                    : 'Create the routine',
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
                  onClick={() => handleDailyAction(action)}
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
                void saveWeightCheckIn();
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
                    onChange={(event) => setWeightValue(event.target.value)}
                  />
                  <b>{dashboard.profile.units === 'imperial' ? 'lb' : 'kg'}</b>
                </div>
              </label>
              <div>
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => setWeightEditorOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="button button-primary"
                  type="submit"
                  disabled={Boolean(pendingId)}
                >
                  Check in
                </button>
              </div>
            </form>
          ) : null}
        </section>
      ) : null}

      <p className="sr-only" aria-live="polite">
        {dailyAnnouncement}
      </p>

      <section className="daily-summary" aria-labelledby="daily-summary-title">
        <div className="summary-topline">
          <div>
            <span id="daily-summary-title">Daily range</span>
            <strong>
              {target
                ? `${dashboard.target.calorieRange?.[0].toLocaleString()}–${dashboard.target.calorieRange?.[1].toLocaleString()} kcal`
                : 'Targets not set'}
            </strong>
            {!target ? (
              <button className="summary-target-button" type="button" onClick={onOpenSettings}>
                Set your targets
              </button>
            ) : null}
            {dashboard.target.maintenanceCalories ? (
              <small className="goal-context">
                {dashboard.target.maintenanceCalories.toLocaleString()} maintenance{' '}
                {formatCalorieAdjustmentRange(dashboard.target.goalAdjustmentRangeCalories)} for
                your goal
              </small>
            ) : null}
          </div>
          <div className="summary-topline-right">
            <span>{target ? `${Math.round(calorieProgress)}%` : '—'}</span>
          </div>
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

      {completion ? (
        <section className="remaining-panel" aria-labelledby="remaining-title">
          <div className="section-heading">
            <div>
              <h2 id="remaining-title">Remaining today</h2>
              <p>
                {completion.complete
                  ? 'You’ve hit your tracked targets.'
                  : completion.leadingMacro === 'protein'
                    ? 'Protein is your widest gap.'
                    : 'Fibre is your widest gap.'}
              </p>
            </div>
          </div>
          {completion.complete ? (
            <div className="remaining-complete">
              <Check aria-hidden="true" />
              <span>Targets met — enjoy the rest of your day.</span>
            </div>
          ) : (
            <>
              <div className="remaining-totals">
                <div>
                  <strong>{completion.remainingCalories.toLocaleString()}</strong>
                  <small>kcal remaining</small>
                </div>
                <div>
                  <strong>{completion.remainingProteinG.toLocaleString()}</strong>
                  <small>g protein left</small>
                </div>
                <div>
                  <strong>{completion.remainingFibreG.toLocaleString()}</strong>
                  <small>g fibre left</small>
                </div>
              </div>
              {completion.suggestions.length ? (
                <div className="remaining-suggestions">
                  <p className="remaining-suggestions-label">One serving covers the most:</p>
                  {completion.suggestions.map((item) => (
                    <button
                      key={item.food.id}
                      className="quick-food"
                      type="button"
                      disabled={Boolean(pendingId)}
                      onClick={() => void quickAdd(item.food)}
                    >
                      <span className="food-glyph" aria-hidden="true">
                        <Apple size={20} />
                      </span>
                      <span>
                        <strong>{item.food.name}</strong>
                        <small>
                          {item.calories} kcal · {item.proteinG}g protein · {item.fibreG}g fibre
                        </small>
                      </span>
                      <Plus size={18} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="remaining-no-foods">
                  Save a few foods to get one-tap suggestions that fill the gap.
                </p>
              )}
            </>
          )}
        </section>
      ) : null}

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
        <section className="water-log" aria-label="Today’s water check-ins">
          <div className="water-log-heading">
            <strong>Today’s check-ins</strong>
            <small>{dashboard.waterEntries.length} logged</small>
          </div>
          {dashboard.waterEntries.length ? (
            dashboard.waterEntries.map((entry) =>
              editingWaterId === entry.id ? (
                <div className="water-log-editor" key={entry.id}>
                  <label>
                    <span className="sr-only">Water amount in millilitres</span>
                    <input
                      type="number"
                      min="1"
                      max="5000"
                      value={waterAmount}
                      onChange={(event) => setWaterAmount(event.target.value)}
                    />
                  </label>
                  <label>
                    <span className="sr-only">Water check-in time</span>
                    <input
                      type="datetime-local"
                      value={waterTime}
                      onChange={(event) => setWaterTime(event.target.value)}
                    />
                  </label>
                  <button
                    className="button button-primary button-compact"
                    type="button"
                    onClick={() => void saveWaterEdit()}
                  >
                    Save
                  </button>
                  <button
                    className="button button-quiet"
                    type="button"
                    onClick={() => setEditingWaterId(null)}
                  >
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
                    onClick={() => beginWaterEdit(entry)}
                  >
                    <Pencil aria-hidden="true" />
                  </button>
                  <button
                    className="button button-quiet danger-button"
                    type="button"
                    aria-label={`Remove ${entry.amountMl} ml water check-in`}
                    onClick={() => void removeWater(entry)}
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
            id="medication-editor"
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
                  <NutrientDensityBadge nutrients={entry} />
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
        <div className="sheet-backdrop" ref={entrySheetBackdropRef}>
          <section
            className="edit-sheet entry-sheet"
            ref={entrySheetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="entry-sheet-title"
            tabIndex={-1}
            onKeyDown={handleEntrySheetKeyDown}
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
                      chooseEntryMode('saved');
                      return;
                    }
                    setEntryError(null);
                    setEntryDraft((current) =>
                      current
                        ? { ...current, mode: 'direct', foodId: null, saveForLater: true }
                        : current
                    );
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
                    chooseEntryMode('direct');
                    setEntryDraft((current) =>
                      current && current.mode === 'direct'
                        ? { ...current, saveForLater: false }
                        : current
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
                    {entryDraft.saveForLater
                      ? 'This serving will be saved for future one-tap logging.'
                      : 'Add the totals once. This won’t create a saved food.'}
                  </p>
                  <button
                    className={`save-food-toggle${entryDraft.saveForLater ? ' is-selected' : ''}`}
                    type="button"
                    aria-pressed={entryDraft.saveForLater}
                    onClick={() =>
                      setEntryDraft((current) =>
                        current ? { ...current, saveForLater: !current.saveForLater } : current
                      )
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
                        setEntryDraft((current) =>
                          current ? { ...current, foodName: event.target.value } : current
                        )
                      }
                    />
                  </label>

                  <div className="field-row">
                    <label className="field">
                      <span>Packaging</span>
                      <select
                        value={entryDraft.isPackaged ? 'packaged' : 'not-packaged'}
                        onChange={(event) =>
                          setEntryDraft((current) =>
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
                        value={entryDraft.labels.join(', ')}
                        placeholder="late snack, protein"
                        onChange={(event) =>
                          setEntryDraft((current) =>
                            current
                              ? { ...current, labels: event.target.value.split(',') }
                              : current
                          )
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

                  <div className="nutrient-density-preview is-compact">
                    <NutrientDensityBadge nutrients={entryDraft} showBasis />
                    <p>
                      Based only on tracked protein and fibre per calorie—not overall food quality.
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

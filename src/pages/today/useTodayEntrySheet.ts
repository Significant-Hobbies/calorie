import {
  type Dispatch,
  type KeyboardEvent,
  type RefObject,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from 'react';
import { addFoodEntry, createFood, deleteFoodEntry, updateFoodEntry } from '../../lib/api';
import { directEntryError, foodFromDirectEntry, mergeDashboardEntry } from '../../lib/entries';
import { normalizeFoodLabels } from '../../lib/food-context';
import { scaleNutrients } from '../../lib/recommendations';
import type { Dashboard, Food, FoodEntry } from '../../lib/types';
import { type EntryDraft, toLocalInput, type UndoAction, withEntries } from './today-utils';

type Setter<T> = Dispatch<SetStateAction<T>>;

type EntrySheetDeps = {
  dashboard: Dashboard | null;
  pendingId: string | null;
  setPendingId: Setter<string | null>;
  setDashboard: Setter<Dashboard | null>;
  setUndo: Setter<UndoAction | null>;
  setDailyAnnouncement: Setter<string>;
  setError: Setter<string | null>;
};

function emptyNutrients() {
  return { calories: 0, carbsG: 0, proteinG: 0, fibreG: 0 };
}

function foodUnitLabel(food: Food) {
  return food.servingMode === 'per_100g' ? 'g' : food.unitLabel;
}

function lockEntrySheet(
  pageStackRef: RefObject<HTMLDivElement | null>,
  entrySheetBackdropRef: RefObject<HTMLDivElement | null>,
  entrySheetOpenerRef: RefObject<HTMLElement | null>
) {
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
}

function handleEntrySheetKeyDown(
  event: KeyboardEvent<HTMLElement>,
  entrySheetRef: RefObject<HTMLElement | null>,
  setEntryDraft: Setter<EntryDraft | null>
) {
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
}

function openNewEntry(
  dashboard: Dashboard | null,
  setEntryError: Setter<string | null>,
  setEntryDraft: Setter<EntryDraft | null>
) {
  if (!dashboard) return;
  const food = dashboard.foods[0];
  setEntryError(null);
  setEntryDraft({
    entryId: null,
    mode: food ? 'saved' : 'direct',
    foodId: food?.id ?? null,
    foodName: food?.name ?? '',
    amount: food?.defaultAmount ?? 1,
    unitLabel: food ? foodUnitLabel(food) : 'serving',
    ...(food ? scaleNutrients(food, food.servingMode, food.defaultAmount) : emptyNutrients()),
    eatenAt: toLocalInput(Date.now()),
    saveForLater: false,
    isPackaged: food?.isPackaged ?? false,
    labels: food?.labels ?? [],
  });
}

function openEntry(
  entry: FoodEntry,
  dashboard: Dashboard | null,
  setEntryError: Setter<string | null>,
  setEntryDraft: Setter<EntryDraft | null>
) {
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
}

function chooseEntryFood(
  foodId: string,
  dashboard: Dashboard | null,
  setEntryDraft: Setter<EntryDraft | null>
) {
  if (!dashboard) return;
  const food = dashboard.foods.find((item) => item.id === foodId);
  setEntryDraft((current) =>
    current && food
      ? {
          ...current,
          foodId,
          foodName: food.name,
          amount: food.defaultAmount,
          unitLabel: foodUnitLabel(food),
          ...scaleNutrients(food, food.servingMode, food.defaultAmount),
          isPackaged: food.isPackaged ?? false,
          labels: food.labels ?? [],
        }
      : current
  );
}

function applyDirectEntryMode(current: EntryDraft, dashboard: Dashboard): EntryDraft {
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
      mode: 'direct',
      foodId: null,
      foodName: food?.name ?? current.foodName,
      unitLabel: food?.servingMode === 'per_100g' ? 'g' : (food?.unitLabel ?? current.unitLabel),
      saveForLater: false,
      ...nutrients,
    };
  }
  return {
    ...current,
    mode: 'direct',
    foodId: null,
    foodName: '',
    amount: 1,
    unitLabel: 'serving',
    ...emptyNutrients(),
    saveForLater: false,
    isPackaged: false,
    labels: [],
  };
}

function chooseEntryMode(
  mode: EntryDraft['mode'],
  dashboard: Dashboard | null,
  setEntryError: Setter<string | null>,
  setEntryDraft: Setter<EntryDraft | null>
) {
  if (!dashboard) return;
  setEntryError(null);
  setEntryDraft((current) => {
    if (!current || current.mode === mode) return current;
    if (mode === 'direct') return applyDirectEntryMode(current, dashboard);
    const food = dashboard.foods[0];
    if (!food) return current;
    return {
      ...current,
      mode,
      saveForLater: false,
      foodId: food.id,
      foodName: food.name,
      amount: food.defaultAmount,
      unitLabel: foodUnitLabel(food),
      ...scaleNutrients(food, food.servingMode, food.defaultAmount),
      isPackaged: food.isPackaged ?? false,
      labels: food.labels ?? [],
    };
  });
}

function draftToFoodEntry(
  entryDraft: EntryDraft,
  food: Food | undefined,
  id: string,
  eatenAt: number
) {
  return entryDraft.mode === 'saved' && food
    ? {
        id,
        foodId: food.id,
        foodName: food.name,
        amount: entryDraft.amount,
        unitLabel: foodUnitLabel(food),
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
}

async function saveEntry(
  input: EntrySheetDeps & {
    entryDraft: EntryDraft | null;
    setEntryDraft: Setter<EntryDraft | null>;
    setEntryError: Setter<string | null>;
  }
) {
  const {
    dashboard,
    entryDraft,
    pendingId,
    setPendingId,
    setDashboard,
    setUndo,
    setDailyAnnouncement,
    setEntryDraft,
    setEntryError,
  } = input;
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
  const directEntry: FoodEntry = draftToFoodEntry(entryDraft, food, id, eatenAt);
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
}

async function removeEntry(
  input: Pick<
    EntrySheetDeps,
    'dashboard' | 'pendingId' | 'setPendingId' | 'setDashboard' | 'setUndo' | 'setError'
  > & {
    entryDraft: EntryDraft | null;
    setEntryDraft: Setter<EntryDraft | null>;
  }
) {
  const {
    dashboard,
    entryDraft,
    pendingId,
    setPendingId,
    setDashboard,
    setUndo,
    setError,
    setEntryDraft,
  } = input;
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
}

export function useTodayEntrySheet(deps: EntrySheetDeps) {
  const {
    dashboard,
    pendingId,
    setPendingId,
    setDashboard,
    setUndo,
    setDailyAnnouncement,
    setError,
  } = deps;
  const [entryDraft, setEntryDraft] = useState<EntryDraft | null>(null);
  const [entryError, setEntryError] = useState<string | null>(null);
  const entryFoodSelectRef = useRef<HTMLSelectElement>(null);
  const entryNameInputRef = useRef<HTMLInputElement>(null);
  const entrySheetRef = useRef<HTMLElement>(null);
  const entrySheetBackdropRef = useRef<HTMLDivElement>(null);
  const entrySheetOpenerRef = useRef<HTMLElement | null>(null);
  const pageStackRef = useRef<HTMLDivElement>(null);
  const entrySheetOpen = entryDraft !== null;

  useEffect(() => {
    if (!entrySheetOpen) return;
    return lockEntrySheet(pageStackRef, entrySheetBackdropRef, entrySheetOpenerRef);
  }, [entrySheetOpen]);

  useEffect(() => {
    if (!entrySheetOpen) return;
    if (entryDraft?.mode === 'direct') entryNameInputRef.current?.focus();
    else entryFoodSelectRef.current?.focus();
  }, [entryDraft?.mode, entrySheetOpen]);

  return {
    entryDraft,
    setEntryDraft,
    entryError,
    setEntryError,
    entryFoodSelectRef,
    entryNameInputRef,
    entrySheetRef,
    entrySheetBackdropRef,
    pageStackRef,
    handleEntrySheetKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      handleEntrySheetKeyDown(event, entrySheetRef, setEntryDraft);
    },
    openNewEntry: () => openNewEntry(dashboard, setEntryError, setEntryDraft),
    openEntry: (entry: FoodEntry) => openEntry(entry, dashboard, setEntryError, setEntryDraft),
    chooseEntryFood: (foodId: string) => chooseEntryFood(foodId, dashboard, setEntryDraft),
    chooseEntryMode: (mode: EntryDraft['mode']) =>
      chooseEntryMode(mode, dashboard, setEntryError, setEntryDraft),
    saveEntry: () =>
      saveEntry({
        dashboard,
        pendingId,
        setPendingId,
        setDashboard,
        setUndo,
        setDailyAnnouncement,
        setError,
        entryDraft,
        setEntryDraft,
        setEntryError,
      }),
    removeEntry: () =>
      removeEntry({
        dashboard,
        pendingId,
        setPendingId,
        setDashboard,
        setUndo,
        setError,
        entryDraft,
        setEntryDraft,
      }),
  };
}

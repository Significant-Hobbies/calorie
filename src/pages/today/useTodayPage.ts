import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addFoodEntry,
  addMedicationCheckIn,
  addWater,
  addWeight,
  archiveMedication,
  deleteFoodEntry,
  deleteMedicationCheckIn,
  deleteWater,
  getDashboard,
  saveMedication,
  updateMedication,
  updateWater,
} from '../../lib/api';
import { enabledDailyActions } from '../../lib/daily-action-preferences';
import { type DailyActionKey, getDailyActionState } from '../../lib/daily-actions';
import { computeMacroCompletion } from '../../lib/macro-completion';
import {
  calculateGymGuidance,
  calculateSleepGuidance,
  scaleNutrients,
} from '../../lib/recommendations';
import type {
  Dashboard,
  Food,
  FoodEntry,
  Medication,
  MedicationSchedule,
  WaterEntry,
  WeightEntry,
} from '../../lib/types';
import { toLocalInput, type UndoAction, withEntries } from './today-utils';
import { useTodayEntrySheet } from './useTodayEntrySheet';

export function useTodayPage({ cloudRevision }: { cloudRevision: number }) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [undo, setUndo] = useState<UndoAction | null>(null);
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
  const weightInputRef = useRef<HTMLInputElement>(null);
  const dailyActionsRef = useRef<HTMLElement>(null);
  const previousIncompleteRef = useRef<DailyActionKey[] | null>(null);
  const entrySheet = useTodayEntrySheet({
    dashboard,
    pendingId,
    setPendingId,
    setDashboard,
    setUndo,
    setDailyAnnouncement,
    setError,
  });

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
  }, [load, cloudRevision]);

  useEffect(() => {
    if (!undo) return;
    const timer = window.setTimeout(() => setUndo(null), 6000);
    return () => window.clearTimeout(timer);
  }, [undo]);

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
      entrySheet.openNewEntry();
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

  return {
    dashboard,
    error,
    setError,
    pendingId,
    undo,
    medicationEditorOpen,
    setMedicationEditorOpen,
    medicationName,
    setMedicationName,
    medicationSchedule,
    setMedicationSchedule,
    editingMedicationId,
    setEditingMedicationId,
    weightEditorOpen,
    setWeightEditorOpen,
    weightValue,
    setWeightValue,
    dailyAnnouncement,
    editingWaterId,
    setEditingWaterId,
    waterAmount,
    setWaterAmount,
    waterTime,
    setWaterTime,
    weightInputRef,
    dailyActionsRef,
    load,
    gym,
    sleep,
    latestFast,
    completion,
    quickFoods,
    dailyActionState,
    incompleteActions,
    quickAdd,
    quickWater,
    beginWaterEdit,
    saveWaterEdit,
    removeWater,
    addMedication,
    removeMedication,
    toggleMedication,
    undoLast,
    saveWeightCheckIn,
    handleDailyAction,
    ...entrySheet,
  };
}

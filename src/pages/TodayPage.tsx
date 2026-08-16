import { Flame, Leaf, Sprout, Wheat } from 'lucide-react';
import { TodayDailyActions } from './today/TodayDailyActions';
import { TodayEntrySheet } from './today/TodayEntrySheet';
import { TodayLog } from './today/TodayLog';
import { TodayLoggingLaunchpad } from './today/TodayLoggingLaunchpad';
import { TodayMedicationPanel } from './today/TodayMedicationPanel';
import { TodayRemaining, TodaySummary } from './today/TodaySummary';
import { TodayTiming } from './today/TodayTiming';
import { TodayWaterPanel } from './today/TodayWaterPanel';
import { greeting } from './today/today-utils';
import { useTodayPage } from './today/useTodayPage';

export function TodayPage({
  cloudRevision,
  onOpenFoods,
  onOpenSettings,
}: {
  cloudRevision: number;
  onOpenFoods: () => void;
  onOpenSettings: () => void;
}) {
  const today = useTodayPage({ cloudRevision });
  const {
    dashboard,
    error,
    setError,
    pendingId,
    undo,
    entryDraft,
    setEntryDraft,
    entryError,
    setEntryError,
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
    entryFoodSelectRef,
    entryNameInputRef,
    entrySheetRef,
    entrySheetBackdropRef,
    pageStackRef,
    weightInputRef,
    dailyActionsRef,
    load,
    handleEntrySheetKeyDown,
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
    openNewEntry,
    openEntry,
    chooseEntryFood,
    chooseEntryMode,
    saveEntry,
    removeEntry,
    saveWeightCheckIn,
    handleDailyAction,
  } = today;

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

      <TodayLoggingLaunchpad
        foods={dashboard.foods}
        quickFoods={quickFoods}
        pendingId={pendingId}
        onOpenFoods={onOpenFoods}
        onOpenNewEntry={openNewEntry}
        onQuickAdd={(food) => void quickAdd(food)}
      />

      <TodayDailyActions
        actions={{
          incomplete: incompleteActions,
          state: dailyActionState,
          pendingId,
          sectionRef: dailyActionsRef,
        }}
        weight={{
          editorOpen: weightEditorOpen,
          value: weightValue,
          units: dashboard.profile.units,
          inputRef: weightInputRef,
        }}
        onAction={handleDailyAction}
        onWeight={{
          onValueChange: setWeightValue,
          onCancel: () => setWeightEditorOpen(false),
          onSave: () => void saveWeightCheckIn(),
        }}
      />

      <p className="sr-only" aria-live="polite">
        {dailyAnnouncement}
      </p>

      <TodaySummary
        dashboard={dashboard}
        target={target}
        calorieProgress={calorieProgress}
        nutrients={nutrients}
        onOpenSettings={onOpenSettings}
      />

      <TodayRemaining
        completion={completion}
        pendingId={pendingId}
        onQuickAdd={(food) => void quickAdd(food)}
      />

      <TodayWaterPanel
        summary={{
          waterMl: dashboard.totals.waterMl,
          waterTargetMl: dashboard.profile.waterTargetMl,
          waterPercent,
          waterBarProgress,
          waterEntries: dashboard.waterEntries,
        }}
        editor={{
          pendingId,
          editingWaterId,
          waterAmount,
          waterTime,
        }}
        handlers={{
          onQuickWater: (amount) => void quickWater(amount),
          onBeginEdit: beginWaterEdit,
          onAmountChange: setWaterAmount,
          onTimeChange: setWaterTime,
          onSaveEdit: () => void saveWaterEdit(),
          onCancelEdit: () => setEditingWaterId(null),
          onRemove: (entry) => void removeWater(entry),
        }}
      />

      <TodayMedicationPanel
        medications={dashboard.medications}
        medicationCheckIns={dashboard.medicationCheckIns}
        pendingId={pendingId}
        editorOpen={medicationEditorOpen}
        medicationName={medicationName}
        medicationSchedule={medicationSchedule}
        editingMedicationId={editingMedicationId}
        onToggleEditor={() => setMedicationEditorOpen((open) => !open)}
        onToggle={(medication) => void toggleMedication(medication)}
        onEdit={(medication) => {
          setEditingMedicationId(medication.id);
          setMedicationName(medication.name);
          setMedicationSchedule(medication.schedule);
        }}
        onArchive={(medication) => void removeMedication(medication)}
        onNameChange={setMedicationName}
        onScheduleChange={setMedicationSchedule}
        onSave={() => void addMedication()}
        onCancelEdit={() => {
          setEditingMedicationId(null);
          setMedicationName('');
          setMedicationSchedule('morning');
        }}
      />

      <TodayTiming gym={gym} sleep={sleep} latestFast={latestFast} />

      <TodayLog dashboard={dashboard} onOpenNewEntry={openNewEntry} onOpenEntry={openEntry} />

      {entryDraft ? (
        <TodayEntrySheet
          dashboard={dashboard}
          entryDraft={entryDraft}
          entryError={entryError}
          pendingId={pendingId}
          entrySheetBackdropRef={entrySheetBackdropRef}
          entrySheetRef={entrySheetRef}
          entryFoodSelectRef={entryFoodSelectRef}
          entryNameInputRef={entryNameInputRef}
          onKeyDown={handleEntrySheetKeyDown}
          onClose={() => setEntryDraft(null)}
          onChooseMode={chooseEntryMode}
          onChooseFood={chooseEntryFood}
          onDraftChange={(updater) =>
            setEntryDraft((current) => (current ? updater(current) : current))
          }
          onClearEntryError={() => setEntryError(null)}
          onSave={() => void saveEntry()}
          onRemove={() => void removeEntry()}
        />
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

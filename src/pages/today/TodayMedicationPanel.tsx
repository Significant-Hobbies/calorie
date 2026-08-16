import { Archive, Check, Pencil, Pill, Plus } from 'lucide-react';
import type { Medication, MedicationCheckIn, MedicationSchedule } from '../../lib/types';

export function TodayMedicationPanel({
  medications,
  medicationCheckIns,
  pendingId,
  editorOpen,
  medicationName,
  medicationSchedule,
  editingMedicationId,
  onToggleEditor,
  onToggle,
  onEdit,
  onArchive,
  onNameChange,
  onScheduleChange,
  onSave,
  onCancelEdit,
}: {
  medications: Medication[];
  medicationCheckIns: MedicationCheckIn[];
  pendingId: string | null;
  editorOpen: boolean;
  medicationName: string;
  medicationSchedule: MedicationSchedule;
  editingMedicationId: string | null;
  onToggleEditor: () => void;
  onToggle: (medication: Medication) => void;
  onEdit: (medication: Medication) => void;
  onArchive: (medication: Medication) => void;
  onNameChange: (value: string) => void;
  onScheduleChange: (value: MedicationSchedule) => void;
  onSave: () => void;
  onCancelEdit: () => void;
}) {
  return (
    <section className="medication-panel" aria-labelledby="medication-title">
      <div className="section-heading medication-heading">
        <div>
          <h2 id="medication-title">
            <Pill size={19} aria-hidden="true" />
            Medications
          </h2>
          <p>Track the routine you set for today.</p>
        </div>
        <button className="text-button" type="button" onClick={onToggleEditor}>
          {editorOpen ? 'Done' : 'Manage'}
        </button>
      </div>

      {medications.length ? (
        <div className="medication-list">
          {medications.map((medication) => {
            const checked = medicationCheckIns.some(
              (checkIn) => checkIn.medicationId === medication.id
            );
            return (
              <div className="medication-row" key={medication.id}>
                <button
                  className={`medication-check${checked ? ' is-checked' : ''}`}
                  type="button"
                  disabled={Boolean(pendingId)}
                  aria-pressed={checked}
                  onClick={() => onToggle(medication)}
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
                {editorOpen ? (
                  <span className="medication-actions">
                    <button
                      className="icon-button subtle"
                      type="button"
                      disabled={Boolean(pendingId)}
                      aria-label={`Edit ${medication.name}`}
                      onClick={() => onEdit(medication)}
                    >
                      <Pencil size={17} aria-hidden="true" />
                    </button>
                    <button
                      className="icon-button subtle"
                      type="button"
                      disabled={Boolean(pendingId)}
                      aria-label={`Archive ${medication.name}`}
                      onClick={() => onArchive(medication)}
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

      {editorOpen ? (
        <form
          id="medication-editor"
          className="medication-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSave();
          }}
        >
          <label className="field">
            <span>Medication name</span>
            <input
              value={medicationName}
              maxLength={80}
              placeholder="e.g. Vitamin D"
              onChange={(event) => onNameChange(event.target.value)}
            />
          </label>
          <label className="field">
            <span>When</span>
            <select
              value={medicationSchedule}
              onChange={(event) => onScheduleChange(event.target.value as MedicationSchedule)}
            >
              <option value="morning">Morning</option>
              <option value="evening">Evening</option>
              <option value="either">Either</option>
            </select>
          </label>
          <button className="button button-primary" type="submit" disabled={!medicationName.trim()}>
            <Plus size={17} aria-hidden="true" />
            {editingMedicationId ? 'Save changes' : 'Add medication'}
          </button>
          {editingMedicationId ? (
            <button className="text-button medication-cancel" type="button" onClick={onCancelEdit}>
              Cancel editing
            </button>
          ) : null}
          <small className="medication-note">
            Routine tracking only—not dosage or medical advice.
          </small>
        </form>
      ) : null}
    </section>
  );
}

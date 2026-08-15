import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  ChevronRight,
  Download,
  ExternalLink,
  Info,
  LogOut,
  Moon,
  Palette,
  Save,
  SlidersHorizontal,
  Target,
  UserRound,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  getCycleHistory,
  getDashboard,
  getJournalExport,
  isLocalMode,
  saveProfile,
  updateCycleStart,
} from '../lib/api';
import { signOut } from '../lib/auth-client';
import { DEFAULT_DAILY_ACTION_ORDER, moveDailyAction } from '../lib/daily-action-preferences';
import {
  CUT_INTENSITY_DETAILS,
  type CutIntensity,
  CYCLE_DETAILS,
  cutIntensityFromGoal,
  cycleFromGoal,
  type GoalCycle,
  goalFromCycle,
} from '../lib/goal-cycles';
import {
  canPromptInstall,
  isInstalledApp,
  promptInstall,
  subscribeToInstallPrompt,
} from '../lib/install';
import { journalExportFileName, serializeJournalExport } from '../lib/journal-export';
import {
  calculateNutritionTarget,
  calculateTargetWeightProgress,
  formatCalorieAdjustmentRange,
  GOAL_DETAILS,
  METHODOLOGY_LINKS,
} from '../lib/recommendations';
import { getThemePreference, setThemePreference } from '../lib/theme';
import type {
  ActivityLevel,
  CycleHistoryResponse,
  DailyActionKey,
  EquationProfile,
  ThemePreference,
  UserProfile,
} from '../lib/types';

const DAILY_ACTION_LABELS: Record<DailyActionKey, string> = {
  weight: 'Weight check-in',
  creatine: 'Creatine',
  food: 'Food',
  water: 'Water',
};

const displayWeight = (kg: number | null, imperial: boolean) =>
  kg === null ? '' : imperial ? Math.round(kg * 2.20462 * 10) / 10 : kg;
const storedWeight = (value: string, imperial: boolean) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return imperial ? Math.round((amount / 2.20462) * 10) / 10 : amount;
};

export function SettingsPage({
  profile,
  cloudRevision,
  onProfileChange,
}: {
  profile: UserProfile;
  cloudRevision: number;
  onProfileChange: (profile: UserProfile) => void;
}) {
  const [draft, setDraft] = useState(profile);
  const [openSection, setOpenSection] = useState<
    'profile' | 'targets' | 'rhythm' | 'prompts' | null
  >(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [latestWeightKg, setLatestWeightKg] = useState<number | null>(null);
  const [theme, setTheme] = useState<ThemePreference>(() => getThemePreference());
  const [installAvailable, setInstallAvailable] = useState(() => canPromptInstall());
  const [cycleHistory, setCycleHistory] = useState<CycleHistoryResponse | null>(null);
  const [cycleStartOn, setCycleStartOn] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    void Promise.all([getDashboard(), getCycleHistory()])
      .then(([dashboard, history]) => {
        setLatestWeightKg(dashboard.latestWeight?.weightKg ?? null);
        setCycleHistory(history);
        setCycleStartOn(history.active.session.startOn);
      })
      .catch(() => undefined);
  }, [cloudRevision]);

  useEffect(() => {
    if (openSection === null) setDraft(profile);
  }, [openSection, profile]);

  useEffect(
    () =>
      subscribeToInstallPrompt(() => {
        setInstallAvailable(canPromptInstall());
      }),
    []
  );

  const target = useMemo(
    () =>
      calculateNutritionTarget({
        weightKg: latestWeightKg,
        heightCm: draft.heightCm,
        ageYears: draft.ageYears,
        equationProfile: draft.equationProfile,
        activityLevel: draft.activityLevel,
        goal: draft.goal,
        manualCalorieTarget: draft.manualCalorieTarget,
        manualCalorieRange: draft.manualCalorieRange,
      }),
    [draft, latestWeightKg]
  );
  const targetProgress =
    latestWeightKg && draft.targetWeightKg
      ? calculateTargetWeightProgress(latestWeightKg, draft.targetWeightKg)
      : null;
  const cycle = cycleFromGoal(draft.goal);
  const cutIntensity = cutIntensityFromGoal(draft.goal);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const manualCalorieRange: [number, number] | null = draft.manualCalorieRange
        ? [Math.min(...draft.manualCalorieRange), Math.max(...draft.manualCalorieRange)]
        : null;
      const saved = await saveProfile({ ...draft, manualCalorieRange });
      if (cycleStartOn && cycleStartOn !== cycleHistory?.active.session.startOn) {
        await updateCycleStart(cycleStartOn);
      }
      onProfileChange(saved);
      setDraft(saved);
      const refreshedHistory = await getCycleHistory();
      setCycleHistory(refreshedHistory);
      setCycleStartOn(refreshedHistory.active.session.startOn);
      setMessage('Changes saved.');
      setOpenSection(null);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Changes could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const toggle = (section: typeof openSection) =>
    setOpenSection((current) => (current === section ? null : section));

  const downloadBackup = async () => {
    setExporting(true);
    setMessage(null);
    try {
      const backup = await getJournalExport();
      const url = URL.createObjectURL(
        new Blob([serializeJournalExport(backup)], { type: 'application/json' })
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = journalExportFileName(new Date(backup.generatedAt));
      link.click();
      URL.revokeObjectURL(url);
      setMessage('Backup downloaded. Keep it somewhere private.');
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Backup could not be downloaded.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="page-stack">
      <header className="page-heading">
        <p>Your preferences</p>
        <h1>You</h1>
        <span>Adjust the assumptions behind your estimates.</span>
      </header>

      <section className="profile-card">
        <span className="profile-avatar">{draft.displayName.slice(0, 1).toUpperCase()}</span>
        <div>
          <h2>{draft.displayName}</h2>
          <p>
            {CYCLE_DETAILS[cycle].shortLabel} · {draft.units === 'metric' ? 'Metric' : 'Imperial'}
          </p>
        </div>
        <span className="profile-leaf" aria-hidden="true" />
      </section>

      {message ? (
        <p className="settings-message" role="status">
          {message}
        </p>
      ) : null}

      <section className="settings-group" aria-label="Profile settings">
        <button
          className="settings-row"
          type="button"
          aria-expanded={openSection === 'profile'}
          aria-controls="profile-settings-editor"
          onClick={() => toggle('profile')}
        >
          <span className="settings-icon">
            <UserRound aria-hidden="true" />
          </span>
          <span>
            <strong>Profile & body inputs</strong>
            <small>Name, age, height and equation choice</small>
          </span>
          <ChevronRight className={openSection === 'profile' ? 'is-open' : ''} aria-hidden="true" />
        </button>
        {openSection === 'profile' ? (
          <div className="settings-editor" id="profile-settings-editor">
            <label className="field">
              <span>Name</span>
              <input
                value={draft.displayName}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, displayName: event.target.value }))
                }
              />
            </label>
            <div className="field-row">
              <label className="field">
                <span>Age</span>
                <input
                  type="number"
                  min="18"
                  max="120"
                  value={draft.ageYears ?? ''}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      ageYears: Number(event.target.value) || null,
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>Height (cm)</span>
                <input
                  type="number"
                  value={draft.heightCm ?? ''}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      heightCm: Number(event.target.value) || null,
                    }))
                  }
                />
              </label>
            </div>
            <label className="field">
              <span>Equation profile</span>
              <select
                value={draft.equationProfile ?? 'none'}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    equationProfile: event.target.value as EquationProfile,
                  }))
                }
              >
                <option value="female">Female equation</option>
                <option value="male">Male equation</option>
                <option value="none">Skip calorie estimate</option>
              </select>
            </label>
            <p className="inline-note">
              <Info size={17} aria-hidden="true" />
              This equation choice is separate from gender identity.
            </p>
          </div>
        ) : null}

        <button
          className="settings-row"
          type="button"
          aria-expanded={openSection === 'targets'}
          aria-controls="target-settings-editor"
          onClick={() => toggle('targets')}
        >
          <span className="settings-icon amber">
            <Target aria-hidden="true" />
          </span>
          <span>
            <strong>Goal & daily range</strong>
            <small>
              {target.calorieRange
                ? `${target.calorieRange[0].toLocaleString()}–${target.calorieRange[1].toLocaleString()} kcal`
                : 'No calorie estimate'}
            </small>
          </span>
          <ChevronRight className={openSection === 'targets' ? 'is-open' : ''} aria-hidden="true" />
        </button>
        {openSection === 'targets' ? (
          <div className="settings-editor" id="target-settings-editor">
            <label className="field">
              <span>Activity level</span>
              <select
                value={draft.activityLevel}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    activityLevel: event.target.value as ActivityLevel,
                  }))
                }
              >
                <option value="sedentary">Mostly seated</option>
                <option value="light">Lightly active</option>
                <option value="moderate">Moderately active</option>
                <option value="very">Very active</option>
              </select>
              <small>Scales resting energy into estimated maintenance calories.</small>
            </label>
            <fieldset className="field">
              <legend>Current cycle</legend>
              <div className="cycle-grid">
                {(Object.keys(CYCLE_DETAILS) as GoalCycle[]).map((option) => (
                  <button
                    className={cycle === option ? 'cycle-option is-selected' : 'cycle-option'}
                    type="button"
                    key={option}
                    aria-pressed={cycle === option}
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        goal: goalFromCycle(option, cutIntensityFromGoal(current.goal)),
                        targetWeightKg: option === 'recomposition' ? null : current.targetWeightKg,
                      }))
                    }
                  >
                    <strong>{CYCLE_DETAILS[option].label}</strong>
                    <small>{CYCLE_DETAILS[option].description}</small>
                  </button>
                ))}
              </div>
            </fieldset>
            {cycle === 'cut' ? (
              <fieldset className="field">
                <legend>Cut intensity</legend>
                <div className="segmented">
                  {(Object.keys(CUT_INTENSITY_DETAILS) as CutIntensity[]).map((intensity) => (
                    <button
                      className={cutIntensity === intensity ? 'is-selected' : ''}
                      type="button"
                      key={intensity}
                      aria-pressed={cutIntensity === intensity}
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          goal: goalFromCycle('cut', intensity),
                        }))
                      }
                    >
                      {CUT_INTENSITY_DETAILS[intensity].label}
                    </button>
                  ))}
                </div>
                <small>{CUT_INTENSITY_DETAILS[cutIntensity].description}.</small>
              </fieldset>
            ) : (
              <p className="cycle-explanation">{GOAL_DETAILS[draft.goal].explanation}.</p>
            )}
            {cycle !== 'recomposition' ? (
              <label className="field">
                <span>Target weight</span>
                <div className="input-with-unit">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={displayWeight(draft.targetWeightKg, draft.units === 'imperial')}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        targetWeightKg: storedWeight(
                          event.target.value,
                          current.units === 'imperial'
                        ),
                      }))
                    }
                  />
                  <b>{draft.units === 'metric' ? 'kg' : 'lb'}</b>
                </div>
                <small>
                  {targetProgress?.explanation ??
                    'Used to show your distance from the destination, without an invented ETA.'}
                </small>
              </label>
            ) : null}
            <fieldset className="field">
              <span>
                Manual calorie range <small>Optional override</small>
              </span>
              <div className="field-row">
                <input
                  type="number"
                  min="1200"
                  max="6000"
                  placeholder="Lower"
                  aria-label="Manual calorie range lower bound"
                  value={draft.manualCalorieRange?.[0] ?? ''}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      manualCalorieTarget: null,
                      manualCalorieRange: event.target.value
                        ? [
                            Number(event.target.value),
                            current.manualCalorieRange?.[1] ?? Number(event.target.value),
                          ]
                        : null,
                    }))
                  }
                />
                <input
                  type="number"
                  min="1200"
                  max="6000"
                  placeholder="Upper"
                  aria-label="Manual calorie range upper bound"
                  value={draft.manualCalorieRange?.[1] ?? ''}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      manualCalorieTarget: null,
                      manualCalorieRange: event.target.value
                        ? [
                            current.manualCalorieRange?.[0] ?? Number(event.target.value),
                            Number(event.target.value),
                          ]
                        : null,
                    }))
                  }
                />
              </div>
              <small>
                Leave both blank to use the automatic cycle range. This override stays in place if
                you switch cycles.
              </small>
            </fieldset>
            {cycleHistory ? (
              <div className="cycle-history-settings">
                <label className="field">
                  <span>Current cycle started</span>
                  <input
                    type="date"
                    max={cycleHistory.today}
                    value={cycleStartOn}
                    onChange={(event) => setCycleStartOn(event.target.value)}
                  />
                  <small>
                    Backdate this only to the day you actually began. It changes cycle analytics,
                    not your journal entries.
                  </small>
                </label>
                {cycleHistory.previous ? (
                  <details className="cycle-history-disclosure">
                    <summary>Previous cycle</summary>
                    <p>
                      {CYCLE_DETAILS[cycleHistory.previous.session.cycle].label} ·{' '}
                      {cycleHistory.previous.session.startOn} to{' '}
                      {cycleHistory.previous.session.endOn}
                    </p>
                  </details>
                ) : (
                  <p className="cycle-explanation">
                    Your first completed cycle will appear here when you switch direction.
                  </p>
                )}
              </div>
            ) : null}
            <div className="target-math">
              <span>How your range is built</span>
              {target.maintenanceCalories ? (
                <strong>
                  {target.maintenanceCalories.toLocaleString()} maintenance{' '}
                  {formatCalorieAdjustmentRange(target.goalAdjustmentRangeCalories)} ={' '}
                  {target.calorieRange?.[0].toLocaleString()}–
                  {target.calorieRange?.[1].toLocaleString()} kcal
                </strong>
              ) : (
                <strong>
                  {target.calorieRange
                    ? `${target.calorieRange[0].toLocaleString()}–${target.calorieRange[1].toLocaleString()} kcal manual range`
                    : 'Complete body inputs or add a manual range'}
                </strong>
              )}
              <small>
                Automatic ranges use your cycle’s share of maintenance and do not go below 1,200
                kcal.
              </small>
            </div>
          </div>
        ) : null}

        <button
          className="settings-row"
          type="button"
          aria-expanded={openSection === 'rhythm'}
          aria-controls="rhythm-settings-editor"
          onClick={() => toggle('rhythm')}
        >
          <span className="settings-icon plum">
            <Moon aria-hidden="true" />
          </span>
          <span>
            <strong>Sleep & water</strong>
            <small>
              Wake {draft.wakeTime} · {(draft.waterTargetMl / 1000).toFixed(1)}L
            </small>
          </span>
          <ChevronRight className={openSection === 'rhythm' ? 'is-open' : ''} aria-hidden="true" />
        </button>
        {openSection === 'rhythm' ? (
          <div className="settings-editor" id="rhythm-settings-editor">
            <div className="field-row">
              <label className="field">
                <span>Wake time</span>
                <input
                  type="time"
                  value={draft.wakeTime}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, wakeTime: event.target.value }))
                  }
                />
              </label>
              <label className="field">
                <span>Sleep need</span>
                <select
                  value={draft.sleepHours}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      sleepHours: Number(event.target.value),
                    }))
                  }
                >
                  {[7, 7.5, 8, 8.5, 9].map((hours) => (
                    <option value={hours} key={hours}>
                      {hours} hours
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field">
              <span>Water target</span>
              <div className="input-with-unit">
                <input
                  type="number"
                  min="500"
                  max="8000"
                  step="100"
                  value={draft.waterTargetMl}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      waterTargetMl: Number(event.target.value) || 2000,
                    }))
                  }
                />
                <b>ml</b>
              </div>
            </label>
          </div>
        ) : null}

        <button
          className="settings-row"
          type="button"
          aria-expanded={openSection === 'prompts'}
          aria-controls="prompt-settings-editor"
          onClick={() => toggle('prompts')}
        >
          <span className="settings-icon amber">
            <SlidersHorizontal aria-hidden="true" />
          </span>
          <span>
            <strong>Daily prompts</strong>
            <small>
              {DEFAULT_DAILY_ACTION_ORDER.length - draft.dailyActionHidden.length} shown · choose
              their order
            </small>
          </span>
          <ChevronRight className={openSection === 'prompts' ? 'is-open' : ''} aria-hidden="true" />
        </button>
        {openSection === 'prompts' ? (
          <div className="settings-editor" id="prompt-settings-editor">
            <p className="cycle-explanation">
              Today shows these prompts in your order, then removes each one after it is done.
            </p>
            <ol className="prompt-preference-list">
              {draft.dailyActionOrder.map((action, index) => {
                const hidden = draft.dailyActionHidden.includes(action);
                return (
                  <li key={action}>
                    <div>
                      <strong>{DAILY_ACTION_LABELS[action]}</strong>
                      <small>{hidden ? 'Hidden from Today' : `Position ${index + 1}`}</small>
                    </div>
                    <div className="prompt-preference-actions">
                      <button
                        type="button"
                        className="button button-quiet"
                        aria-label={`Move ${DAILY_ACTION_LABELS[action]} up`}
                        disabled={index === 0}
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            dailyActionOrder: moveDailyAction(current.dailyActionOrder, action, -1),
                          }))
                        }
                      >
                        <ArrowUp aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="button button-quiet"
                        aria-label={`Move ${DAILY_ACTION_LABELS[action]} down`}
                        disabled={index === draft.dailyActionOrder.length - 1}
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            dailyActionOrder: moveDailyAction(current.dailyActionOrder, action, 1),
                          }))
                        }
                      >
                        <ArrowDown aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="button button-secondary prompt-visibility-button"
                        aria-pressed={!hidden}
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            dailyActionHidden: hidden
                              ? current.dailyActionHidden.filter((key) => key !== action)
                              : [...current.dailyActionHidden, action],
                          }))
                        }
                      >
                        {hidden ? 'Show' : 'Hide'}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        ) : null}
      </section>

      <section className="settings-group" aria-label="App preferences">
        <div className="settings-row settings-choice-row">
          <span className="settings-icon plum">
            <Palette aria-hidden="true" />
          </span>
          <div>
            <strong>Appearance</strong>
            <small>Light by default; choose Dark or follow your device</small>
          </div>
          <select
            aria-label="Appearance"
            value={theme}
            onChange={(event) => {
              const preference = event.target.value as ThemePreference;
              setTheme(preference);
              setThemePreference(preference);
            }}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </div>
        <button
          className="settings-row"
          type="button"
          disabled={isInstalledApp()}
          onClick={() => {
            if (!installAvailable) {
              setMessage('Use your browser menu and choose “Install app” or “Add to Home Screen”.');
              return;
            }
            void promptInstall().then((installed) => {
              setInstallAvailable(canPromptInstall());
              setMessage(installed ? 'Calorie installed.' : 'Install cancelled.');
            });
          }}
        >
          <span className="settings-icon">
            <Download aria-hidden="true" />
          </span>
          <span>
            <strong>{isInstalledApp() ? 'App installed' : 'Install Calorie'}</strong>
            <small>
              {installAvailable
                ? 'Add a fast, full-screen shortcut to this device'
                : 'Available from supported browser menus'}
            </small>
          </span>
          <ChevronRight aria-hidden="true" />
        </button>
        <button
          className="settings-row"
          type="button"
          disabled={exporting}
          onClick={() => void downloadBackup()}
        >
          <span className="settings-icon amber">
            <Download aria-hidden="true" />
          </span>
          <span>
            <strong>{exporting ? 'Preparing backup…' : 'Download data backup'}</strong>
            <small>Profile, foods, logs, weights and cycle history as private JSON</small>
          </span>
          <ChevronRight aria-hidden="true" />
        </button>
      </section>

      {openSection ? (
        <button
          className="button button-primary full-button"
          type="button"
          disabled={saving}
          onClick={() => void save()}
        >
          <Save size={18} aria-hidden="true" />
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      ) : null}

      <section className="method-card" aria-labelledby="method-title">
        <span className="section-icon small">
          <BookOpen aria-hidden="true" />
        </span>
        <div>
          <p>Transparent by design</p>
          <h2 id="method-title">How the suggestions work</h2>
          <p>
            Energy uses Mifflin–St Jeor plus a standard activity multiplier and an automatic 1,200
            kcal floor. Protein uses 1.6–2.0 g/kg during loss or 1.4–1.8 g/kg otherwise, fibre uses
            14 g per 1,000 kcal, and timing suggestions use broad food-to-activity or food-to-bed
            windows.
          </p>
          <div className="method-links">
            {Object.entries(METHODOLOGY_LINKS).map(([label, href]) => (
              <a key={label} href={href} target="_blank" rel="noreferrer">
                {label}
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            ))}
          </div>
          <small>
            Calorie offers estimates for reflection, not medical advice. Your needs can differ with
            health conditions, pregnancy, medication, or intensive training.
          </small>
        </div>
      </section>

      <button className="sign-out-button" type="button" onClick={() => void signOut()}>
        <LogOut size={18} aria-hidden="true" />
        {isLocalMode() ? 'Leave local mode' : 'Sign out'}
      </button>
    </div>
  );
}

import {
  BookOpen,
  ChevronRight,
  Download,
  ExternalLink,
  Info,
  LogOut,
  Moon,
  Palette,
  Save,
  Target,
  UserRound,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getDashboard, isLocalMode, saveProfile } from '../lib/api';
import { signOut } from '../lib/auth-client';
import {
  canPromptInstall,
  isInstalledApp,
  promptInstall,
  subscribeToInstallPrompt,
} from '../lib/install';
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
  EquationProfile,
  Goal,
  ThemePreference,
  UserProfile,
} from '../lib/types';

const displayWeight = (kg: number | null, imperial: boolean) =>
  kg === null ? '' : imperial ? Math.round(kg * 2.20462 * 10) / 10 : kg;
const storedWeight = (value: string, imperial: boolean) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return imperial ? Math.round((amount / 2.20462) * 10) / 10 : amount;
};

export function SettingsPage({
  profile,
  onProfileChange,
}: {
  profile: UserProfile;
  onProfileChange: (profile: UserProfile) => void;
}) {
  const [draft, setDraft] = useState(profile);
  const [openSection, setOpenSection] = useState<'profile' | 'targets' | 'rhythm' | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [latestWeightKg, setLatestWeightKg] = useState<number | null>(null);
  const [theme, setTheme] = useState<ThemePreference>(() => getThemePreference());
  const [installAvailable, setInstallAvailable] = useState(() => canPromptInstall());

  useEffect(() => {
    void getDashboard()
      .then((dashboard) => setLatestWeightKg(dashboard.latestWeight?.weightKg ?? null))
      .catch(() => undefined);
  }, []);

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

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const manualCalorieRange: [number, number] | null = draft.manualCalorieRange
        ? [Math.min(...draft.manualCalorieRange), Math.max(...draft.manualCalorieRange)]
        : null;
      const saved = await saveProfile({ ...draft, manualCalorieRange });
      onProfileChange(saved);
      setDraft(saved);
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
            {GOAL_DETAILS[draft.goal].shortLabel} ·{' '}
            {draft.units === 'metric' ? 'Metric' : 'Imperial'}
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
        <button className="settings-row" type="button" onClick={() => toggle('profile')}>
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
          <div className="settings-editor">
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

        <button className="settings-row" type="button" onClick={() => toggle('targets')}>
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
          <div className="settings-editor">
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
            <label className="field">
              <span>Goal</span>
              <select
                value={draft.goal}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    goal: event.target.value as Goal,
                    targetWeightKg:
                      event.target.value === 'maintain' ? null : current.targetWeightKg,
                  }))
                }
              >
                {(Object.keys(GOAL_DETAILS) as Goal[]).map((goal) => (
                  <option value={goal} key={goal}>
                    {GOAL_DETAILS[goal].label}
                  </option>
                ))}
              </select>
              <small>{GOAL_DETAILS[draft.goal].explanation}.</small>
            </label>
            {draft.goal !== 'maintain' ? (
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
              <small>Leave both blank to use the automatic range.</small>
            </fieldset>
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
                Automatic ranges use your goal’s share of maintenance and do not go below 1,200
                kcal.
              </small>
            </div>
          </div>
        ) : null}

        <button className="settings-row" type="button" onClick={() => toggle('rhythm')}>
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
          <div className="settings-editor">
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

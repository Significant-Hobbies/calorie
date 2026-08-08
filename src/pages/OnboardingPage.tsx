import { ArrowLeft, ArrowRight, Check, Info, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AppMark } from '../components/AppMark';
import { saveProfile } from '../lib/api';
import { signOut } from '../lib/auth-client';
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
  clearOnboardingDraft,
  type OnboardingDraft,
  readOnboardingDraft,
  saveOnboardingDraft,
} from '../lib/onboarding-draft';
import {
  calculateNutritionTarget,
  calculateTargetWeightProgress,
  formatCalorieAdjustmentRange,
  GOAL_DETAILS,
} from '../lib/recommendations';
import type { ActivityLevel, EquationProfile, Units, UserProfile } from '../lib/types';

const toDisplayWeight = (kg: number | null, units: Units) =>
  kg === null ? '' : units === 'metric' ? String(kg) : String(Math.round(kg * 2.20462 * 10) / 10);
const fromDisplayWeight = (value: string, units: Units) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return units === 'metric' ? number : Math.round((number / 2.20462) * 10) / 10;
};
const toDisplayHeight = (cm: number | null, units: Units) =>
  cm === null ? '' : units === 'metric' ? String(cm) : String(Math.round((cm / 2.54) * 10) / 10);
const fromDisplayHeight = (value: string, units: Units) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return units === 'metric' ? number : Math.round(number * 2.54 * 10) / 10;
};

function initialState(profile: UserProfile) {
  const saved = readOnboardingDraft(profile.userId);
  if (saved) return saved;
  return {
    version: 2 as const,
    step: 0,
    draft: {
      ...profile,
      displayName: profile.displayName || '',
      units: profile.units || 'metric',
      genderIdentity: null,
      equationProfile: profile.equationProfile ?? 'none',
      initialWeightKg: null,
      initialWeightId: crypto.randomUUID(),
    },
  };
}

export function OnboardingPage({
  initialProfile,
  onComplete,
}: {
  initialProfile: UserProfile;
  onComplete: (profile: UserProfile) => void;
}) {
  const [savedState] = useState(() => initialState(initialProfile));
  const [step, setStep] = useState(savedState.step);
  const [draft, setDraft] = useState<OnboardingDraft>(savedState.draft);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    saveOnboardingDraft(draft.userId, step, draft);
  }, [draft, step]);

  const target = useMemo(
    () =>
      calculateNutritionTarget({
        weightKg: draft.initialWeightKg,
        heightCm: draft.heightCm,
        ageYears: draft.ageYears,
        equationProfile: draft.equationProfile,
        activityLevel: draft.activityLevel,
        goal: draft.goal,
        manualCalorieTarget: draft.manualCalorieTarget,
        manualCalorieRange: draft.manualCalorieRange,
      }),
    [draft]
  );

  const targetProgress =
    draft.initialWeightKg && draft.targetWeightKg
      ? calculateTargetWeightProgress(draft.initialWeightKg, draft.targetWeightKg)
      : null;
  const cycle = cycleFromGoal(draft.goal);
  const cutIntensity = cutIntensityFromGoal(draft.goal);

  const validateStep = () => {
    if (step === 0) {
      if (!draft.displayName.trim()) return 'Tell us what to call you.';
      if (cycle !== 'recomposition' && !draft.targetWeightKg) {
        return 'Add a target weight, or choose Recomposition.';
      }
    }
    if (step === 1) {
      if (!draft.ageYears || draft.ageYears < 18 || draft.ageYears > 120) {
        return 'Add an age between 18 and 120.';
      }
      if (!draft.heightCm || !draft.initialWeightKg || !draft.equationProfile) {
        return 'Add your height, weight, and energy-equation choice.';
      }
      if (
        draft.targetWeightKg &&
        (draft.goal === 'lose_gentle' || draft.goal === 'lose_steady') &&
        draft.targetWeightKg >= draft.initialWeightKg
      ) {
        return 'For a loss goal, choose a target below your current weight.';
      }
      if (
        draft.targetWeightKg &&
        draft.goal === 'gain_gentle' &&
        draft.targetWeightKg <= draft.initialWeightKg
      ) {
        return 'For a gain goal, choose a target above your current weight.';
      }
    }
    if (step === 2 && (!draft.wakeTime || draft.waterTargetMl < 250)) {
      return 'Add a wake time and a daily water target.';
    }
    return null;
  };

  const next = () => {
    const issue = validateStep();
    if (issue) {
      setError(issue);
      return;
    }
    setError(null);
    setStep((current) => Math.min(2, current + 1));
  };

  const finish = async () => {
    const issue = validateStep();
    if (issue) {
      setError(issue);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await saveProfile({
        ...draft,
        displayName: draft.displayName.trim(),
        genderIdentity: null,
        onboardingComplete: true,
        initialWeightKg: draft.initialWeightKg ?? undefined,
      });
      clearOnboardingDraft(draft.userId);
      onComplete(saved);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'We could not save your profile.');
      setSaving(false);
    }
  };

  return (
    <main className="onboarding-page" id="main-content">
      <header className="onboarding-header">
        <AppMark />
        <div className="onboarding-header-meta">
          <span>{step + 1} of 3</span>
          <button type="button" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </header>
      <div
        className="progress-track"
        role="progressbar"
        aria-label="Onboarding progress"
        aria-valuemin={1}
        aria-valuemax={3}
        aria-valuenow={step + 1}
      >
        <span style={{ width: `${((step + 1) / 3) * 100}%` }} />
      </div>

      <section className="onboarding-panel">
        {step === 0 ? (
          <>
            <div className="section-icon">
              <Sparkles aria-hidden="true" />
            </div>
            <h1>What are you working toward?</h1>
            <p className="lede">
              Choose your current nutrition cycle. You can change it whenever your focus shifts.
            </p>

            <label className="field">
              <span>What should we call you?</span>
              <input
                value={draft.displayName}
                autoComplete="given-name"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, displayName: event.target.value }))
                }
              />
            </label>

            <fieldset className="field">
              <legend>Current cycle</legend>
              <div className="choice-stack">
                {(Object.keys(CYCLE_DETAILS) as GoalCycle[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={
                      cycle === option ? 'choice goal-choice is-selected' : 'choice goal-choice'
                    }
                    aria-pressed={cycle === option}
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        goal: goalFromCycle(option, cutIntensityFromGoal(current.goal)),
                        targetWeightKg: option === 'recomposition' ? null : current.targetWeightKg,
                      }))
                    }
                  >
                    <span className="choice-dot" />
                    <span>
                      <strong>{CYCLE_DETAILS[option].label}</strong>
                      <small>{CYCLE_DETAILS[option].description}</small>
                    </span>
                    {cycle === option ? <Check size={18} /> : null}
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
                      key={intensity}
                      type="button"
                      className={cutIntensity === intensity ? 'is-selected' : ''}
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
            ) : null}

            {cycle !== 'recomposition' ? (
              <label className="field">
                <span>Target weight</span>
                <div className="input-with-unit">
                  <input
                    inputMode="decimal"
                    type="number"
                    value={toDisplayWeight(draft.targetWeightKg, draft.units)}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        targetWeightKg: fromDisplayWeight(event.target.value, current.units),
                      }))
                    }
                  />
                  <b>{draft.units === 'metric' ? 'kg' : 'lb'}</b>
                </div>
                <small>Used to show distance to your goal, never a made-up deadline.</small>
              </label>
            ) : null}

            <fieldset className="field">
              <legend>Measurement units</legend>
              <div className="segmented">
                {(['metric', 'imperial'] as Units[]).map((units) => (
                  <button
                    key={units}
                    type="button"
                    className={draft.units === units ? 'is-selected' : ''}
                    aria-pressed={draft.units === units}
                    onClick={() => setDraft((current) => ({ ...current, units }))}
                  >
                    {units === 'metric' ? 'Metric · kg, cm' : 'Imperial · lb, in'}
                  </button>
                ))}
              </div>
            </fieldset>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <h1>Build your daily plan</h1>
            <p className="lede">These inputs turn your goal into transparent daily ranges.</p>

            <div className="field-row">
              <label className="field">
                <span>Age</span>
                <input
                  inputMode="numeric"
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
                <span>Height</span>
                <div className="input-with-unit">
                  <input
                    inputMode="decimal"
                    type="number"
                    value={toDisplayHeight(draft.heightCm, draft.units)}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        heightCm: fromDisplayHeight(event.target.value, current.units),
                      }))
                    }
                  />
                  <b>{draft.units === 'metric' ? 'cm' : 'in'}</b>
                </div>
              </label>
            </div>

            <label className="field">
              <span>Current weight</span>
              <div className="input-with-unit">
                <input
                  inputMode="decimal"
                  type="number"
                  value={toDisplayWeight(draft.initialWeightKg, draft.units)}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      initialWeightKg: fromDisplayWeight(event.target.value, current.units),
                    }))
                  }
                />
                <b>{draft.units === 'metric' ? 'kg' : 'lb'}</b>
              </div>
              <small>Sets your protein range and begins your weight history.</small>
            </label>

            <label className="field">
              <span>Usual activity</span>
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
              <legend>Energy equation profile</legend>
              <div className="segmented segmented-three">
                {(
                  [
                    ['female', 'Female'],
                    ['male', 'Male'],
                    ['none', 'Skip'],
                  ] as Array<[EquationProfile, string]>
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={draft.equationProfile === value ? 'is-selected' : ''}
                    aria-pressed={draft.equationProfile === value}
                    onClick={() => setDraft((current) => ({ ...current, equationProfile: value }))}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
            <p className="inline-note">
              <Info size={17} aria-hidden="true" />
              Mifflin–St Jeor publishes female and male equations. This is only a calculation
              choice, not a gender-identity question.
            </p>

            <div className="estimate-preview plan-preview" aria-live="polite">
              <span>Your plan so far</span>
              <strong>
                {target.calorieRange
                  ? `${target.calorieRange[0].toLocaleString()}–${target.calorieRange[1].toLocaleString()} kcal`
                  : 'Calorie estimate skipped'}
              </strong>
              {target.maintenanceCalories ? (
                <p>
                  {target.maintenanceCalories.toLocaleString()} maintenance{' '}
                  {formatCalorieAdjustmentRange(target.goalAdjustmentRangeCalories)} for{' '}
                  {CYCLE_DETAILS[cycle].shortLabel.toLowerCase()}.
                </p>
              ) : (
                <p>You can add a manual calorie range later in Settings.</p>
              )}
              {targetProgress ? <p>{targetProgress.explanation}</p> : null}
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h1>Fit it to your day</h1>
            <p className="lede">
              Your wake time shapes sleep guidance. Water gets a one-tap target.
            </p>

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
                    <option key={hours} value={hours}>
                      {hours} hours
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="field">
              <span>Daily water target</span>
              <div className="input-with-unit">
                <input
                  inputMode="numeric"
                  type="number"
                  step="250"
                  min="250"
                  max="10000"
                  value={
                    draft.units === 'metric'
                      ? draft.waterTargetMl
                      : Math.round(draft.waterTargetMl / 29.5735)
                  }
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      waterTargetMl:
                        current.units === 'metric'
                          ? Number(event.target.value)
                          : Math.round(Number(event.target.value) * 29.5735),
                    }))
                  }
                />
                <b>{draft.units === 'metric' ? 'ml' : 'fl oz'}</b>
              </div>
            </label>

            <div className="plan-summary">
              <span>Your answers, put to work</span>
              <dl>
                <div>
                  <dt>Cycle</dt>
                  <dd>
                    {CYCLE_DETAILS[cycle].label} · {GOAL_DETAILS[draft.goal].explanation}
                  </dd>
                </div>
                <div>
                  <dt>Daily energy</dt>
                  <dd>
                    {target.calorieRange
                      ? `${target.calorieRange[0].toLocaleString()}–${target.calorieRange[1].toLocaleString()} kcal`
                      : 'Manual target available in Settings'}
                  </dd>
                </div>
                <div>
                  <dt>Protein</dt>
                  <dd>
                    {target.proteinRangeG
                      ? `${target.proteinRangeG[0]}–${target.proteinRangeG[1]} g from your weight`
                      : 'Available after your first weight'}
                  </dd>
                </div>
                <div>
                  <dt>Water</dt>
                  <dd>{draft.waterTargetMl.toLocaleString()} ml with one-tap logging</dd>
                </div>
                <div>
                  <dt>Sleep</dt>
                  <dd>
                    {draft.sleepHours} hours before a {draft.wakeTime} wake time, adjusted for late
                    meals
                  </dd>
                </div>
              </dl>
            </div>
          </>
        ) : null}

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      <footer className="onboarding-actions">
        {step > 0 ? (
          <button
            className="button button-secondary"
            type="button"
            onClick={() => {
              setError(null);
              setStep((current) => current - 1);
            }}
          >
            <ArrowLeft size={18} aria-hidden="true" />
            Back
          </button>
        ) : (
          <span />
        )}
        <button
          className="button button-primary"
          type="button"
          disabled={saving}
          onClick={step === 2 ? () => void finish() : next}
        >
          {step === 2 ? (saving ? 'Saving…' : 'Open my log') : 'Continue'}
          {!saving && <ArrowRight size={18} aria-hidden="true" />}
        </button>
      </footer>
    </main>
  );
}

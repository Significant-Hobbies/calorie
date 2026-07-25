import { ArrowLeft, ArrowRight, Check, Info, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AppMark } from '../components/AppMark';
import { saveProfile } from '../lib/api';
import { calculateNutritionTarget } from '../lib/recommendations';
import type { ActivityLevel, EquationProfile, Goal, Units, UserProfile } from '../lib/types';

type Draft = UserProfile & { initialWeightKg: number | null; initialWeightId?: string };

const goalLabels: Record<Goal, string> = {
  lose_gentle: 'Lose gently',
  lose_steady: 'Lose steadily',
  maintain: 'Maintain',
  gain_gentle: 'Gain gently',
};

const toDisplayWeight = (kg: number | null, units: Units) =>
  kg === null ? '' : units === 'metric' ? String(kg) : String(Math.round(kg * 2.20462 * 10) / 10);
const fromDisplayWeight = (value: string, units: Units) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return units === 'metric' ? number : Math.round((number / 2.20462) * 10) / 10;
};
const toDisplayHeight = (cm: number | null, units: Units) =>
  cm === null ? '' : units === 'metric' ? String(cm) : String(Math.round((cm / 2.54) * 10) / 10);
const fromDisplayHeight = (value: string, units: Units) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return units === 'metric' ? number : Math.round(number * 2.54 * 10) / 10;
};

export function OnboardingPage({
  initialProfile,
  onComplete,
}: {
  initialProfile: UserProfile;
  onComplete: (profile: UserProfile) => void;
}) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>({
    ...initialProfile,
    displayName: initialProfile.displayName || '',
    units: initialProfile.units || 'metric',
    initialWeightKg: null,
    equationProfile: initialProfile.equationProfile ?? 'none',
    targetWeightKg: initialProfile.targetWeightKg,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
      }),
    [draft]
  );

  const validateStep = () => {
    if (step === 0 && !draft.displayName.trim()) return 'Tell us what to call you.';
    if (
      step === 1 &&
      (!draft.ageYears || !draft.heightCm || !draft.initialWeightKg || !draft.equationProfile)
    ) {
      return 'Add your age, height, weight, and equation choice.';
    }
    if (step === 2 && draft.goal !== 'maintain' && !draft.targetWeightKg) {
      return 'Add a target weight, or choose Maintain.';
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
    setStep((current) => Math.min(3, current + 1));
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
        onboardingComplete: true,
        initialWeightId: draft.initialWeightId ?? crypto.randomUUID(),
        initialWeightKg: draft.initialWeightKg ?? undefined,
      });
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
        <span>{step + 1} of 4</span>
      </header>
      <div
        className="progress-track"
        role="progressbar"
        aria-label="Onboarding progress"
        aria-valuemin={1}
        aria-valuemax={4}
        aria-valuenow={step + 1}
      >
        <span style={{ width: `${((step + 1) / 4) * 100}%` }} />
      </div>

      <section className="onboarding-panel">
        {step === 0 ? (
          <>
            <div className="section-icon">
              <Sparkles aria-hidden="true" />
            </div>
            <h1>Let’s make this yours</h1>
            <p className="lede">Start with the basics. You can change every detail later.</p>

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

            <label className="field">
              <span>
                Gender identity <small>Optional</small>
              </span>
              <input
                value={draft.genderIdentity ?? ''}
                placeholder="How you describe yourself"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    genderIdentity: event.target.value || null,
                  }))
                }
              />
            </label>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <h1>Your starting point</h1>
            <p className="lede">These details power the optional energy estimate.</p>

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
            </label>

            <fieldset className="field">
              <legend>Which published energy equation should we use?</legend>
              <div className="choice-stack">
                {(
                  [
                    ['female', 'Female equation'],
                    ['male', 'Male equation'],
                    ['none', 'Skip calorie estimate'],
                  ] as Array<[EquationProfile, string]>
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={draft.equationProfile === value ? 'choice is-selected' : 'choice'}
                    aria-pressed={draft.equationProfile === value}
                    onClick={() => setDraft((current) => ({ ...current, equationProfile: value }))}
                  >
                    <span className="choice-dot" />
                    {label}
                    {draft.equationProfile === value ? <Check size={18} /> : null}
                  </button>
                ))}
              </div>
            </fieldset>
            <p className="inline-note">
              <Info size={17} aria-hidden="true" />
              The Mifflin–St Jeor study published separate female and male equations. This choice is
              not your gender identity.
            </p>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h1>What are we aiming for?</h1>
            <p className="lede">Pick a direction. Calorie uses ranges, not pass/fail grades.</p>

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
            </label>

            <fieldset className="field">
              <legend>Your goal</legend>
              <div className="goal-grid">
                {(Object.keys(goalLabels) as Goal[]).map((goal) => (
                  <button
                    key={goal}
                    type="button"
                    className={draft.goal === goal ? 'goal-option is-selected' : 'goal-option'}
                    aria-pressed={draft.goal === goal}
                    onClick={() => setDraft((current) => ({ ...current, goal }))}
                  >
                    {goalLabels[goal]}
                  </button>
                ))}
              </div>
            </fieldset>

            {draft.goal !== 'maintain' ? (
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
              </label>
            ) : null}

            <div className="estimate-preview">
              <span>Starting daily estimate</span>
              <strong>
                {target.calorieRange
                  ? `${target.calorieRange[0].toLocaleString()}–${target.calorieRange[1].toLocaleString()} kcal`
                  : 'Add your own later'}
              </strong>
              <p>It is an estimate, not a prescription. Your real trend helps you adjust it.</p>
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <h1>Your everyday rhythm</h1>
            <p className="lede">This makes timing suggestions fit your actual day.</p>

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

            <fieldset className="field">
              <legend>Count a fast after</legend>
              <div className="segmented segmented-three">
                {([12, 14, 16] as const).map((hours) => (
                  <button
                    key={hours}
                    type="button"
                    className={draft.fastingThresholdHours === hours ? 'is-selected' : ''}
                    aria-pressed={draft.fastingThresholdHours === hours}
                    onClick={() =>
                      setDraft((current) => ({ ...current, fastingThresholdHours: hours }))
                    }
                  >
                    {hours} hours
                  </button>
                ))}
              </div>
            </fieldset>

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

            <div className="ready-note">
              <AppMark showName={false} />
              <div>
                <strong>You’re ready.</strong>
                <span>First log, then learn from your own pattern.</span>
              </div>
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
          onClick={step === 3 ? () => void finish() : next}
        >
          {step === 3 ? (saving ? 'Saving…' : 'Open my log') : 'Continue'}
          {!saving && <ArrowRight size={18} aria-hidden="true" />}
        </button>
      </footer>
    </main>
  );
}

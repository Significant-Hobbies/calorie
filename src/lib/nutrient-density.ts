import { scaleNutrients } from './recommendations';
import type { Food, FoodEntry, Nutrients, NutritionTarget } from './types';

export type TrackedQuality = {
  score: number | null;
  label: string;
  proteinPer100Kcal: number | null;
  fibrePer100Kcal: number | null;
  proteinFactor: number | null;
  fibreFactor: number | null;
  explanation: string;
};

type TrackedQualityInput = Pick<Nutrients, 'calories' | 'proteinG' | 'fibreG'>;

export type EntryScoreBasis = {
  nutrients: TrackedQualityInput;
  source: 'current-food' | 'logged-fallback';
  fallbackReason: 'one-off' | 'missing-food' | 'archived-food' | 'incompatible-unit' | null;
};

export type DailyScore = {
  score: number | null;
  label: 'Score so far' | 'Final score';
  nutrients: TrackedQualityInput;
  calorieFactor: number | null;
  proteinFactor: number | null;
  fibreFactor: number | null;
  fallbackCount: number;
  explanation: string;
};

export type EntryTrackedQuality = {
  basis: EntryScoreBasis;
  quality: TrackedQuality;
  basisLabel: 'Latest active food' | 'Logged values fallback';
};

const PROTEIN_BENCHMARK_PER_100_KCAL = 8;
const FIBRE_BENCHMARK_PER_100_KCAL = 3;

export const TRACKED_QUALITY_CAVEAT =
  'This tracked score does not assess ingredients, vitamins, minerals, sodium, added sugars, fat quality, dietary variety, or overall health quality.';

function rounded(value: number) {
  return Math.round(value * 10) / 10;
}

function nonNegative(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function factor(value: number, benchmark: number) {
  return Math.min(1, Math.max(0, value / benchmark));
}

function positive(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function normalizedUnit(value: string) {
  return value.trim().toLocaleLowerCase();
}

function loggedFallback(
  entry: FoodEntry,
  fallbackReason: Exclude<EntryScoreBasis['fallbackReason'], null>
): EntryScoreBasis {
  return {
    nutrients: {
      calories: nonNegative(entry.calories),
      proteinG: nonNegative(entry.proteinG),
      fibreG: nonNegative(entry.fibreG),
    },
    source: 'logged-fallback',
    fallbackReason,
  };
}

export function resolveEntryScoreBasis(entry: FoodEntry, foods: Food[]): EntryScoreBasis {
  if (entry.foodId === null) return loggedFallback(entry, 'one-off');

  const food = foods.find((candidate) => candidate.id === entry.foodId);
  if (!food) return loggedFallback(entry, 'missing-food');
  if (food.archivedAt !== null) return loggedFallback(entry, 'archived-food');
  if (normalizedUnit(food.unitLabel) !== normalizedUnit(entry.unitLabel)) {
    return loggedFallback(entry, 'incompatible-unit');
  }

  const nutrients = scaleNutrients(food, food.servingMode, nonNegative(entry.amount));
  return {
    nutrients,
    source: 'current-food',
    fallbackReason: null,
  };
}

export function calculateEntryTrackedQuality(entry: FoodEntry, foods: Food[]): EntryTrackedQuality {
  const basis = resolveEntryScoreBasis(entry, foods);
  return {
    basis,
    quality: calculateTrackedQuality(basis.nutrients),
    basisLabel: basis.source === 'current-food' ? 'Latest active food' : 'Logged values fallback',
  };
}

function calorieBounds(target: NutritionTarget): [number, number] | null {
  const lower = positive(target.calorieRange?.[0]);
  const upper = positive(target.calorieRange?.[1]);
  if (lower !== null && upper !== null) return lower <= upper ? [lower, upper] : [upper, lower];

  const single = positive(target.calorieTarget);
  return single === null ? null : [single, single];
}

function calorieAdherence(calories: number, bounds: [number, number] | null) {
  if (bounds === null) return null;
  const [lower, upper] = bounds;
  if (calories < lower) return factor(calories, lower);
  if (calories <= upper) return 1;
  return Math.min(1, Math.max(0, 1 - 2 * ((calories - upper) / upper)));
}

function targetCompletion(value: number, target: number | null) {
  return target === null ? null : factor(value, target);
}

function percent(value: number | null) {
  return value === null ? 'not scored' : `${Math.round(value * 100)}%`;
}

function displayTarget(value: number | null, suffix: string) {
  return value === null ? 'no target' : `${rounded(value)}${suffix}`;
}

function dailyScoreExplanation(input: {
  score: number | null;
  label: DailyScore['label'];
  nutrients: TrackedQualityInput;
  calorieTarget: string;
  calorieFactor: number | null;
  proteinTarget: number | null;
  proteinFactor: number | null;
  fibreTarget: number | null;
  fibreFactor: number | null;
  provenance: string;
  omitted: string[];
}) {
  if (input.score === null) {
    return `${input.label} unavailable because no calorie, protein, or fibre targets are available. Resolved ${input.provenance}. ${TRACKED_QUALITY_CAVEAT}`;
  }
  const omitted = input.omitted.length
    ? ` Omitted unavailable ${input.omitted.join(' and ')} targets and normalized the remaining weights.`
    : '';
  return `${input.label} ${input.score}/100: ${input.nutrients.calories} kcal against ${input.calorieTarget} (${percent(input.calorieFactor)}, 50% weight); ${input.nutrients.proteinG}g protein against ${displayTarget(input.proteinTarget, 'g')} (${percent(input.proteinFactor)}, 30% weight); ${input.nutrients.fibreG}g fibre against ${displayTarget(input.fibreTarget, 'g')} (${percent(input.fibreFactor)}, 20% weight). Resolved ${input.provenance}.${omitted} ${TRACKED_QUALITY_CAVEAT}`;
}

export function calculateDailyScore(input: {
  entries: FoodEntry[];
  foods: Food[];
  target: NutritionTarget;
  isCurrentDay: boolean;
}): DailyScore {
  const bases = input.entries.map((entry) => resolveEntryScoreBasis(entry, input.foods));
  const nutrients = bases.reduce<TrackedQualityInput>(
    (total, basis) => ({
      calories: total.calories + basis.nutrients.calories,
      proteinG: total.proteinG + basis.nutrients.proteinG,
      fibreG: total.fibreG + basis.nutrients.fibreG,
    }),
    { calories: 0, proteinG: 0, fibreG: 0 }
  );
  const roundedNutrients = {
    calories: rounded(nutrients.calories),
    proteinG: rounded(nutrients.proteinG),
    fibreG: rounded(nutrients.fibreG),
  };
  const bounds = calorieBounds(input.target);
  const proteinTarget = positive(input.target.proteinRangeG?.[0]);
  const fibreTarget = positive(input.target.fibreTargetG);
  const calorieFactor = calorieAdherence(roundedNutrients.calories, bounds);
  const proteinFactor = targetCompletion(roundedNutrients.proteinG, proteinTarget);
  const fibreFactor = targetCompletion(roundedNutrients.fibreG, fibreTarget);
  const factors = [
    { value: calorieFactor, weight: 50 },
    { value: proteinFactor, weight: 30 },
    { value: fibreFactor, weight: 20 },
  ];
  const available = factors.filter(
    (item): item is { value: number; weight: number } => item.value !== null
  );
  const availableWeight = available.reduce((sum, item) => sum + item.weight, 0);
  const score =
    availableWeight === 0
      ? null
      : Math.round(
          (available.reduce((sum, item) => sum + item.value * item.weight, 0) / availableWeight) *
            100
        );
  const fallbackCount = bases.filter((basis) => basis.source === 'logged-fallback').length;
  const label = input.isCurrentDay ? 'Score so far' : 'Final score';
  const calorieTarget = bounds
    ? bounds[0] === bounds[1]
      ? `${rounded(bounds[0])} kcal`
      : `${rounded(bounds[0])}–${rounded(bounds[1])} kcal`
    : 'no target';
  const omitted = [
    calorieFactor === null ? 'calories' : null,
    proteinFactor === null ? 'protein' : null,
    fibreFactor === null ? 'fibre' : null,
  ].filter((value): value is string => value !== null);
  const provenance = `${bases.length - fallbackCount} current-food ${bases.length - fallbackCount === 1 ? 'entry' : 'entries'} and ${fallbackCount} logged ${fallbackCount === 1 ? 'fallback' : 'fallbacks'}`;

  return {
    score,
    label,
    nutrients: roundedNutrients,
    calorieFactor,
    proteinFactor,
    fibreFactor,
    fallbackCount,
    explanation: dailyScoreExplanation({
      score,
      label,
      nutrients: roundedNutrients,
      calorieTarget,
      calorieFactor,
      proteinTarget,
      proteinFactor,
      fibreTarget,
      fibreFactor,
      provenance,
      omitted,
    }),
  };
}

export function calculateTrackedQuality(nutrients: TrackedQualityInput): TrackedQuality {
  if (!Number.isFinite(nutrients.calories) || nutrients.calories <= 0) {
    return {
      score: null,
      label: 'Tracked score unavailable',
      proteinPer100Kcal: null,
      fibrePer100Kcal: null,
      proteinFactor: null,
      fibreFactor: null,
      explanation: `Add calories to calculate Tracked quality. ${TRACKED_QUALITY_CAVEAT}`,
    };
  }

  const proteinPer100Kcal = rounded((nonNegative(nutrients.proteinG) * 100) / nutrients.calories);
  const fibrePer100Kcal = rounded((nonNegative(nutrients.fibreG) * 100) / nutrients.calories);
  const proteinFactor = factor(proteinPer100Kcal, PROTEIN_BENCHMARK_PER_100_KCAL);
  const fibreFactor = factor(fibrePer100Kcal, FIBRE_BENCHMARK_PER_100_KCAL);
  const strongerFactor = Math.max(proteinFactor, fibreFactor);
  const complementaryFactor = Math.min(proteinFactor, fibreFactor);
  const score = Math.round(70 * strongerFactor + 30 * complementaryFactor);
  const label = `${score} tracked score`;

  return {
    score,
    label,
    proteinPer100Kcal,
    fibrePer100Kcal,
    proteinFactor,
    fibreFactor,
    explanation: `Tracked quality ${score}/100: ${proteinPer100Kcal} g protein and ${fibrePer100Kcal} g fibre per 100 kcal. Protein factor ${Math.round(proteinFactor * 100)}%; fibre factor ${Math.round(fibreFactor * 100)}%. Score = 70% stronger factor + 30% complementary factor. ${TRACKED_QUALITY_CAVEAT}`,
  };
}

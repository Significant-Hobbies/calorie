import type { NutritionTarget } from './types';

export type DailyRatingInput = {
  totals: { calories: number; proteinG: number; fibreG: number; waterMl: number };
  target: NutritionTarget;
  waterTargetMl: number;
};

export type DailyRating = {
  rating: number; // 1–5, rounded to nearest 0.5
  label: string;
  factors: Array<{ label: string; share: number }>;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function computeDailyRating(input: DailyRatingInput): DailyRating | null {
  const calorieTarget = input.target.calorieTarget;
  const proteinTarget = input.target.proteinRangeG?.[0] ?? null;
  const fibreTarget = input.target.fibreTargetG;
  const waterTarget = input.waterTargetMl;

  if (calorieTarget === null && proteinTarget === null && fibreTarget === null && !waterTarget) {
    return null;
  }

  const factors: Array<{ label: string; share: number }> = [];
  if (calorieTarget) {
    factors.push({ label: 'Calories', share: clamp01(input.totals.calories / calorieTarget) });
  }
  if (proteinTarget) {
    factors.push({ label: 'Protein', share: clamp01(input.totals.proteinG / proteinTarget) });
  }
  if (fibreTarget) {
    factors.push({ label: 'Fibre', share: clamp01(input.totals.fibreG / fibreTarget) });
  }
  if (waterTarget) {
    factors.push({ label: 'Water', share: clamp01(input.totals.waterMl / waterTarget) });
  }

  const average = factors.reduce((sum, factor) => sum + factor.share, 0) / factors.length;
  const raw = 1 + average * 4;
  const rating = Math.round(raw * 2) / 2;

  const completeCount = factors.filter((factor) => factor.share >= 1).length;
  const label =
    completeCount === factors.length
      ? `All ${factors.length} target${factors.length === 1 ? '' : 's'} in view`
      : `${completeCount} of ${factors.length} target${factors.length === 1 ? '' : 's'} in view`;

  return { rating, label, factors };
}

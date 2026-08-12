import { round, scaleNutrients } from './recommendations';
import type { Food, NutritionTarget } from './types';

type MacroCompletionSuggestion = {
  food: Food;
  calories: number;
  proteinG: number;
  fibreG: number;
  covers: number;
};

export type MacroCompletion = {
  remainingCalories: number;
  remainingProteinG: number;
  remainingFibreG: number;
  leadingMacro: 'protein' | 'fibre' | null;
  suggestions: MacroCompletionSuggestion[];
  complete: boolean;
};

const MAX_SUGGESTIONS = 4;

export function computeMacroCompletion(input: {
  totals: { calories: number; proteinG: number; fibreG: number };
  target: NutritionTarget;
  foods: Food[];
}): MacroCompletion | null {
  const calorieTarget = input.target.calorieTarget;
  const proteinTarget = input.target.proteinRangeG?.[0] ?? null;
  const fibreTarget = input.target.fibreTargetG;

  if (calorieTarget === null && proteinTarget === null && fibreTarget === null) {
    return null;
  }

  // Calories are a limit (ceiling), not a target to finish. Headroom is
  // reported for display but does not count as a gap to fill.
  const remainingCalories =
    calorieTarget !== null ? Math.max(0, round(calorieTarget - input.totals.calories)) : 0;
  const caloriesMet = calorieTarget === null || input.totals.calories <= calorieTarget;

  const remainingProteinG =
    proteinTarget !== null ? Math.max(0, round(proteinTarget - input.totals.proteinG, 1)) : 0;
  const remainingFibreG =
    fibreTarget !== null ? Math.max(0, round(fibreTarget - input.totals.fibreG, 1)) : 0;

  // Only protein and fibre are targets to chase — calories are a limit, so
  // they never become the leading macro for suggestions.
  const tracked: Array<{ macro: 'protein' | 'fibre'; remaining: number }> = [];
  if (proteinTarget !== null) tracked.push({ macro: 'protein', remaining: remainingProteinG });
  if (fibreTarget !== null) tracked.push({ macro: 'fibre', remaining: remainingFibreG });

  const complete = caloriesMet && tracked.every((item) => item.remaining <= 0);
  const fraction = (item: { remaining: number; target: number }) =>
    item.target > 0 ? item.remaining / item.target : 0;
  const trackedWithTarget = tracked.map((item) => ({
    ...item,
    target: item.macro === 'protein' ? (proteinTarget ?? 0) : (fibreTarget ?? 0),
  }));
  type TrackedItem = (typeof trackedWithTarget)[number];
  const leading = trackedWithTarget.reduce<TrackedItem | null>(
    (best, item) =>
      item.remaining > 0 && (best === null || fraction(item) > fraction(best)) ? item : best,
    null
  );

  const suggestions: MacroCompletionSuggestion[] = [];
  if (!complete && leading) {
    const deficit = tracked.find((item) => item.macro === leading.macro)?.remaining ?? 0;
    suggestions.push(
      ...input.foods
        .map((food) => {
          const serving = scaleNutrients(food, food.servingMode, food.defaultAmount);
          const servingLeading = leading.macro === 'protein' ? serving.proteinG : serving.fibreG;
          return {
            food,
            calories: serving.calories,
            proteinG: serving.proteinG,
            fibreG: serving.fibreG,
            covers: deficit > 0 ? round(servingLeading / deficit, 2) : 0,
          };
        })
        .filter((item) => {
          const servingLeading = leading.macro === 'protein' ? item.proteinG : item.fibreG;
          return servingLeading > 0;
        })
        .sort((a, b) => {
          const aLeading = leading.macro === 'protein' ? a.proteinG : a.fibreG;
          const bLeading = leading.macro === 'protein' ? b.proteinG : b.fibreG;
          return bLeading - aLeading;
        })
        .slice(0, MAX_SUGGESTIONS)
    );
  }

  return {
    remainingCalories,
    remainingProteinG,
    remainingFibreG,
    leadingMacro: leading?.macro ?? null,
    suggestions,
    complete,
  };
}

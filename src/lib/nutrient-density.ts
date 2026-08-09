import type { Nutrients } from './types';

export type NutrientDensityLevel = 'high' | 'medium' | 'low' | 'unavailable';

export type NutrientDensity = {
  level: NutrientDensityLevel;
  label: string;
  proteinPer100Kcal: number | null;
  fibrePer100Kcal: number | null;
  explanation: string;
};

export const NUTRIENT_DENSITY_CAVEAT =
  'Based only on tracked protein and fibre per 100 kcal. It does not assess vitamins, minerals, ingredients, or overall health quality.';

function rounded(value: number) {
  return Math.round(value * 10) / 10;
}

export function classifyNutrientDensity(
  nutrients: Pick<Nutrients, 'calories' | 'proteinG' | 'fibreG'>
): NutrientDensity {
  if (!Number.isFinite(nutrients.calories) || nutrients.calories <= 0) {
    return {
      level: 'unavailable',
      label: 'Density unavailable',
      proteinPer100Kcal: null,
      fibrePer100Kcal: null,
      explanation: `Add calories to calculate tracked nutrient density. ${NUTRIENT_DENSITY_CAVEAT}`,
    };
  }

  const proteinPer100Kcal = rounded((Math.max(0, nutrients.proteinG) * 100) / nutrients.calories);
  const fibrePer100Kcal = rounded((Math.max(0, nutrients.fibreG) * 100) / nutrients.calories);
  const level =
    proteinPer100Kcal >= 8 ||
    fibrePer100Kcal >= 3 ||
    (proteinPer100Kcal >= 4 && fibrePer100Kcal >= 1.5)
      ? 'high'
      : proteinPer100Kcal >= 4 || fibrePer100Kcal >= 1.5
        ? 'medium'
        : 'low';
  const label = `${level[0].toUpperCase()}${level.slice(1)} density`;

  return {
    level,
    label,
    proteinPer100Kcal,
    fibrePer100Kcal,
    explanation: `${label}: ${proteinPer100Kcal} g protein and ${fibrePer100Kcal} g fibre per 100 kcal. ${NUTRIENT_DENSITY_CAVEAT}`,
  };
}

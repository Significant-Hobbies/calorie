import { Leaf } from 'lucide-react';
import { classifyNutrientDensity } from '../lib/nutrient-density';
import type { Nutrients } from '../lib/types';

export function NutrientDensityBadge({
  nutrients,
  showBasis = false,
}: {
  nutrients: Pick<Nutrients, 'calories' | 'proteinG' | 'fibreG'>;
  showBasis?: boolean;
}) {
  const density = classifyNutrientDensity(nutrients);
  const basis =
    density.proteinPer100Kcal === null || density.fibrePer100Kcal === null
      ? null
      : `${density.proteinPer100Kcal}g protein · ${density.fibrePer100Kcal}g fibre per 100 kcal`;

  return (
    <span className="nutrient-density-wrap">
      <span
        className={`nutrient-density nutrient-density-${density.level}`}
        title={density.explanation}
        aria-label={density.explanation}
      >
        <Leaf size={12} aria-hidden="true" />
        {density.label}
      </span>
      {showBasis && basis ? <small>{basis}</small> : null}
    </span>
  );
}

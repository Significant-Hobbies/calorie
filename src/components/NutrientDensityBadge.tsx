import { Leaf } from 'lucide-react';
import {
  calculateTrackedQuality,
  TRACKED_QUALITY_CAVEAT,
  type TrackedQuality,
} from '../lib/nutrient-density';
import type { Nutrients } from '../lib/types';

function trackedQualityBasis(result: TrackedQuality) {
  if (
    result.proteinPer100Kcal === null ||
    result.fibrePer100Kcal === null ||
    result.proteinFactor === null ||
    result.fibreFactor === null
  ) {
    return null;
  }

  return `${result.proteinPer100Kcal}g protein (${Math.round(result.proteinFactor * 100)}%) · ${result.fibrePer100Kcal}g fibre (${Math.round(result.fibreFactor * 100)}%) per 100 kcal · 70% stronger + 30% complementary`;
}

export function NutrientDensityBadge({
  nutrients,
  quality,
  showBasis = false,
  contextLabel = 'Tracked quality',
  basisLabel,
}: {
  nutrients?: Pick<Nutrients, 'calories' | 'proteinG' | 'fibreG'>;
  quality?: TrackedQuality;
  showBasis?: boolean;
  contextLabel?: string;
  basisLabel?: string;
}) {
  const result =
    quality ?? calculateTrackedQuality(nutrients ?? { calories: 0, proteinG: 0, fibreG: 0 });
  const basis = trackedQualityBasis(result);

  const badge = (
    <span
      className={`nutrient-density ${result.score === null ? 'nutrient-density-unavailable' : 'nutrient-density-score'}`}
      title={basisLabel ? `${basisLabel}. ${result.explanation}` : result.explanation}
      aria-label={basisLabel ? `${basisLabel}. ${result.explanation}` : result.explanation}
    >
      <Leaf size={12} aria-hidden="true" />
      {result.score === null ? 'Score —' : `${result.score}/100 tracked`}
    </span>
  );

  if (showBasis && basis) {
    return (
      <div className="nutrient-density-wrap nutrient-density-with-basis">
        {badge}
        <details className="nutrient-density-details">
          <summary>How it’s calculated</summary>
          <small>
            <strong>{contextLabel}</strong> · {basisLabel ? `${basisLabel} · ` : ''}
            {basis}
          </small>
          <small>{TRACKED_QUALITY_CAVEAT}</small>
        </details>
      </div>
    );
  }

  return (
    <span className="nutrient-density-wrap">
      {badge}
      {basisLabel ? <small>{basisLabel}</small> : null}
    </span>
  );
}

import { calculateEntryTrackedQuality } from '../lib/nutrient-density';
import type { Food, FoodEntry } from '../lib/types';
import { NutrientDensityBadge } from './NutrientDensityBadge';

export function EntryTrackedQualityBadge({
  entry,
  foods,
  showBasis = false,
}: {
  entry: FoodEntry;
  foods: Food[];
  showBasis?: boolean;
}) {
  const result = calculateEntryTrackedQuality(entry, foods);
  return (
    <NutrientDensityBadge
      quality={result.quality}
      basisLabel={result.basisLabel}
      showBasis={showBasis}
      contextLabel="Entry score"
    />
  );
}

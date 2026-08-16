import type { Nutrients } from './types';

export function sumNutrients(entries: Iterable<Nutrients>): Nutrients {
  return [...entries].reduce(
    (total, entry) => ({
      calories: total.calories + entry.calories,
      carbsG: total.carbsG + entry.carbsG,
      proteinG: total.proteinG + entry.proteinG,
      fibreG: total.fibreG + entry.fibreG,
    }),
    { calories: 0, carbsG: 0, proteinG: 0, fibreG: 0 }
  );
}

import { describe, expect, it } from 'vitest';
import { classifyNutrientDensity } from './nutrient-density';

describe('tracked nutrient density', () => {
  it('marks zero-calorie foods unavailable', () => {
    expect(classifyNutrientDensity({ calories: 0, proteinG: 20, fibreG: 5 }).level).toBe(
      'unavailable'
    );
  });

  it.each([
    [{ calories: 100, proteinG: 8, fibreG: 0 }, 'high'],
    [{ calories: 100, proteinG: 0, fibreG: 3 }, 'high'],
    [{ calories: 200, proteinG: 8, fibreG: 3 }, 'high'],
    [{ calories: 100, proteinG: 4, fibreG: 0 }, 'medium'],
    [{ calories: 100, proteinG: 0, fibreG: 1.5 }, 'medium'],
    [{ calories: 100, proteinG: 3.9, fibreG: 1.4 }, 'low'],
  ] as const)('classifies %o as %s', (nutrients, expected) => {
    expect(classifyNutrientDensity(nutrients).level).toBe(expected);
  });

  it('does not use carbs or packaging as inputs', () => {
    const density = classifyNutrientDensity({ calories: 250, proteinG: 20, fibreG: 0 });
    expect(density.level).toBe('high');
    expect(density.explanation).toContain('8 g protein');
  });
});

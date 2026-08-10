import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import { calculateGymGuidance } from './recommendations';
import type { FoodEntry } from './types';

const NOW = Date.UTC(2026, 7, 10, 12);
const ITERATIONS = 100;

function exerciseHistory(size: number): FoodEntry[] {
  return Array.from({ length: size }, (_, index) => ({
    id: `meal-${index}`,
    foodId: null,
    foodName: `Meal ${index}`,
    amount: 1,
    unitLabel: 'serving',
    calories: 400,
    carbsG: 45,
    proteinG: 20,
    fibreG: 5,
    eatenAt: NOW - (index + 30) * 60 * 1000,
  }));
}

describe('exercise guidance synthetic stress performance', () => {
  it('scales across synthetic food histories', () => {
    const metrics: string[] = [];

    for (const size of [1_000, 10_000, 35_000]) {
      const entries = exerciseHistory(size);
      const expectedSourceName = entries[0].foodName;
      let result = calculateGymGuidance(entries, NOW);

      const startedAt = performance.now();
      for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
        result = calculateGymGuidance(entries, NOW);
      }
      const durationMs = (performance.now() - startedAt) / ITERATIONS;

      expect(result.state).toBe('window');
      if (result.state === 'window') expect(result.sourceEntry).toBe(expectedSourceName);
      metrics.push(`size${size}=${durationMs.toFixed(3)}ms/op`);
    }

    console.log(`[benchmark] ${metrics.join(' ')}`);
  });
});

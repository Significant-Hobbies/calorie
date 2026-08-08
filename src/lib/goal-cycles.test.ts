import { describe, expect, it } from 'vitest';
import { cutIntensityFromGoal, cycleFromGoal, type GoalCycle, goalFromCycle } from './goal-cycles';
import type { Goal } from './types';

describe('goal cycles', () => {
  it.each<[Goal, GoalCycle]>([
    ['lose_gentle', 'cut'],
    ['lose_steady', 'cut'],
    ['maintain', 'recomposition'],
    ['gain_gentle', 'gain'],
  ])('maps the stored goal %s to %s', (goal, cycle) => {
    expect(cycleFromGoal(goal)).toBe(cycle);
  });

  it('preserves both cut intensities', () => {
    expect(cutIntensityFromGoal('lose_gentle')).toBe('gentle');
    expect(cutIntensityFromGoal('lose_steady')).toBe('steady');
    expect(goalFromCycle('cut', 'gentle')).toBe('lose_gentle');
    expect(goalFromCycle('cut', 'steady')).toBe('lose_steady');
  });

  it('maps gain and recomposition to the existing calculation values', () => {
    expect(goalFromCycle('gain')).toBe('gain_gentle');
    expect(goalFromCycle('recomposition')).toBe('maintain');
  });
});

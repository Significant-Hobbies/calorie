import type { Goal, GoalCycle } from './types';

export type { GoalCycle } from './types';
export type CutIntensity = 'gentle' | 'steady';

export function cycleFromGoal(goal: Goal): GoalCycle {
  if (goal === 'gain_gentle') return 'gain';
  if (goal === 'maintain') return 'recomposition';
  return 'cut';
}

export function cutIntensityFromGoal(goal: Goal): CutIntensity {
  return goal === 'lose_steady' ? 'steady' : 'gentle';
}

export function goalFromCycle(cycle: GoalCycle, cutIntensity: CutIntensity = 'gentle'): Goal {
  if (cycle === 'gain') return 'gain_gentle';
  if (cycle === 'recomposition') return 'maintain';
  return cutIntensity === 'steady' ? 'lose_steady' : 'lose_gentle';
}

import type { Goal, GoalCycle } from './types';

export type { GoalCycle } from './types';
export type CutIntensity = 'gentle' | 'steady';

export const CYCLE_DETAILS: Record<
  GoalCycle,
  { label: string; shortLabel: string; description: string }
> = {
  cut: {
    label: 'Cut',
    shortLabel: 'Cut',
    description: 'A maintenance-relative calorie deficit with higher protein guidance.',
  },
  gain: {
    label: 'Gain',
    shortLabel: 'Gain',
    description: 'A small maintenance-relative surplus for a gradual gaining phase.',
  },
  recomposition: {
    label: 'Recomposition',
    shortLabel: 'Recomp',
    description: 'A maintenance-range phase for supporting training and steady habits.',
  },
};

export const CUT_INTENSITY_DETAILS: Record<CutIntensity, { label: string; description: string }> = {
  gentle: {
    label: 'Gentle cut',
    description: '80–85% of estimated maintenance',
  },
  steady: {
    label: 'Steady cut',
    description: '75–80% of estimated maintenance',
  },
};

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

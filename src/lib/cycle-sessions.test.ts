import { describe, expect, it } from 'vitest';
import {
  createCycleSession,
  transitionCycleSessions,
  updateActiveCycleStart,
} from './cycle-sessions';
import type { NutritionTarget } from './types';

const target: NutritionTarget = {
  calorieTarget: 2000,
  calorieRange: [1900, 2100],
  maintenanceCalories: 2100,
  goalAdjustmentRangeCalories: [-200, 0],
  restingEnergy: 1600,
  proteinRangeG: [110, 140],
  fibreTargetG: 28,
  method: 'mifflin-st-jeor',
};

describe('cycle sessions', () => {
  it('creates a truthful active session without backdating', () => {
    const session = createCycleSession({
      id: 'cycle-1',
      userId: 'user-1',
      profile: { goal: 'maintain' },
      target,
      startOn: '2026-08-09',
      now: 1,
    });
    expect(session).toMatchObject({ cycle: 'recomposition', startOn: '2026-08-09', endOn: null });
  });

  it('updates Cut intensity in place but creates a session for a top-level switch', () => {
    const initial = createCycleSession({
      id: 'cut',
      userId: 'user-1',
      profile: { goal: 'lose_gentle' },
      target,
      startOn: '2026-08-01',
      now: 1,
    });
    const intensity = transitionCycleSessions({
      sessions: [initial],
      nextProfile: { goal: 'lose_steady' },
      target,
      today: '2026-08-09',
      now: 2,
      id: 'unused',
      userId: 'user-1',
    });
    expect(intensity).toHaveLength(1);
    expect(intensity[0].goal).toBe('lose_steady');

    const switched = transitionCycleSessions({
      sessions: intensity,
      nextProfile: { goal: 'gain_gentle' },
      target,
      today: '2026-08-09',
      now: 3,
      id: 'gain',
      userId: 'user-1',
    });
    expect(switched).toHaveLength(2);
    expect(switched[0].endOn).toBe('2026-08-09');
    expect(switched[1]).toMatchObject({ cycle: 'gain', startOn: '2026-08-09', endOn: null });
  });

  it('validates active start dates against today and the prior exclusive boundary', () => {
    const previous = {
      ...createCycleSession({
        id: 'old',
        userId: 'user-1',
        profile: { goal: 'maintain' },
        target,
        startOn: '2026-07-01',
        now: 1,
      }),
      endOn: '2026-08-01',
    };
    const active = createCycleSession({
      id: 'active',
      userId: 'user-1',
      profile: { goal: 'gain_gentle' },
      target,
      startOn: '2026-08-01',
      now: 2,
    });
    expect(() => updateActiveCycleStart([previous, active], '2026-07-31', '2026-08-09', 3)).toThrow(
      'on or after'
    );
    expect(() => updateActiveCycleStart([previous, active], '2026-08-10', '2026-08-09', 3)).toThrow(
      'future'
    );
    expect(
      updateActiveCycleStart([previous, active], '2026-08-02', '2026-08-09', 3)[1].startOn
    ).toBe('2026-08-02');
  });
});

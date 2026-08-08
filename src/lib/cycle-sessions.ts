import { cycleFromGoal } from './goal-cycles';
import type { GoalCycleSession, NutritionTarget, UserProfile } from './types';

type SessionInput = {
  id: string;
  userId: string;
  profile: Pick<UserProfile, 'goal'>;
  target: NutritionTarget;
  startOn: string;
  now: number;
};

function planSnapshot(target: NutritionTarget) {
  return {
    calorieRange: target.calorieRange ? ([...target.calorieRange] as [number, number]) : null,
    proteinRangeG: target.proteinRangeG ? ([...target.proteinRangeG] as [number, number]) : null,
  };
}

export function createCycleSession(input: SessionInput): GoalCycleSession {
  return {
    id: input.id,
    userId: input.userId,
    cycle: cycleFromGoal(input.profile.goal),
    goal: input.profile.goal,
    startOn: input.startOn,
    endOn: null,
    ...planSnapshot(input.target),
    createdAt: input.now,
    updatedAt: input.now,
  };
}

export function transitionCycleSessions(input: {
  sessions: GoalCycleSession[];
  nextProfile: Pick<UserProfile, 'goal'>;
  target: NutritionTarget;
  today: string;
  now: number;
  id: string;
  userId: string;
}): GoalCycleSession[] {
  const sessions = input.sessions.map((session) => ({ ...session }));
  const active = sessions.find((session) => session.endOn === null);
  if (!active) {
    return [
      ...sessions,
      createCycleSession({
        id: input.id,
        userId: input.userId,
        profile: input.nextProfile,
        target: input.target,
        startOn: input.today,
        now: input.now,
      }),
    ];
  }

  const nextCycle = cycleFromGoal(input.nextProfile.goal);
  if (active.cycle === nextCycle) {
    active.goal = input.nextProfile.goal;
    Object.assign(active, planSnapshot(input.target), { updatedAt: input.now });
    return sessions;
  }

  active.endOn = input.today;
  active.updatedAt = input.now;
  return [
    ...sessions,
    createCycleSession({
      id: input.id,
      userId: input.userId,
      profile: input.nextProfile,
      target: input.target,
      startOn: input.today,
      now: input.now,
    }),
  ];
}

export function validateCycleStartDate(
  startOn: string,
  today: string,
  previousEndOn: string | null
): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startOn)) return 'Choose a valid cycle start date.';
  if (startOn > today) return 'Cycle start cannot be in the future.';
  if (previousEndOn && startOn < previousEndOn) {
    return `Cycle start must be on or after ${previousEndOn}.`;
  }
  return null;
}

export function updateActiveCycleStart(
  sessions: GoalCycleSession[],
  startOn: string,
  today: string,
  now: number
): GoalCycleSession[] {
  const active = sessions.find((session) => session.endOn === null);
  if (!active) throw new Error('Active cycle not found.');
  const previous = [...sessions]
    .filter((session) => session.endOn !== null && session.id !== active.id)
    .sort((a, b) => (b.endOn ?? '').localeCompare(a.endOn ?? ''))[0];
  const error = validateCycleStartDate(startOn, today, previous?.endOn ?? null);
  if (error) throw new Error(error);
  return sessions.map((session) =>
    session.id === active.id ? { ...session, startOn, updatedAt: now } : session
  );
}

import type { CyclePeriodData, GoalCycle, HistoryDay, WeightEntry } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

function dateNumber(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

function rounded(value: number, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function loggedAverage(days: HistoryDay[], value: (day: HistoryDay) => number) {
  const logged = days.filter((day) => day.calories > 0);
  return logged.length ? logged.reduce((sum, day) => sum + value(day), 0) / logged.length : null;
}

function weeklyWeightRate(weights: WeightEntry[]) {
  const ordered = [...weights].sort((a, b) => a.recordedAt - b.recordedAt);
  if (ordered.length < 2) return null;
  const firstAt = ordered[0].recordedAt;
  const last = ordered[ordered.length - 1];
  const spanDays = (last.recordedAt - firstAt) / DAY_MS;
  if (spanDays < 7) return null;
  const points = ordered.map((entry) => ({
    x: (entry.recordedAt - firstAt) / DAY_MS,
    y: entry.weightKg,
  }));
  const xMean = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const yMean = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  const denominator = points.reduce((sum, point) => sum + (point.x - xMean) ** 2, 0);
  if (!denominator) return null;
  const slope =
    points.reduce((sum, point) => sum + (point.x - xMean) * (point.y - yMean), 0) / denominator;
  return rounded(slope * 7, 2);
}

function weightDirectionAligned(cycle: GoalCycle, rate: number) {
  if (cycle === 'cut') return rate <= 0;
  if (cycle === 'gain') return rate >= 0;
  return Math.abs(rate) <= 0.25;
}

export type CycleAnalysis = {
  cycle: GoalCycle;
  startOn: string;
  endOn: string | null;
  elapsedDays: number;
  loggedDays: number;
  coveragePercent: number;
  averageCalories: number | null;
  averageProteinG: number | null;
  calorieDeltaFromPlan: number | null;
  proteinCoveragePercent: number | null;
  weightChangeKg: number | null;
  weeklyWeightRateKg: number | null;
  weightCount: number;
  status: 'insufficient_data' | 'on_track' | 'review_target';
  statusReason: string;
};

function resolveCycleStatus(
  enoughIntake: boolean,
  enoughWeight: boolean,
  hasCalorieRange: boolean,
  calorieAligned: boolean,
  directionAligned: boolean
): { status: CycleAnalysis['status']; statusReason: string } {
  if (!enoughIntake || !enoughWeight || !hasCalorieRange) {
    if (!hasCalorieRange) {
      return {
        status: 'insufficient_data',
        statusReason: 'Set a calorie range to compare this cycle with its plan.',
      };
    }
    return {
      status: 'insufficient_data',
      statusReason: 'Log at least four food days and two weights spanning seven days.',
    };
  }
  if (calorieAligned && directionAligned) {
    return {
      status: 'on_track',
      statusReason:
        'Logged intake is inside your saved range and measured weight direction matches this cycle.',
    };
  }
  if (!calorieAligned && !directionAligned) {
    return {
      status: 'review_target',
      statusReason:
        'Logged intake is outside your saved range and measured weight direction differs from this cycle.',
    };
  }
  return {
    status: 'insufficient_data',
    statusReason: 'Intake and weight signals are mixed, so more context is needed.',
  };
}

function isCalorieAligned(
  enoughIntake: boolean,
  averageCalories: number | null,
  range: [number, number] | null
): boolean {
  if (!enoughIntake || !range || averageCalories === null) return false;
  return averageCalories >= range[0] && averageCalories <= range[1];
}

function calorieDeltaFromPlan(
  averageCalories: number | null,
  midpoint: number | null
): number | null {
  if (averageCalories === null || midpoint === null) return null;
  return rounded(averageCalories - midpoint);
}

function proteinCoverage(averageProtein: number | null, floor: number | null): number | null {
  if (averageProtein === null || floor === null) return null;
  return rounded((averageProtein / floor) * 100);
}

export function analyzeCyclePeriod(period: CyclePeriodData, today: string): CycleAnalysis {
  const endBoundary = period.session.endOn ?? today;
  const elapsedDays = Math.max(
    1,
    dateNumber(endBoundary) - dateNumber(period.session.startOn) + (period.session.endOn ? 0 : 1)
  );
  const loggedDays = period.days.filter((day) => day.calories > 0).length;
  const averageCaloriesValue = loggedAverage(period.days, (day) => day.calories);
  const averageProteinValue = loggedAverage(period.days, (day) => day.proteinG);
  const calorieMidpoint = period.session.calorieRange
    ? (period.session.calorieRange[0] + period.session.calorieRange[1]) / 2
    : null;
  const proteinFloor = period.session.proteinRangeG?.[0] ?? null;
  const orderedWeights = [...period.weights].sort((a, b) => a.recordedAt - b.recordedAt);
  const weightChange =
    orderedWeights.length >= 2
      ? orderedWeights[orderedWeights.length - 1].weightKg - orderedWeights[0].weightKg
      : null;
  const rate = weeklyWeightRate(orderedWeights);
  const enoughIntake = loggedDays >= 4 && averageCaloriesValue !== null;
  const enoughWeight = rate !== null;
  const calorieAligned = isCalorieAligned(
    enoughIntake,
    averageCaloriesValue,
    period.session.calorieRange
  );
  const directionAligned = enoughWeight
    ? weightDirectionAligned(period.session.cycle, rate)
    : false;

  const { status, statusReason } = resolveCycleStatus(
    enoughIntake,
    enoughWeight,
    Boolean(period.session.calorieRange),
    calorieAligned,
    directionAligned
  );

  return {
    cycle: period.session.cycle,
    startOn: period.session.startOn,
    endOn: period.session.endOn,
    elapsedDays,
    loggedDays,
    coveragePercent: rounded((loggedDays / elapsedDays) * 100),
    averageCalories: averageCaloriesValue === null ? null : rounded(averageCaloriesValue),
    averageProteinG: averageProteinValue === null ? null : rounded(averageProteinValue),
    calorieDeltaFromPlan: calorieDeltaFromPlan(averageCaloriesValue, calorieMidpoint),
    proteinCoveragePercent: proteinCoverage(averageProteinValue, proteinFloor),
    weightChangeKg: weightChange === null ? null : rounded(weightChange, 1),
    weeklyWeightRateKg: rate,
    weightCount: orderedWeights.length,
    status,
    statusReason,
  };
}

export function compareCycleAnalyses(active: CycleAnalysis, previous: CycleAnalysis) {
  if (
    active.loggedDays < 4 ||
    previous.loggedDays < 4 ||
    active.averageCalories === null ||
    previous.averageCalories === null ||
    active.averageProteinG === null ||
    previous.averageProteinG === null ||
    active.weightChangeKg === null ||
    previous.weightChangeKg === null
  ) {
    return null;
  }
  return {
    caloriesDelta: active.averageCalories - previous.averageCalories,
    proteinDeltaG: active.averageProteinG - previous.averageProteinG,
    weightChangeDeltaKg: rounded(active.weightChangeKg - previous.weightChangeKg, 1),
  };
}

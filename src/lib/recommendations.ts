import type {
  ActivityLevel,
  EquationProfile,
  FastWindow,
  FoodEntry,
  Goal,
  GymGuidance,
  NutritionTarget,
  SleepGuidance,
} from './types';

const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
};

export const GOAL_DETAILS: Record<
  Goal,
  { label: string; shortLabel: string; maintenanceFactors: [number, number]; explanation: string }
> = {
  lose_gentle: {
    label: 'Lose gradually',
    shortLabel: 'Gradual loss',
    maintenanceFactors: [0.8, 0.85],
    explanation: '80–85% of estimated maintenance',
  },
  lose_steady: {
    label: 'Lose faster',
    shortLabel: 'Faster loss',
    maintenanceFactors: [0.75, 0.8],
    explanation: '75–80% of estimated maintenance',
  },
  maintain: {
    label: 'Maintain my weight',
    shortLabel: 'Maintenance',
    maintenanceFactors: [0.95, 1.05],
    explanation: '95–105% of estimated maintenance',
  },
  gain_gentle: {
    label: 'Gain gradually',
    shortLabel: 'Gradual gain',
    maintenanceFactors: [1.05, 1.1],
    explanation: '105–110% of estimated maintenance',
  },
};

export const METHODOLOGY_LINKS = {
  energy: 'https://pubmed.ncbi.nlm.nih.gov/2305711/',
  'loss targets':
    'https://www.niddk.nih.gov/health-information/diabetes/overview/preventing-type-2-diabetes/game-plan',
  protein: 'https://pubmed.ncbi.nlm.nih.gov/28642676/',
  fibre:
    'https://nap.nationalacademies.org/catalog/10490/dietary-reference-intakes-for-energy-carbohydrate-fiber-fat-fatty-acids-cholesterol-protein-and-amino-acids',
  exercise: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6566225/',
  sleep: 'https://medlineplus.gov/ency/patientinstructions/000853.htm',
} as const;

export function round(value: number, precision = 0): number {
  const multiplier = 10 ** precision;
  return Math.round(value * multiplier) / multiplier;
}

function signedValue(value: number): string {
  if (value > 0) return `+${value.toLocaleString()}`;
  if (value < 0) return `−${Math.abs(value).toLocaleString()}`;
  return '0';
}

export function formatCalorieAdjustmentRange(range: [number, number] | null): string {
  if (!range) return 'no goal adjustment';
  return `${signedValue(range[0])} to ${signedValue(range[1])}`;
}

export function scaleNutrients(
  nutrients: { calories: number; carbsG: number; proteinG: number; fibreG: number },
  servingMode: 'per_100g' | 'per_unit',
  amount: number
) {
  const factor = servingMode === 'per_100g' ? amount / 100 : amount;
  return {
    calories: round(nutrients.calories * factor),
    carbsG: round(nutrients.carbsG * factor, 1),
    proteinG: round(nutrients.proteinG * factor, 1),
    fibreG: round(nutrients.fibreG * factor, 1),
  };
}

export function calculateRestingEnergy(input: {
  weightKg: number;
  heightCm: number;
  ageYears: number;
  equationProfile: Exclude<EquationProfile, 'none'>;
}): number {
  const profileOffset = input.equationProfile === 'male' ? 5 : -161;
  return round(10 * input.weightKg + 6.25 * input.heightCm - 5 * input.ageYears + profileOffset);
}

export function calculateNutritionTarget(input: {
  weightKg: number | null;
  heightCm: number | null;
  ageYears: number | null;
  equationProfile: EquationProfile | null;
  activityLevel: ActivityLevel;
  goal: Goal;
  manualCalorieTarget?: number | null;
  manualCalorieRange?: [number, number] | null;
}): NutritionTarget {
  const proteinFactors: [number, number] =
    input.goal === 'lose_gentle' || input.goal === 'lose_steady' ? [1.6, 2] : [1.4, 1.8];
  const proteinRange: [number, number] | null = input.weightKg
    ? [round(input.weightKg * proteinFactors[0]), round(input.weightKg * proteinFactors[1])]
    : null;

  const legacyManualRange: [number, number] | null = input.manualCalorieTarget
    ? [
        Math.max(800, round(input.manualCalorieTarget - 100)),
        round(input.manualCalorieTarget + 100),
      ]
    : null;
  const manualRange = input.manualCalorieRange ?? legacyManualRange;

  if (manualRange) {
    const calorieRange: [number, number] = [
      round(Math.min(...manualRange)),
      round(Math.max(...manualRange)),
    ];
    const target = round((calorieRange[0] + calorieRange[1]) / 2);
    return {
      calorieTarget: target,
      calorieRange,
      maintenanceCalories: null,
      goalAdjustmentRangeCalories: null,
      restingEnergy: null,
      proteinRangeG: proteinRange,
      fibreTargetG: round((target / 1000) * 14),
      method: 'manual',
    };
  }

  if (
    !input.weightKg ||
    !input.heightCm ||
    !input.ageYears ||
    !input.equationProfile ||
    input.equationProfile === 'none'
  ) {
    return {
      calorieTarget: null,
      calorieRange: null,
      maintenanceCalories: null,
      goalAdjustmentRangeCalories: null,
      restingEnergy: null,
      proteinRangeG: proteinRange,
      fibreTargetG: null,
      method: 'unavailable',
    };
  }

  const restingEnergy = calculateRestingEnergy({
    weightKg: input.weightKg,
    heightCm: input.heightCm,
    ageYears: input.ageYears,
    equationProfile: input.equationProfile,
  });
  const maintenanceCalories = round(restingEnergy * ACTIVITY_FACTORS[input.activityLevel]);
  const factors = GOAL_DETAILS[input.goal].maintenanceFactors;
  const calorieRange: [number, number] = [
    Math.max(1200, round(maintenanceCalories * factors[0])),
    Math.max(1200, round(maintenanceCalories * factors[1])),
  ];
  const target = round((calorieRange[0] + calorieRange[1]) / 2);
  const goalAdjustmentRangeCalories: [number, number] = [
    calorieRange[0] - maintenanceCalories,
    calorieRange[1] - maintenanceCalories,
  ];

  return {
    calorieTarget: target,
    calorieRange,
    maintenanceCalories,
    goalAdjustmentRangeCalories,
    restingEnergy,
    proteinRangeG: proteinRange,
    fibreTargetG: round((target / 1000) * 14),
    method: 'mifflin-st-jeor',
  };
}

function resolveWeightDirection(
  distanceKg: number,
  signedDifferenceKg: number
): 'reached' | 'lose' | 'gain' {
  if (distanceKg < 0.05) return 'reached';
  if (signedDifferenceKg < 0) return 'lose';
  return 'gain';
}

export function calculateTargetWeightProgress(currentWeightKg: number, targetWeightKg: number) {
  const signedDifferenceKg = round(targetWeightKg - currentWeightKg, 1);
  const distanceKg = Math.abs(signedDifferenceKg);
  const direction = resolveWeightDirection(distanceKg, signedDifferenceKg);

  return {
    direction,
    distanceKg,
    explanation:
      direction === 'reached'
        ? 'You are at your target weight.'
        : `${distanceKg} kg ${direction === 'lose' ? 'to lose' : 'to gain'} to reach your target.`,
  };
}

export function calculateCompletedFasts(
  entries: Array<Pick<FoodEntry, 'eatenAt'>>,
  timezone: string
): FastWindow[] {
  const sorted = [...entries].sort((a, b) => a.eatenAt - b.eatenAt);
  const dayFormatter = new Intl.DateTimeFormat('en', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const eatingDays = new Map<string, { firstAt: number; lastAt: number }>();

  for (const entry of sorted) {
    const parts = dayFormatter.formatToParts(entry.eatenAt);
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((item) => item.type === type)?.value ?? '';
    const key = `${part('year')}-${part('month')}-${part('day')}`;
    const day = eatingDays.get(key);
    if (day) {
      day.lastAt = entry.eatenAt;
    } else {
      eatingDays.set(key, { firstAt: entry.eatenAt, lastAt: entry.eatenAt });
    }
  }

  const days = [...eatingDays.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, day]) => day);
  const windows: FastWindow[] = [];

  for (let index = 1; index < days.length; index += 1) {
    const startAt = days[index - 1].lastAt;
    const endAt = days[index].firstAt;
    const gap = endAt - startAt;
    if (gap > 0) {
      windows.push({
        startAt,
        endAt,
        durationHours: round(gap / (60 * 60 * 1000), 1),
      });
    }
  }

  return windows;
}

export function calculateGymGuidance(entries: FoodEntry[], now = Date.now()): GymGuidance {
  let recentEntry: FoodEntry | undefined;
  let recentStartAt = 0;
  let recentEndAt = 0;
  let recentStartMinutes = 0;
  let recentEndMinutes = 0;

  for (const entry of entries) {
    if (entry.carbsG < 10 || entry.eatenAt > now) continue;
    const endMinutes = gymWindowEndMinutes(entry.carbsG);
    const endAt = entry.eatenAt + endMinutes * 60 * 1000;
    if (endAt < now || (recentEntry && recentEntry.eatenAt >= entry.eatenAt)) continue;
    const startMinutes = gymWindowStartMinutes(entry.carbsG);
    recentEntry = entry;
    recentStartAt = entry.eatenAt + startMinutes * 60 * 1000;
    recentEndAt = endAt;
    recentStartMinutes = startMinutes;
    recentEndMinutes = endMinutes;
  }

  if (!recentEntry) {
    return {
      state: 'no-recent-carbs',
      startAt: null,
      endAt: null,
      carbsG: null,
      sourceEntry: null,
      explanation:
        'No qualifying meal-based window is still open. Train when it suits your energy and routine.',
    };
  }

  const phase = now >= recentStartAt ? 'active' : 'upcoming';

  return {
    state: 'window',
    startAt: recentStartAt,
    endAt: recentEndAt,
    carbsG: round(recentEntry.carbsG, 1),
    sourceEntry: recentEntry.foodName,
    phase,
    explanation: `${round(recentEntry.carbsG)} g carbs in ${recentEntry.foodName} suggests a broad ${recentStartMinutes}–${recentEndMinutes} minute post-meal window${phase === 'active' ? ' that is active now' : ''}.`,
  };
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function calculateSleepGuidance(input: {
  wakeTime: string;
  sleepHours: number;
  lastEntryLocalMinutes: number | null;
  lastEntryCalories: number | null;
}): SleepGuidance {
  const routineMinutes = timeToMinutes(input.wakeTime) - round(input.sleepHours * 60);
  if (input.lastEntryLocalMinutes === null || input.lastEntryCalories === null) {
    return {
      recommendedMinutes: routineMinutes,
      routineMinutes,
      settleMinutes: null,
      explanation: 'Based on your wake time and preferred sleep length.',
    };
  }

  const settleGap = settleGapForCalories(input.lastEntryCalories);
  let settleMinutes = input.lastEntryLocalMinutes + settleGap;
  let comparableRoutine = routineMinutes;
  if (comparableRoutine < input.lastEntryLocalMinutes - 12 * 60) comparableRoutine += 1440;
  if (settleMinutes < input.lastEntryLocalMinutes) settleMinutes += 1440;
  const recommendedMinutes = Math.max(comparableRoutine, settleMinutes);

  return {
    recommendedMinutes,
    routineMinutes: comparableRoutine,
    settleMinutes,
    explanation:
      recommendedMinutes === settleMinutes
        ? `Your last entry adds a ${settleGap / 60}-hour settling window.`
        : 'Your normal sleep schedule already leaves enough time after eating.',
  };
}

function settleGapForCalories(calories: number): number {
  if (calories < 150) return 60;
  if (calories < 400) return 120;
  return 180;
}

function gymWindowEndMinutes(carbsG: number): number {
  if (carbsG <= 20) return 90;
  if (carbsG <= 50) return 150;
  return 240;
}

function gymWindowStartMinutes(carbsG: number): number {
  if (carbsG <= 20) return 30;
  if (carbsG <= 50) return 60;
  return 90;
}

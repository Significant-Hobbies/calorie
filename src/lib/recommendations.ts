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
  { label: string; shortLabel: string; adjustmentCalories: number; explanation: string }
> = {
  lose_gentle: {
    label: 'Lose gradually',
    shortLabel: 'Gradual loss',
    adjustmentCalories: -250,
    explanation: '250 kcal below estimated maintenance',
  },
  lose_steady: {
    label: 'Lose faster',
    shortLabel: 'Faster loss',
    adjustmentCalories: -500,
    explanation: '500 kcal below estimated maintenance',
  },
  maintain: {
    label: 'Maintain my weight',
    shortLabel: 'Maintenance',
    adjustmentCalories: 0,
    explanation: 'At estimated maintenance',
  },
  gain_gentle: {
    label: 'Gain gradually',
    shortLabel: 'Gradual gain',
    adjustmentCalories: 250,
    explanation: '250 kcal above estimated maintenance',
  },
};

export const METHODOLOGY_LINKS = {
  energy: 'https://pubmed.ncbi.nlm.nih.gov/2305711/',
  protein: 'https://cdn.realfood.gov/DGA.pdf',
  fibre:
    'https://nap.nationalacademies.org/catalog/10490/dietary-reference-intakes-for-energy-carbohydrate-fiber-fat-fatty-acids-cholesterol-protein-and-amino-acids',
  gym: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6566225/',
  sleep: 'https://medlineplus.gov/ency/patientinstructions/000853.htm',
} as const;

export function round(value: number, precision = 0): number {
  const multiplier = 10 ** precision;
  return Math.round(value * multiplier) / multiplier;
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
}): NutritionTarget {
  if (input.manualCalorieTarget) {
    const target = round(input.manualCalorieTarget);
    return {
      calorieTarget: target,
      calorieRange: [Math.max(800, target - 100), target + 100],
      maintenanceCalories: null,
      goalAdjustmentCalories: null,
      restingEnergy: null,
      proteinRangeG: input.weightKg
        ? [round(input.weightKg * 1.2), round(input.weightKg * 1.6)]
        : null,
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
      goalAdjustmentCalories: null,
      restingEnergy: null,
      proteinRangeG: input.weightKg
        ? [round(input.weightKg * 1.2), round(input.weightKg * 1.6)]
        : null,
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
  const goalAdjustmentCalories = GOAL_DETAILS[input.goal].adjustmentCalories;
  const target = round(maintenanceCalories + goalAdjustmentCalories);

  return {
    calorieTarget: target,
    calorieRange: [Math.max(800, target - 100), target + 100],
    maintenanceCalories,
    goalAdjustmentCalories,
    restingEnergy,
    proteinRangeG: [round(input.weightKg * 1.2), round(input.weightKg * 1.6)],
    fibreTargetG: round((target / 1000) * 14),
    method: 'mifflin-st-jeor',
  };
}

export function calculateTargetWeightProgress(currentWeightKg: number, targetWeightKg: number) {
  const signedDifferenceKg = round(targetWeightKg - currentWeightKg, 1);
  const distanceKg = Math.abs(signedDifferenceKg);
  const direction =
    distanceKg < 0.05 ? 'reached' : signedDifferenceKg < 0 ? 'lose' : ('gain' as const);

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
  thresholdHours: number
): FastWindow[] {
  const sorted = [...entries].sort((a, b) => a.eatenAt - b.eatenAt);
  const thresholdMs = thresholdHours * 60 * 60 * 1000;
  const windows: FastWindow[] = [];

  for (let index = 1; index < sorted.length; index += 1) {
    const startAt = sorted[index - 1].eatenAt;
    const endAt = sorted[index].eatenAt;
    const gap = endAt - startAt;
    if (gap >= thresholdMs) {
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
  const recent = [...entries]
    .filter((entry) => entry.carbsG > 0 && entry.eatenAt <= now)
    .sort((a, b) => b.eatenAt - a.eatenAt)
    .find((entry) => now - entry.eatenAt <= 6 * 60 * 60 * 1000);

  if (!recent) {
    return {
      state: 'no-recent-carbs',
      startAt: null,
      endAt: null,
      carbsG: null,
      sourceEntry: null,
      explanation: 'No recent carb-containing entry points to a specific training window.',
    };
  }

  const [startMinutes, endMinutes] =
    recent.carbsG <= 20 ? [30, 90] : recent.carbsG <= 50 ? [60, 150] : [90, 240];

  return {
    state: 'window',
    startAt: recent.eatenAt + startMinutes * 60 * 1000,
    endAt: recent.eatenAt + endMinutes * 60 * 1000,
    carbsG: round(recent.carbsG, 1),
    sourceEntry: recent.foodName,
    explanation: `${round(recent.carbsG)} g carbs in ${recent.foodName} suggests a broad ${startMinutes}–${endMinutes} minute post-meal window.`,
  };
}

export function timeToMinutes(time: string): number {
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

  const settleGap = input.lastEntryCalories < 150 ? 60 : input.lastEntryCalories < 400 ? 120 : 180;
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

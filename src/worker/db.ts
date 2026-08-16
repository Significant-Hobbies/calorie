import {
  normalizeDailyActionHidden,
  normalizeDailyActionOrder,
} from '../lib/daily-action-preferences';
import { normalizeDirectEntry } from '../lib/entries';
import { normalizeFoodLabels, normalizeIsPackaged } from '../lib/food-context';
import { cycleFromGoal } from '../lib/goal-cycles';
import { calculateNutritionTarget } from '../lib/recommendations';
import type {
  ActivityLevel,
  EquationProfile,
  Food,
  FoodEntry,
  Goal,
  GoalCycle,
  GoalCycleSession,
  Medication,
  MedicationCheckIn,
  MedicationSchedule,
  ServingMode,
  UserProfile,
  WaterEntry,
  WeightEntry,
} from '../lib/types';
import { finiteNumber, optionalText, requiredText } from './http';

export function directEntryFromBody(
  body: Record<string, unknown>,
  id: string,
  amount: number,
  eatenAt: number
): FoodEntry | null {
  const foodName = optionalText(body.foodName, 80);
  const unitLabel = optionalText(body.unitLabel, 24);
  const calories = finiteNumber(body.calories, 0, 100_000);
  const carbsG = finiteNumber(body.carbsG, 0, 100_000);
  const proteinG = finiteNumber(body.proteinG, 0, 100_000);
  const fibreG = finiteNumber(body.fibreG, 0, 100_000);
  if (
    !foodName ||
    !unitLabel ||
    calories === null ||
    carbsG === null ||
    proteinG === null ||
    fibreG === null
  ) {
    return null;
  }
  return normalizeDirectEntry({
    id,
    foodId: null,
    foodName,
    amount,
    unitLabel,
    calories,
    carbsG,
    proteinG,
    fibreG,
    eatenAt,
    isPackaged: normalizeIsPackaged(body.isPackaged, body.foodKind),
    labels: normalizeFoodLabels(body.labels),
  });
}

type ProfileRow = {
  user_id: string;
  display_name: string;
  units: 'metric' | 'imperial';
  age_years: number | null;
  gender_identity: string | null;
  equation_profile: EquationProfile | null;
  height_cm: number | null;
  activity_level: ActivityLevel;
  goal: Goal;
  target_weight_kg: number | null;
  manual_calorie_target: number | null;
  manual_calorie_min: number | null;
  manual_calorie_max: number | null;
  daily_action_order: string;
  daily_action_hidden: string;
  wake_time: string;
  sleep_hours: number;
  fasting_threshold_hours: 12 | 14 | 16;
  water_target_ml: number;
  onboarding_complete: number;
};

function mapProfile(row: ProfileRow): UserProfile {
  return {
    userId: row.user_id,
    displayName: row.display_name,
    units: row.units,
    ageYears: row.age_years,
    genderIdentity: row.gender_identity,
    equationProfile: row.equation_profile,
    heightCm: row.height_cm,
    activityLevel: row.activity_level,
    goal: row.goal,
    targetWeightKg: row.target_weight_kg,
    manualCalorieTarget: row.manual_calorie_target,
    manualCalorieRange:
      row.manual_calorie_min !== null && row.manual_calorie_max !== null
        ? [row.manual_calorie_min, row.manual_calorie_max]
        : row.manual_calorie_target
          ? [Math.max(800, row.manual_calorie_target - 100), row.manual_calorie_target + 100]
          : null,
    wakeTime: row.wake_time,
    sleepHours: row.sleep_hours,
    fastingThresholdHours: row.fasting_threshold_hours,
    waterTargetMl: row.water_target_ml,
    dailyActionOrder: normalizeDailyActionOrder(row.daily_action_order?.split(',') ?? []),
    dailyActionHidden: normalizeDailyActionHidden(row.daily_action_hidden?.split(',') ?? []),
    onboardingComplete: Boolean(row.onboarding_complete),
  };
}

function defaultProfile(userId: string, name: string): UserProfile {
  return {
    userId,
    displayName: name,
    units: 'metric',
    ageYears: null,
    genderIdentity: null,
    equationProfile: null,
    heightCm: null,
    activityLevel: 'moderate',
    goal: 'maintain',
    targetWeightKg: null,
    manualCalorieTarget: null,
    manualCalorieRange: null,
    wakeTime: '07:00',
    sleepHours: 8,
    fastingThresholdHours: 12,
    waterTargetMl: 2000,
    dailyActionOrder: normalizeDailyActionOrder([]),
    dailyActionHidden: [],
    onboardingComplete: false,
  };
}

export async function readProfile(
  db: D1Database,
  userId: string,
  fallbackName: string
): Promise<UserProfile> {
  const row = await db
    .prepare('SELECT * FROM profiles WHERE user_id = ?')
    .bind(userId)
    .first<ProfileRow>();
  return row ? mapProfile(row) : defaultProfile(userId, fallbackName);
}

export type FoodRow = {
  id: string;
  name: string;
  serving_mode: ServingMode;
  unit_label: string;
  default_amount: number;
  calories: number;
  carbs_g: number;
  protein_g: number;
  fibre_g: number;
  favourite: number;
  last_used_at: number | null;
  archived_at: number | null;
  food_kind: string;
  is_packaged: number;
  labels_json: string;
};

export function mapFood(row: FoodRow): Food {
  return {
    id: row.id,
    name: row.name,
    servingMode: row.serving_mode,
    unitLabel: row.unit_label,
    defaultAmount: row.default_amount,
    calories: row.calories,
    carbsG: row.carbs_g,
    proteinG: row.protein_g,
    fibreG: row.fibre_g,
    favourite: Boolean(row.favourite),
    lastUsedAt: row.last_used_at,
    archivedAt: row.archived_at ?? null,
    isPackaged: normalizeIsPackaged(row.is_packaged, row.food_kind),
    labels: normalizeFoodLabels(JSON.parse(row.labels_json || '[]')),
  };
}

export type FoodEntryRow = {
  id: string;
  food_id: string | null;
  food_name: string;
  amount: number;
  unit_label: string;
  calories: number;
  carbs_g: number;
  protein_g: number;
  fibre_g: number;
  eaten_at: number;
  food_kind: string;
  is_packaged: number;
  labels_json: string;
};

export function mapFoodEntry(row: FoodEntryRow): FoodEntry {
  return {
    id: row.id,
    foodId: row.food_id,
    foodName: row.food_name,
    amount: row.amount,
    unitLabel: row.unit_label,
    calories: row.calories,
    carbsG: row.carbs_g,
    proteinG: row.protein_g,
    fibreG: row.fibre_g,
    eatenAt: row.eaten_at,
    isPackaged: normalizeIsPackaged(row.is_packaged, row.food_kind),
    labels: normalizeFoodLabels(JSON.parse(row.labels_json || '[]')),
  };
}

export type WaterRow = { id: string; amount_ml: number; drank_at: number };
export type WeightRow = { id: string; weight_kg: number; recorded_at: number };
export type GoalCycleRow = {
  id: string;
  user_id: string;
  cycle: GoalCycle;
  goal: Goal;
  start_on: string;
  end_on: string | null;
  calorie_range_low: number | null;
  calorie_range_high: number | null;
  protein_range_low: number | null;
  protein_range_high: number | null;
  created_at: number;
  updated_at: number;
};
export type MedicationRow = {
  id: string;
  name: string;
  schedule: MedicationSchedule;
  created_at: number;
  archived_at: number | null;
};
export type MedicationCheckInRow = {
  id: string;
  medication_id: string;
  taken_on: string;
  taken_at: number;
};
export type MedicationHistoryRow = {
  id: string;
  medication_id: string;
  medication_name: string;
  taken_at: number;
};

export function mapWater(row: WaterRow): WaterEntry {
  return { id: row.id, amountMl: row.amount_ml, drankAt: row.drank_at };
}

export function mapWeight(row: WeightRow): WeightEntry {
  return { id: row.id, weightKg: row.weight_kg, recordedAt: row.recorded_at };
}

export function mapGoalCycle(row: GoalCycleRow): GoalCycleSession {
  return {
    id: row.id,
    userId: row.user_id,
    cycle: row.cycle,
    goal: row.goal,
    startOn: row.start_on,
    endOn: row.end_on,
    calorieRange:
      row.calorie_range_low !== null && row.calorie_range_high !== null
        ? [row.calorie_range_low, row.calorie_range_high]
        : null,
    proteinRangeG:
      row.protein_range_low !== null && row.protein_range_high !== null
        ? [row.protein_range_low, row.protein_range_high]
        : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function currentTarget(db: D1Database, profile: UserProfile, userId: string) {
  const latestWeight = await db
    .prepare(
      'SELECT id, weight_kg, recorded_at FROM weight_entries WHERE user_id = ? ORDER BY recorded_at DESC LIMIT 1'
    )
    .bind(userId)
    .first<WeightRow>();
  return calculateNutritionTarget({
    weightKg: latestWeight?.weight_kg ?? null,
    heightCm: profile.heightCm,
    ageYears: profile.ageYears,
    equationProfile: profile.equationProfile,
    activityLevel: profile.activityLevel,
    goal: profile.goal,
    manualCalorieTarget: profile.manualCalorieTarget,
    manualCalorieRange: profile.manualCalorieRange,
  });
}

export function cycleInsertStatement(
  db: D1Database,
  input: {
    id: string;
    userId: string;
    goal: Goal;
    startOn: string;
    calorieRange: [number, number] | null;
    proteinRangeG: [number, number] | null;
    now: number;
  }
) {
  return db
    .prepare(
      `INSERT INTO goal_cycles (
        id, user_id, cycle, goal, start_on, end_on,
        calorie_range_low, calorie_range_high, protein_range_low, protein_range_high,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      input.id,
      input.userId,
      cycleFromGoal(input.goal),
      input.goal,
      input.startOn,
      input.calorieRange?.[0] ?? null,
      input.calorieRange?.[1] ?? null,
      input.proteinRangeG?.[0] ?? null,
      input.proteinRangeG?.[1] ?? null,
      input.now,
      input.now
    );
}

export function mapMedication(row: MedicationRow): Medication {
  return {
    id: row.id,
    name: row.name,
    schedule: row.schedule,
    createdAt: row.created_at,
    archivedAt: row.archived_at,
  };
}

export function mapMedicationCheckIn(row: MedicationCheckInRow): MedicationCheckIn {
  return {
    id: row.id,
    medicationId: row.medication_id,
    takenOn: row.taken_on,
    takenAt: row.taken_at,
  };
}

export function parseFoodBody(body: Record<string, unknown>) {
  const name = requiredText(body.name, 80);
  const servingMode = ['per_100g', 'per_unit'].includes(String(body.servingMode))
    ? (body.servingMode as ServingMode)
    : null;
  const unitLabel = requiredText(body.unitLabel, 24);
  const defaultAmount = finiteNumber(body.defaultAmount, 0.01, 10000);
  const calories = finiteNumber(body.calories, 0, 10000);
  const carbsG = finiteNumber(body.carbsG, 0, 1000);
  const proteinG = finiteNumber(body.proteinG, 0, 1000);
  const fibreG = finiteNumber(body.fibreG, 0, 1000);
  if (
    !name ||
    !servingMode ||
    !unitLabel ||
    defaultAmount === null ||
    calories === null ||
    carbsG === null ||
    proteinG === null ||
    fibreG === null
  ) {
    return null;
  }
  return {
    name,
    servingMode,
    unitLabel,
    defaultAmount,
    calories,
    carbsG,
    proteinG,
    fibreG,
    favourite: body.favourite === true ? 1 : 0,
    isPackaged: normalizeIsPackaged(body.isPackaged, body.foodKind),
    labels: normalizeFoodLabels(body.labels),
  };
}

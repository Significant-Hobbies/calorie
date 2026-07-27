export type Units = 'metric' | 'imperial';
export type EquationProfile = 'female' | 'male' | 'none';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very';
export type Goal = 'lose_gentle' | 'lose_steady' | 'maintain' | 'gain_gentle';
export type ServingMode = 'per_100g' | 'per_unit';

export type Nutrients = {
  calories: number;
  carbsG: number;
  proteinG: number;
  fibreG: number;
};

export type UserProfile = {
  userId: string;
  displayName: string;
  units: Units;
  ageYears: number | null;
  genderIdentity: string | null;
  equationProfile: EquationProfile | null;
  heightCm: number | null;
  activityLevel: ActivityLevel;
  goal: Goal;
  targetWeightKg: number | null;
  manualCalorieTarget: number | null;
  wakeTime: string;
  sleepHours: number;
  fastingThresholdHours: 12 | 14 | 16;
  waterTargetMl: number;
  onboardingComplete: boolean;
};

export type Food = Nutrients & {
  id: string;
  name: string;
  servingMode: ServingMode;
  unitLabel: string;
  defaultAmount: number;
  favourite: boolean;
  lastUsedAt: number | null;
};

export type FoodEntry = Nutrients & {
  id: string;
  foodId: string | null;
  foodName: string;
  amount: number;
  unitLabel: string;
  eatenAt: number;
};

export type FoodEntryWrite = FoodEntry & {
  optimistic: FoodEntry;
};

export type WaterEntry = {
  id: string;
  amountMl: number;
  drankAt: number;
};

export type WeightEntry = {
  id: string;
  weightKg: number;
  recordedAt: number;
};

export type NutritionTarget = {
  calorieTarget: number | null;
  calorieRange: [number, number] | null;
  maintenanceCalories: number | null;
  goalAdjustmentCalories: number | null;
  restingEnergy: number | null;
  proteinRangeG: [number, number] | null;
  fibreTargetG: number | null;
  method: 'mifflin-st-jeor' | 'manual' | 'unavailable';
};

export type GymGuidance = {
  state: 'window' | 'no-recent-carbs';
  startAt: number | null;
  endAt: number | null;
  carbsG: number | null;
  sourceEntry: string | null;
  explanation: string;
};

export type SleepGuidance = {
  recommendedMinutes: number;
  routineMinutes: number;
  settleMinutes: number | null;
  explanation: string;
};

export type FastWindow = {
  startAt: number;
  endAt: number;
  durationHours: number;
};

export type Dashboard = {
  profile: UserProfile;
  foods: Food[];
  entries: FoodEntry[];
  waterEntries: WaterEntry[];
  latestWeight: WeightEntry | null;
  totals: Nutrients & { waterMl: number };
  target: NutritionTarget;
  completedFasts: FastWindow[];
  date: string;
  timezone: string;
};

export type HistoryDay = Nutrients & {
  date: string;
  waterMl: number;
  fastCount: number;
};

export type HistoryResponse = {
  days: HistoryDay[];
  weights: WeightEntry[];
  rangeDays?: 7 | 30;
};

export type PendingWrite = {
  id: string;
  path: string;
  method: 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  createdAt: number;
};

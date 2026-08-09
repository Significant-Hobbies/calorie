export type Units = 'metric' | 'imperial';
export type EquationProfile = 'female' | 'male' | 'none';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very';
export type Goal = 'lose_gentle' | 'lose_steady' | 'maintain' | 'gain_gentle';
export type ServingMode = 'per_100g' | 'per_unit';
export type MedicationSchedule = 'morning' | 'evening' | 'either';
export type ThemePreference = 'system' | 'light' | 'dark';
export type DailyActionKey = 'weight' | 'creatine' | 'food' | 'water';
export type GoalCycle = 'cut' | 'gain' | 'recomposition';

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
  manualCalorieRange: [number, number] | null;
  wakeTime: string;
  sleepHours: number;
  fastingThresholdHours: 12 | 14 | 16;
  waterTargetMl: number;
  dailyActionOrder: DailyActionKey[];
  dailyActionHidden: DailyActionKey[];
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
  archivedAt: number | null;
  isPackaged?: boolean;
  labels?: string[];
};

export type FoodEntry = Nutrients & {
  id: string;
  foodId: string | null;
  foodName: string;
  amount: number;
  unitLabel: string;
  eatenAt: number;
  isPackaged?: boolean;
  labels?: string[];
};

export type FoodEntryWrite = FoodEntry & {
  optimistic: FoodEntry;
};

export type WaterEntry = {
  id: string;
  amountMl: number;
  drankAt: number;
};

export type Medication = {
  id: string;
  name: string;
  schedule: MedicationSchedule;
  createdAt: number;
  archivedAt: number | null;
};

export type MedicationCheckIn = {
  id: string;
  medicationId: string;
  takenOn: string;
  takenAt: number;
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
  goalAdjustmentRangeCalories: [number, number] | null;
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
  phase?: 'upcoming' | 'active';
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
  medications: Medication[];
  medicationCheckIns: MedicationCheckIn[];
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
  entries?: FoodEntry[];
  rangeDays?: 7 | 30;
};

export type GoalCycleSession = {
  id: string;
  userId: string;
  cycle: GoalCycle;
  goal: Goal;
  startOn: string;
  endOn: string | null;
  calorieRange: [number, number] | null;
  proteinRangeG: [number, number] | null;
  createdAt: number;
  updatedAt: number;
};

export type CyclePeriodData = {
  session: GoalCycleSession;
  days: HistoryDay[];
  weights: WeightEntry[];
};

export type CycleHistoryResponse = {
  active: CyclePeriodData;
  previous: CyclePeriodData | null;
  today: string;
  timezone: string;
};

export type JournalExport = {
  schema: 'calorie-journal-backup';
  version: 2;
  generatedAt: string;
  profile: UserProfile;
  foods: Food[];
  entries: FoodEntry[];
  waterEntries: WaterEntry[];
  medications: Medication[];
  medicationCheckIns: MedicationCheckIn[];
  weights: WeightEntry[];
  cycleSessions: GoalCycleSession[];
};

export type MealTimingBandKey = 'before_noon' | 'midday' | 'after_five';

export type MealTimingBand = {
  key: MealTimingBandKey;
  calories: number;
  proteinG: number;
  calorieShare: number;
  proteinShare: number;
};

export type MealTimingAnalysis = {
  loggedDays: number;
  entryCount: number;
  typicalFirstMinutes: number | null;
  typicalLastMinutes: number | null;
  averageEatingWindowMinutes: number | null;
  eatingWindowDays: number;
  sleepRoutineMinutes: number;
  nearSleepDays: number;
  bands: MealTimingBand[];
  leadingProteinBand: MealTimingBandKey | null;
  mostLoggedFood: {
    name: string;
    entryCount: number;
    typicalMinutes: number;
  } | null;
};

export type PendingWrite = {
  id: string;
  path: string;
  method: 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  createdAt: number;
};

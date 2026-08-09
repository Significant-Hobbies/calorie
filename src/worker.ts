import { Hono } from 'hono';
import { handleAgentEdge } from './agent-edge.mjs';
import {
  normalizeDailyActionHidden,
  normalizeDailyActionOrder,
} from './lib/daily-action-preferences';
import { normalizeDirectEntry } from './lib/entries';
import { normalizeFoodLabels, normalizeIsPackaged } from './lib/food-context';
import { cycleFromGoal } from './lib/goal-cycles';
import { createJournalExport } from './lib/journal-export';
import {
  calculateCompletedFasts,
  calculateNutritionTarget,
  round,
  scaleNutrients,
} from './lib/recommendations';
import type {
  ActivityLevel,
  Dashboard,
  EquationProfile,
  Food,
  FoodEntry,
  Goal,
  GoalCycle,
  GoalCycleSession,
  HistoryDay,
  HistoryResponse,
  Medication,
  MedicationCheckIn,
  MedicationSchedule,
  ServingMode,
  UserProfile,
  WaterEntry,
  WeightEntry,
} from './lib/types';
import { type AuthBindings, createAuth, isGoogleConfigured } from './server/auth';

type AppBindings = AuthBindings;
type AppVariables = {
  userId: string;
  userName: string;
  userEmail: string;
  userImage: string | null;
};

const app = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>();

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

app.use('*', async (c, next) => {
  const agentResponse = handleAgentEdge(c.req.raw);
  if (agentResponse) return agentResponse;
  await next();
});

app.use('/api/*', async (c, next) => {
  await next();
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) c.header(name, value);
  // Read-only GETs set their own Cache-Control via conditionalJson; everything
  // else stays no-store.
  if (!c.res.headers.has('Cache-Control')) c.header('Cache-Control', 'no-store');
});

/**
 * Weak ETag helper for read-only API responses. Combines the user ID, request
 * query string, and a 30-second time bucket so responses are cacheable for 30s
 * on the client and via conditional requests (If-None-Match → 304).
 */
function etagFor(userId: string, query: string): string {
  const bucket = Math.floor(Date.now() / 30_000);
  return `W/"${userId}:${bucket}:${query.length}"`;
}

function conditionalJson<T>(
  c: {
    req: { url: string; header: (name: string) => string | undefined };
    get: (key: 'userId') => string;
    header: (name: string, value: string) => void;
    json: (data: T) => Response;
    body: (data: null, status: number) => Response;
  },
  data: T
): Response {
  const tag = etagFor(c.get('userId'), new URL(c.req.url).search);
  if (c.req.header('If-None-Match') === tag) return c.body(null, 304);
  c.header('ETag', tag);
  c.header('Cache-Control', 'private, max-age=30');
  return c.json(data);
}

app.get('/api/health', (c) =>
  c.json({
    ok: true,
    auth: { googleConfigured: isGoogleConfigured(c.env) },
    storage: 'd1',
  })
);

app.get('/api/auth/config', (c) =>
  c.json({
    googleConfigured: isGoogleConfigured(c.env),
  })
);

app.on(['GET', 'POST'], '/api/auth/*', (c) => {
  const path = new URL(c.req.url).pathname;
  if (path.endsWith('/sign-in/social') && c.req.method === 'POST' && !isGoogleConfigured(c.env)) {
    return c.json(
      {
        code: 'OAUTH_NOT_CONFIGURED',
        message: 'Google sign-in is not configured in this environment.',
      },
      503
    );
  }
  return createAuth(c.env, c.req.url).handler(c.req.raw);
});

app.use('/api/app/*', async (c, next) => {
  const session = await createAuth(c.env, c.req.url).api.getSession({
    headers: c.req.raw.headers,
  });
  if (!session?.user?.id) {
    return c.json({ code: 'UNAUTHORIZED', message: 'Sign in to continue.' }, 401);
  }
  c.set('userId', session.user.id);
  c.set('userName', session.user.name || 'You');
  c.set('userEmail', session.user.email || '');
  c.set('userImage', session.user.image || null);
  await next();
});

function finiteNumber(value: unknown, min: number, max: number): number | null {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

function optionalText(value: unknown, max = 80): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= max ? trimmed : null;
}

function requiredText(value: unknown, max = 80): string | null {
  return optionalText(value, max);
}

function validTimestamp(value: unknown): number | null {
  const timestamp = finiteNumber(value, 0, Date.now() + 24 * 60 * 60 * 1000);
  return timestamp === null ? null : Math.round(timestamp);
}

function jsonError(message: string, fields?: Record<string, string>) {
  return { code: 'VALIDATION_ERROR', message, fields };
}

function directEntryFromBody(
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

async function readProfile(
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

type FoodRow = {
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

function mapFood(row: FoodRow): Food {
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

type FoodEntryRow = {
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

function mapFoodEntry(row: FoodEntryRow): FoodEntry {
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

type WaterRow = { id: string; amount_ml: number; drank_at: number };
type WeightRow = { id: string; weight_kg: number; recorded_at: number };
type GoalCycleRow = {
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
type MedicationRow = {
  id: string;
  name: string;
  schedule: MedicationSchedule;
  created_at: number;
  archived_at: number | null;
};
type MedicationCheckInRow = {
  id: string;
  medication_id: string;
  taken_on: string;
  taken_at: number;
};

function mapWater(row: WaterRow): WaterEntry {
  return { id: row.id, amountMl: row.amount_ml, drankAt: row.drank_at };
}

function mapWeight(row: WeightRow): WeightEntry {
  return { id: row.id, weightKg: row.weight_kg, recordedAt: row.recorded_at };
}

function mapGoalCycle(row: GoalCycleRow): GoalCycleSession {
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

function validDateKey(value: unknown) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

async function currentTarget(db: D1Database, profile: UserProfile, userId: string) {
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

function cycleInsertStatement(
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

function mapMedication(row: MedicationRow): Medication {
  return {
    id: row.id,
    name: row.name,
    schedule: row.schedule,
    createdAt: row.created_at,
    archivedAt: row.archived_at,
  };
}

function mapMedicationCheckIn(row: MedicationCheckInRow): MedicationCheckIn {
  return {
    id: row.id,
    medicationId: row.medication_id,
    takenOn: row.taken_on,
    takenAt: row.taken_at,
  };
}

app.get('/api/app/profile', async (c) => {
  const profile = await readProfile(c.env.DB, c.get('userId'), c.get('userName'));
  return conditionalJson(c, profile);
});

app.get('/api/app/bootstrap', async (c) => {
  const userId = c.get('userId');
  const profile = await readProfile(c.env.DB, userId, c.get('userName'));
  return c.json({
    session: {
      user: {
        id: userId,
        name: c.get('userName'),
        email: c.get('userEmail'),
        image: c.get('userImage'),
      },
    },
    profile,
  });
});

app.put('/api/app/profile', async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch(() => null);
  if (!body) return c.json(jsonError('Profile details are required.'), 400);

  const displayName = requiredText(body.displayName, 60);
  const units = body.units === 'imperial' ? 'imperial' : body.units === 'metric' ? 'metric' : null;
  const ageYears = finiteNumber(body.ageYears, 18, 120);
  const heightCm = finiteNumber(body.heightCm, 100, 250);
  const equationProfile = ['female', 'male', 'none'].includes(String(body.equationProfile))
    ? (body.equationProfile as EquationProfile)
    : null;
  const activityLevel = ['sedentary', 'light', 'moderate', 'very'].includes(
    String(body.activityLevel)
  )
    ? (body.activityLevel as ActivityLevel)
    : null;
  const goal = ['lose_gentle', 'lose_steady', 'maintain', 'gain_gentle'].includes(String(body.goal))
    ? (body.goal as Goal)
    : null;
  const targetWeightKg =
    body.targetWeightKg === null ? null : finiteNumber(body.targetWeightKg, 30, 400);
  const initialWeightKg =
    body.initialWeightKg === undefined ? null : finiteNumber(body.initialWeightKg, 30, 400);
  const manualTarget =
    body.manualCalorieTarget === null || body.manualCalorieTarget === undefined
      ? null
      : finiteNumber(body.manualCalorieTarget, 800, 6000);
  const manualRangeInput = Array.isArray(body.manualCalorieRange) ? body.manualCalorieRange : null;
  const manualRangeMin = manualRangeInput ? finiteNumber(manualRangeInput[0], 800, 6000) : null;
  const manualRangeMax = manualRangeInput ? finiteNumber(manualRangeInput[1], 800, 6000) : null;
  const hasInvalidManualRange =
    manualRangeInput !== null &&
    (manualRangeMin === null || manualRangeMax === null || manualRangeMin > manualRangeMax);
  const sleepHours = finiteNumber(body.sleepHours, 5, 12);
  const waterTargetMl = finiteNumber(body.waterTargetMl, 250, 10000);
  const fastingThreshold = [12, 14, 16].includes(Number(body.fastingThresholdHours))
    ? Number(body.fastingThresholdHours)
    : null;
  const wakeTime =
    typeof body.wakeTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(body.wakeTime)
      ? body.wakeTime
      : null;
  const dailyActionOrder = normalizeDailyActionOrder(
    Array.isArray(body.dailyActionOrder) ? body.dailyActionOrder : []
  );
  const dailyActionHidden = normalizeDailyActionHidden(
    Array.isArray(body.dailyActionHidden) ? body.dailyActionHidden : []
  );
  const cycleDate = validDateKey(body.cycleDate) ?? dateKey(Date.now(), 'UTC');

  if (
    !displayName ||
    !units ||
    ageYears === null ||
    heightCm === null ||
    !equationProfile ||
    !activityLevel ||
    !goal ||
    sleepHours === null ||
    waterTargetMl === null ||
    hasInvalidManualRange ||
    fastingThreshold === null ||
    !wakeTime
  ) {
    return c.json(jsonError('Check the highlighted profile details and try again.'), 400);
  }

  const now = Date.now();
  const userId = c.get('userId');
  const genderIdentity = optionalText(body.genderIdentity, 40);
  const onboardingComplete = body.onboardingComplete === false ? 0 : 1;
  const manualRange =
    manualRangeMin !== null && manualRangeMax !== null
      ? ([Math.round(manualRangeMin), Math.round(manualRangeMax)] as const)
      : null;

  const statements = [
    c.env.DB.prepare(
      `INSERT INTO profiles (
        user_id, display_name, units, age_years, gender_identity, equation_profile,
        height_cm, activity_level, goal, target_weight_kg, manual_calorie_target,
        manual_calorie_min, manual_calorie_max,
        wake_time, sleep_hours, fasting_threshold_hours, water_target_ml,
        daily_action_order, daily_action_hidden, onboarding_complete, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        display_name = excluded.display_name,
        units = excluded.units,
        age_years = excluded.age_years,
        gender_identity = excluded.gender_identity,
        equation_profile = excluded.equation_profile,
        height_cm = excluded.height_cm,
        activity_level = excluded.activity_level,
        goal = excluded.goal,
        target_weight_kg = excluded.target_weight_kg,
        manual_calorie_target = excluded.manual_calorie_target,
        manual_calorie_min = excluded.manual_calorie_min,
        manual_calorie_max = excluded.manual_calorie_max,
        wake_time = excluded.wake_time,
        sleep_hours = excluded.sleep_hours,
        fasting_threshold_hours = excluded.fasting_threshold_hours,
        water_target_ml = excluded.water_target_ml,
        daily_action_order = excluded.daily_action_order,
        daily_action_hidden = excluded.daily_action_hidden,
        onboarding_complete = excluded.onboarding_complete,
        updated_at = excluded.updated_at`
    ).bind(
      userId,
      displayName,
      units,
      ageYears,
      genderIdentity,
      equationProfile,
      heightCm,
      activityLevel,
      goal,
      targetWeightKg,
      manualRange ? Math.round((manualRange[0] + manualRange[1]) / 2) : manualTarget,
      manualRange?.[0] ?? null,
      manualRange?.[1] ?? null,
      wakeTime,
      sleepHours,
      fastingThreshold,
      Math.round(waterTargetMl),
      dailyActionOrder.join(','),
      dailyActionHidden.join(','),
      onboardingComplete,
      now,
      now
    ),
  ];

  const initialWeightId = optionalText(body.initialWeightId, 80);
  if (initialWeightKg !== null && initialWeightId) {
    statements.push(
      c.env.DB.prepare(
        `INSERT OR IGNORE INTO weight_entries
          (id, user_id, weight_kg, recorded_at, created_at)
        VALUES (?, ?, ?, ?, ?)`
      ).bind(initialWeightId, userId, initialWeightKg, now, now)
    );
  }

  const nextProfile: UserProfile = {
    userId,
    displayName,
    units,
    ageYears,
    genderIdentity,
    equationProfile,
    heightCm,
    activityLevel,
    goal,
    targetWeightKg,
    manualCalorieTarget: manualRange
      ? Math.round((manualRange[0] + manualRange[1]) / 2)
      : manualTarget,
    manualCalorieRange: manualRange ? [manualRange[0], manualRange[1]] : null,
    wakeTime,
    sleepHours,
    fastingThresholdHours: fastingThreshold as 12 | 14 | 16,
    waterTargetMl: Math.round(waterTargetMl),
    dailyActionOrder,
    dailyActionHidden,
    onboardingComplete: Boolean(onboardingComplete),
  };
  const target = initialWeightKg
    ? calculateNutritionTarget({
        weightKg: initialWeightKg,
        heightCm,
        ageYears,
        equationProfile,
        activityLevel,
        goal,
        manualCalorieTarget: nextProfile.manualCalorieTarget,
        manualCalorieRange: nextProfile.manualCalorieRange,
      })
    : await currentTarget(c.env.DB, nextProfile, userId);
  const activeCycle = await c.env.DB.prepare(
    'SELECT * FROM goal_cycles WHERE user_id = ? AND end_on IS NULL'
  )
    .bind(userId)
    .first<GoalCycleRow>();
  if (!activeCycle) {
    statements.push(
      cycleInsertStatement(c.env.DB, {
        id: crypto.randomUUID(),
        userId,
        goal,
        startOn: cycleDate,
        calorieRange: target.calorieRange,
        proteinRangeG: target.proteinRangeG,
        now,
      })
    );
  } else if (activeCycle.cycle === cycleFromGoal(goal)) {
    statements.push(
      c.env.DB.prepare(
        `UPDATE goal_cycles SET goal = ?, calorie_range_low = ?, calorie_range_high = ?,
            protein_range_low = ?, protein_range_high = ?, updated_at = ?
           WHERE id = ? AND user_id = ? AND end_on IS NULL`
      ).bind(
        goal,
        target.calorieRange?.[0] ?? null,
        target.calorieRange?.[1] ?? null,
        target.proteinRangeG?.[0] ?? null,
        target.proteinRangeG?.[1] ?? null,
        now,
        activeCycle.id,
        userId
      )
    );
  } else {
    statements.push(
      c.env.DB.prepare(
        'UPDATE goal_cycles SET end_on = ?, updated_at = ? WHERE id = ? AND user_id = ? AND end_on IS NULL'
      ).bind(cycleDate, now, activeCycle.id, userId),
      cycleInsertStatement(c.env.DB, {
        id: crypto.randomUUID(),
        userId,
        goal,
        startOn: cycleDate,
        calorieRange: target.calorieRange,
        proteinRangeG: target.proteinRangeG,
        now,
      })
    );
  }
  await c.env.DB.batch(statements);
  return c.json(await readProfile(c.env.DB, userId, displayName));
});

app.get('/api/app/cycles', async (c) => {
  const userId = c.get('userId');
  const today = validDateKey(c.req.query('date'));
  if (!today) return c.json(jsonError('Choose a valid local date.'), 400);
  let result = await c.env.DB.prepare(
    'SELECT * FROM goal_cycles WHERE user_id = ? ORDER BY start_on DESC LIMIT 20'
  )
    .bind(userId)
    .all<GoalCycleRow>();
  if (!result.results.some((row) => row.end_on === null)) {
    const profile = await readProfile(c.env.DB, userId, c.get('userName'));
    const target = await currentTarget(c.env.DB, profile, userId);
    await cycleInsertStatement(c.env.DB, {
      id: crypto.randomUUID(),
      userId,
      goal: profile.goal,
      startOn: today,
      calorieRange: target.calorieRange,
      proteinRangeG: target.proteinRangeG,
      now: Date.now(),
    }).run();
    result = await c.env.DB.prepare(
      'SELECT * FROM goal_cycles WHERE user_id = ? ORDER BY start_on DESC LIMIT 20'
    )
      .bind(userId)
      .all<GoalCycleRow>();
  }
  return conditionalJson(c, result.results.map(mapGoalCycle));
});

app.patch('/api/app/cycles/active', async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch(() => null);
  const startOn = validDateKey(body?.startOn);
  const today = validDateKey(body?.today);
  if (!startOn || !today || startOn > today) {
    return c.json(jsonError('Choose a cycle start date that is not in the future.'), 400);
  }
  const userId = c.get('userId');
  const active = await c.env.DB.prepare(
    'SELECT * FROM goal_cycles WHERE user_id = ? AND end_on IS NULL'
  )
    .bind(userId)
    .first<GoalCycleRow>();
  if (!active) return c.json({ message: 'Active cycle not found.' }, 404);
  const previous = await c.env.DB.prepare(
    `SELECT * FROM goal_cycles WHERE user_id = ? AND end_on IS NOT NULL
       ORDER BY end_on DESC LIMIT 1`
  )
    .bind(userId)
    .first<GoalCycleRow>();
  if (previous?.end_on && startOn < previous.end_on) {
    return c.json(
      jsonError(`Cycle start must be on or after ${previous.end_on}.`, {
        startOn: 'Overlaps the previous cycle.',
      }),
      400
    );
  }
  await c.env.DB.prepare(
    'UPDATE goal_cycles SET start_on = ?, updated_at = ? WHERE id = ? AND user_id = ? AND end_on IS NULL'
  )
    .bind(startOn, Date.now(), active.id, userId)
    .run();
  const updated = await c.env.DB.prepare('SELECT * FROM goal_cycles WHERE id = ? AND user_id = ?')
    .bind(active.id, userId)
    .first<GoalCycleRow>();
  if (!updated) return c.json({ message: 'The cycle could not be read back.' }, 500);
  return c.json(mapGoalCycle(updated));
});

app.get('/api/app/foods', async (c) => {
  const search = c.req.query('q')?.trim().slice(0, 60);
  const lifecycleWhere =
    c.req.query('status') === 'archived' ? 'archived_at IS NOT NULL' : 'archived_at IS NULL';
  const result = search
    ? await c.env.DB.prepare(
        `SELECT * FROM foods
         WHERE user_id = ? AND ${lifecycleWhere} AND name LIKE ? ESCAPE '\\'
         ORDER BY last_used_at DESC, name ASC LIMIT 50`
      )
        .bind(c.get('userId'), `%${search.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`)
        .all<FoodRow>()
    : await c.env.DB.prepare(
        `SELECT * FROM foods WHERE user_id = ? AND ${lifecycleWhere}
         ORDER BY last_used_at DESC, name ASC LIMIT 100`
      )
        .bind(c.get('userId'))
        .all<FoodRow>();
  return c.json(result.results.map(mapFood));
});

function parseFoodBody(body: Record<string, unknown>) {
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

app.post('/api/app/foods', async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch(() => null);
  const parsed = body ? parseFoodBody(body) : null;
  const id = body ? optionalText(body.id, 80) : null;
  if (!parsed || !id) return c.json(jsonError('Complete all four nutrient values.'), 400);
  const now = Date.now();
  try {
    await c.env.DB.prepare(
      `INSERT INTO foods (
        id, user_id, name, serving_mode, unit_label, default_amount,
        calories, carbs_g, protein_g, fibre_g, favourite, food_kind, is_packaged, labels_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id,
        c.get('userId'),
        parsed.name,
        parsed.servingMode,
        parsed.unitLabel,
        parsed.defaultAmount,
        parsed.calories,
        parsed.carbsG,
        parsed.proteinG,
        parsed.fibreG,
        parsed.favourite,
        parsed.isPackaged ? 'packaged' : 'prepared',
        parsed.isPackaged ? 1 : 0,
        JSON.stringify(parsed.labels),
        now,
        now
      )
      .run();
  } catch (error) {
    console.error(JSON.stringify({ event: 'food_create_failed', message: String(error) }));
    return c.json(
      jsonError('A food with that name already exists. Edit the existing food instead.'),
      409
    );
  }
  const row = await c.env.DB.prepare('SELECT * FROM foods WHERE id = ? AND user_id = ?')
    .bind(id, c.get('userId'))
    .first<FoodRow>();
  if (!row) return c.json({ message: 'The saved food could not be read back.' }, 500);
  return c.json(mapFood(row), 201);
});

app.put('/api/app/foods/:id', async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch(() => null);
  const parsed = body ? parseFoodBody(body) : null;
  if (!parsed) return c.json(jsonError('Complete all four nutrient values.'), 400);
  const result = await c.env.DB.prepare(
    `UPDATE foods SET name = ?, serving_mode = ?, unit_label = ?, default_amount = ?,
      calories = ?, carbs_g = ?, protein_g = ?, fibre_g = ?, favourite = ?, food_kind = ?, is_packaged = ?, labels_json = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`
  )
    .bind(
      parsed.name,
      parsed.servingMode,
      parsed.unitLabel,
      parsed.defaultAmount,
      parsed.calories,
      parsed.carbsG,
      parsed.proteinG,
      parsed.fibreG,
      parsed.favourite,
      parsed.isPackaged ? 'packaged' : 'prepared',
      parsed.isPackaged ? 1 : 0,
      JSON.stringify(parsed.labels),
      Date.now(),
      c.req.param('id'),
      c.get('userId')
    )
    .run();
  if (!result.meta.changes) return c.json({ message: 'Food not found.' }, 404);
  const row = await c.env.DB.prepare('SELECT * FROM foods WHERE id = ? AND user_id = ?')
    .bind(c.req.param('id'), c.get('userId'))
    .first<FoodRow>();
  if (!row) return c.json({ message: 'The saved food could not be read back.' }, 500);
  return c.json(mapFood(row));
});

app.patch('/api/app/foods/:id', async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch(() => null);
  if (!body || !('archivedAt' in body)) {
    return c.json(jsonError('Choose whether this food is active or archived.'), 400);
  }
  const archivedAt = body.archivedAt === null ? null : validTimestamp(body.archivedAt);
  if (body.archivedAt !== null && archivedAt === null) {
    return c.json(jsonError('Choose a valid archive time.'), 400);
  }
  const result = await c.env.DB.prepare(
    'UPDATE foods SET archived_at = ?, updated_at = ? WHERE id = ? AND user_id = ?'
  )
    .bind(archivedAt, Date.now(), c.req.param('id'), c.get('userId'))
    .run();
  if (!result.meta.changes) return c.json({ message: 'Food not found.' }, 404);
  const row = await c.env.DB.prepare('SELECT * FROM foods WHERE id = ? AND user_id = ?')
    .bind(c.req.param('id'), c.get('userId'))
    .first<FoodRow>();
  if (!row) return c.json({ message: 'The saved food could not be read back.' }, 500);
  return c.json(mapFood(row));
});

app.delete('/api/app/foods/:id', async (c) => {
  const result = await c.env.DB.prepare('DELETE FROM foods WHERE id = ? AND user_id = ?')
    .bind(c.req.param('id'), c.get('userId'))
    .run();
  return result.meta.changes ? c.body(null, 204) : c.json({ message: 'Food not found.' }, 404);
});

app.post('/api/app/entries', async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch(() => null);
  const id = body ? optionalText(body.id, 80) : null;
  const foodId = body ? optionalText(body.foodId, 80) : null;
  const amount = body ? finiteNumber(body.amount, 0.01, 10000) : null;
  const eatenAt = body ? validTimestamp(body.eatenAt) : null;
  if (!body || !id || amount === null || eatenAt === null) {
    return c.json(jsonError('Add a valid amount and time.'), 400);
  }
  let entry: FoodEntry;
  let foodUpdate: D1PreparedStatement | null = null;
  const now = Date.now();

  if (foodId) {
    const foodRow = await c.env.DB.prepare(
      'SELECT * FROM foods WHERE id = ? AND user_id = ? AND archived_at IS NULL'
    )
      .bind(foodId, c.get('userId'))
      .first<FoodRow>();
    if (!foodRow) return c.json({ message: 'Food not found.' }, 404);
    const food = mapFood(foodRow);
    entry = {
      id,
      foodId: food.id,
      foodName: food.name,
      amount,
      unitLabel: food.servingMode === 'per_100g' ? 'g' : food.unitLabel,
      ...scaleNutrients(food, food.servingMode, amount),
      eatenAt,
      isPackaged: food.isPackaged,
      labels: food.labels,
    };
    foodUpdate = c.env.DB.prepare(
      'UPDATE foods SET last_used_at = ?, updated_at = ? WHERE id = ? AND user_id = ?'
    ).bind(eatenAt, now, food.id, c.get('userId'));
  } else {
    const directEntry = directEntryFromBody(body, id, amount, eatenAt);
    if (!directEntry) {
      return c.json(jsonError('Add a name, unit, and valid nutrient totals.'), 400);
    }
    entry = directEntry;
  }

  const insert = c.env.DB.prepare(
    `INSERT OR IGNORE INTO food_entries (
      id, user_id, food_id, food_name, amount, unit_label, calories,
      carbs_g, protein_g, fibre_g, food_kind, is_packaged, labels_json, eaten_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    entry.id,
    c.get('userId'),
    entry.foodId,
    entry.foodName,
    entry.amount,
    entry.unitLabel,
    entry.calories,
    entry.carbsG,
    entry.proteinG,
    entry.fibreG,
    entry.isPackaged ? 'packaged' : 'prepared',
    entry.isPackaged ? 1 : 0,
    JSON.stringify(normalizeFoodLabels(entry.labels)),
    entry.eatenAt,
    now
  );
  if (foodUpdate) await c.env.DB.batch([insert, foodUpdate]);
  else await insert.run();

  const row = await c.env.DB.prepare('SELECT * FROM food_entries WHERE id = ? AND user_id = ?')
    .bind(id, c.get('userId'))
    .first<FoodEntryRow>();
  if (!row) return c.json({ message: 'The food entry could not be read back.' }, 500);
  return c.json(mapFoodEntry(row), 201);
});

app.patch('/api/app/entries/:id', async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch(() => null);
  if (!body) return c.json(jsonError('Send an entry to update.'), 400);
  const foodId = optionalText(body.foodId, 80);
  const amount = finiteNumber(body.amount, 0.01, 10_000);
  const eatenAt = validTimestamp(body.eatenAt);
  if (amount === null || eatenAt === null) {
    return c.json(jsonError('Add a valid amount and time.'), 400);
  }

  let entry: FoodEntry;
  if (foodId) {
    const foodRow = await c.env.DB.prepare(
      'SELECT * FROM foods WHERE id = ? AND user_id = ? AND archived_at IS NULL'
    )
      .bind(foodId, c.get('userId'))
      .first<FoodRow>();
    if (!foodRow) return c.json({ message: 'Saved food not found.' }, 404);
    const food = mapFood(foodRow);
    entry = {
      id: c.req.param('id'),
      foodId: food.id,
      foodName: food.name,
      amount,
      unitLabel: food.servingMode === 'per_100g' ? 'g' : food.unitLabel,
      ...scaleNutrients(food, food.servingMode, amount),
      eatenAt,
      isPackaged: food.isPackaged,
      labels: food.labels,
    };
  } else {
    const directEntry = directEntryFromBody(body, c.req.param('id'), amount, eatenAt);
    if (!directEntry) {
      return c.json(jsonError('Add a name, unit, and valid nutrient totals.'), 400);
    }
    entry = directEntry;
  }

  const result = await c.env.DB.prepare(
    `UPDATE food_entries SET food_id = ?, food_name = ?, amount = ?, unit_label = ?,
      calories = ?, carbs_g = ?, protein_g = ?, fibre_g = ?, food_kind = ?, is_packaged = ?, labels_json = ?, eaten_at = ?
     WHERE id = ? AND user_id = ?`
  )
    .bind(
      entry.foodId,
      entry.foodName,
      entry.amount,
      entry.unitLabel,
      entry.calories,
      entry.carbsG,
      entry.proteinG,
      entry.fibreG,
      entry.isPackaged ? 'packaged' : 'prepared',
      entry.isPackaged ? 1 : 0,
      JSON.stringify(normalizeFoodLabels(entry.labels)),
      entry.eatenAt,
      entry.id,
      c.get('userId')
    )
    .run();
  if (!result.meta.changes) return c.json({ message: 'Food entry not found.' }, 404);

  const row = await c.env.DB.prepare('SELECT * FROM food_entries WHERE id = ? AND user_id = ?')
    .bind(c.req.param('id'), c.get('userId'))
    .first<FoodEntryRow>();
  if (!row) return c.json({ message: 'The food entry could not be read back.' }, 500);
  return c.json(mapFoodEntry(row));
});

app.delete('/api/app/entries/:id', async (c) => {
  const result = await c.env.DB.prepare('DELETE FROM food_entries WHERE id = ? AND user_id = ?')
    .bind(c.req.param('id'), c.get('userId'))
    .run();
  return result.meta.changes ? c.body(null, 204) : c.json({ message: 'Entry not found.' }, 404);
});

app.post('/api/app/water', async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch(() => null);
  const id = body ? optionalText(body.id, 80) : null;
  const amountMl = body ? finiteNumber(body.amountMl, 1, 5000) : null;
  const drankAt = body ? validTimestamp(body.drankAt) : null;
  if (!id || amountMl === null || drankAt === null) {
    return c.json(jsonError('Choose a water amount and time.'), 400);
  }
  await c.env.DB.prepare(
    `INSERT OR IGNORE INTO water_entries
      (id, user_id, amount_ml, drank_at, created_at) VALUES (?, ?, ?, ?, ?)`
  )
    .bind(id, c.get('userId'), Math.round(amountMl), drankAt, Date.now())
    .run();
  const row = await c.env.DB.prepare(
    'SELECT id, amount_ml, drank_at FROM water_entries WHERE id = ? AND user_id = ?'
  )
    .bind(id, c.get('userId'))
    .first<WaterRow>();
  if (!row) return c.json({ message: 'The water entry could not be read back.' }, 500);
  return c.json(mapWater(row), 201);
});

app.patch('/api/app/water/:id', async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch(() => null);
  const amountMl = body ? finiteNumber(body.amountMl, 1, 5000) : null;
  const drankAt = body ? validTimestamp(body.drankAt) : null;
  if (amountMl === null || drankAt === null) {
    return c.json(jsonError('Choose a water amount and time.'), 400);
  }
  const result = await c.env.DB.prepare(
    'UPDATE water_entries SET amount_ml = ?, drank_at = ? WHERE id = ? AND user_id = ?'
  )
    .bind(Math.round(amountMl), drankAt, c.req.param('id'), c.get('userId'))
    .run();
  if (!result.meta.changes) return c.json({ message: 'Water entry not found.' }, 404);
  const row = await c.env.DB.prepare(
    'SELECT id, amount_ml, drank_at FROM water_entries WHERE id = ? AND user_id = ?'
  )
    .bind(c.req.param('id'), c.get('userId'))
    .first<WaterRow>();
  if (!row) return c.json({ message: 'The water entry could not be read back.' }, 500);
  return c.json(mapWater(row));
});

app.delete('/api/app/water/:id', async (c) => {
  const result = await c.env.DB.prepare('DELETE FROM water_entries WHERE id = ? AND user_id = ?')
    .bind(c.req.param('id'), c.get('userId'))
    .run();
  return result.meta.changes
    ? c.body(null, 204)
    : c.json({ message: 'Water entry not found.' }, 404);
});

app.post('/api/app/medications', async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch(() => null);
  const id = body ? optionalText(body.id, 80) : null;
  const name = body ? requiredText(body.name, 80) : null;
  const schedule =
    body && ['morning', 'evening', 'either'].includes(String(body.schedule))
      ? (body.schedule as MedicationSchedule)
      : null;
  const createdAt = body ? validTimestamp(body.createdAt) : null;
  if (!id || !name || !schedule || createdAt === null) {
    return c.json(jsonError('Add a medication name and when you take it.'), 400);
  }
  const now = Date.now();
  await c.env.DB.prepare(
    `INSERT OR IGNORE INTO medications
      (id, user_id, name, schedule, created_at, updated_at, archived_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL)`
  )
    .bind(id, c.get('userId'), name, schedule, createdAt, now)
    .run();
  const row = await c.env.DB.prepare(
    `SELECT id, name, schedule, created_at, archived_at
     FROM medications WHERE id = ? AND user_id = ?`
  )
    .bind(id, c.get('userId'))
    .first<MedicationRow>();
  if (!row) return c.json({ message: 'The medication could not be read back.' }, 500);
  return c.json(mapMedication(row), 201);
});

app.patch('/api/app/medications/:id', async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch(() => null);
  const name = body ? requiredText(body.name, 80) : null;
  const schedule =
    body && ['morning', 'evening', 'either'].includes(String(body.schedule))
      ? (body.schedule as MedicationSchedule)
      : null;
  const archivedAt =
    body?.archivedAt === null
      ? null
      : body?.archivedAt === undefined
        ? undefined
        : validTimestamp(body.archivedAt);
  const hasInvalidArchivedAt =
    body?.archivedAt !== null && body?.archivedAt !== undefined && archivedAt === null;
  if (!body || !name || !schedule || archivedAt === undefined || hasInvalidArchivedAt) {
    return c.json(jsonError('Add a medication name and when you take it.'), 400);
  }
  const result = await c.env.DB.prepare(
    `UPDATE medications SET name = ?, schedule = ?, archived_at = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`
  )
    .bind(name, schedule, archivedAt, Date.now(), c.req.param('id'), c.get('userId'))
    .run();
  if (!result.meta.changes) return c.json({ message: 'Medication not found.' }, 404);
  const row = await c.env.DB.prepare(
    `SELECT id, name, schedule, created_at, archived_at
     FROM medications WHERE id = ? AND user_id = ?`
  )
    .bind(c.req.param('id'), c.get('userId'))
    .first<MedicationRow>();
  if (!row) return c.json({ message: 'The medication could not be read back.' }, 500);
  return c.json(mapMedication(row));
});

app.post('/api/app/medication-check-ins', async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch(() => null);
  const id = body ? optionalText(body.id, 80) : null;
  const medicationId = body ? optionalText(body.medicationId, 80) : null;
  const takenOn =
    body && typeof body.takenOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.takenOn)
      ? body.takenOn
      : null;
  const takenAt = body ? validTimestamp(body.takenAt) : null;
  if (!id || !medicationId || !takenOn || takenAt === null) {
    return c.json(jsonError('Choose a medication and valid day.'), 400);
  }
  const medication = await c.env.DB.prepare(
    'SELECT id FROM medications WHERE id = ? AND user_id = ? AND archived_at IS NULL'
  )
    .bind(medicationId, c.get('userId'))
    .first<{ id: string }>();
  if (!medication) return c.json({ message: 'Medication not found.' }, 404);
  await c.env.DB.prepare(
    `INSERT OR IGNORE INTO medication_check_ins
      (id, user_id, medication_id, taken_on, taken_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(id, c.get('userId'), medicationId, takenOn, takenAt, Date.now())
    .run();
  const row = await c.env.DB.prepare(
    `SELECT id, medication_id, taken_on, taken_at FROM medication_check_ins
     WHERE user_id = ? AND medication_id = ? AND taken_on = ?`
  )
    .bind(c.get('userId'), medicationId, takenOn)
    .first<MedicationCheckInRow>();
  if (!row) return c.json({ message: 'The medication check-off could not be read back.' }, 500);
  return c.json(mapMedicationCheckIn(row), 201);
});

app.delete('/api/app/medication-check-ins/:id', async (c) => {
  const result = await c.env.DB.prepare(
    'DELETE FROM medication_check_ins WHERE id = ? AND user_id = ?'
  )
    .bind(c.req.param('id'), c.get('userId'))
    .run();
  return result.meta.changes
    ? c.body(null, 204)
    : c.json({ message: 'Medication check-off not found.' }, 404);
});

app.post('/api/app/weights', async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch(() => null);
  const id = body ? optionalText(body.id, 80) : null;
  const weightKg = body ? finiteNumber(body.weightKg, 30, 400) : null;
  const recordedAt = body ? validTimestamp(body.recordedAt) : null;
  if (!id || weightKg === null || recordedAt === null) {
    return c.json(jsonError('Enter a valid weight and date.'), 400);
  }
  await c.env.DB.prepare(
    `INSERT OR IGNORE INTO weight_entries
      (id, user_id, weight_kg, recorded_at, created_at) VALUES (?, ?, ?, ?, ?)`
  )
    .bind(id, c.get('userId'), weightKg, recordedAt, Date.now())
    .run();
  const row = await c.env.DB.prepare(
    'SELECT id, weight_kg, recorded_at FROM weight_entries WHERE id = ? AND user_id = ?'
  )
    .bind(id, c.get('userId'))
    .first<WeightRow>();
  if (!row) return c.json({ message: 'The weight entry could not be read back.' }, 500);
  return c.json(mapWeight(row), 201);
});

app.patch('/api/app/weights/:id', async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch(() => null);
  const weightKg = body ? finiteNumber(body.weightKg, 30, 400) : null;
  const recordedAt = body ? validTimestamp(body.recordedAt) : null;
  if (weightKg === null || recordedAt === null) {
    return c.json(jsonError('Enter a valid weight and date.'), 400);
  }
  const result = await c.env.DB.prepare(
    'UPDATE weight_entries SET weight_kg = ?, recorded_at = ? WHERE id = ? AND user_id = ?'
  )
    .bind(weightKg, recordedAt, c.req.param('id'), c.get('userId'))
    .run();
  if (!result.meta.changes) return c.json({ message: 'Weight entry not found.' }, 404);
  const row = await c.env.DB.prepare(
    'SELECT id, weight_kg, recorded_at FROM weight_entries WHERE id = ? AND user_id = ?'
  )
    .bind(c.req.param('id'), c.get('userId'))
    .first<WeightRow>();
  if (!row) return c.json({ message: 'The weight entry could not be read back.' }, 500);
  return c.json(mapWeight(row));
});

app.delete('/api/app/weights/:id', async (c) => {
  const result = await c.env.DB.prepare('DELETE FROM weight_entries WHERE id = ? AND user_id = ?')
    .bind(c.req.param('id'), c.get('userId'))
    .run();
  return result.meta.changes
    ? c.body(null, 204)
    : c.json({ message: 'Weight entry not found.' }, 404);
});

app.get('/api/app/export', async (c) => {
  const userId = c.get('userId');
  const [profile, foods, entries, water, medications, checkIns, weights, cycles] =
    await Promise.all([
      readProfile(c.env.DB, userId, c.get('userName')),
      c.env.DB.prepare('SELECT * FROM foods WHERE user_id = ? ORDER BY created_at ASC')
        .bind(userId)
        .all<FoodRow>(),
      c.env.DB.prepare('SELECT * FROM food_entries WHERE user_id = ? ORDER BY eaten_at ASC')
        .bind(userId)
        .all<FoodEntryRow>(),
      c.env.DB.prepare(
        'SELECT id, amount_ml, drank_at FROM water_entries WHERE user_id = ? ORDER BY drank_at ASC'
      )
        .bind(userId)
        .all<WaterRow>(),
      c.env.DB.prepare(
        'SELECT id, name, schedule, created_at, archived_at FROM medications WHERE user_id = ? ORDER BY created_at ASC'
      )
        .bind(userId)
        .all<MedicationRow>(),
      c.env.DB.prepare(
        'SELECT id, medication_id, taken_on, taken_at FROM medication_check_ins WHERE user_id = ? ORDER BY taken_at ASC'
      )
        .bind(userId)
        .all<MedicationCheckInRow>(),
      c.env.DB.prepare(
        'SELECT id, weight_kg, recorded_at FROM weight_entries WHERE user_id = ? ORDER BY recorded_at ASC'
      )
        .bind(userId)
        .all<WeightRow>(),
      c.env.DB.prepare('SELECT * FROM goal_cycles WHERE user_id = ? ORDER BY start_on ASC')
        .bind(userId)
        .all<GoalCycleRow>(),
    ]);
  return c.json(
    createJournalExport({
      profile,
      foods: foods.results.map(mapFood),
      entries: entries.results.map(mapFoodEntry),
      waterEntries: water.results.map(mapWater),
      medications: medications.results.map(mapMedication),
      medicationCheckIns: checkIns.results.map(mapMedicationCheckIn),
      weights: weights.results.map(mapWeight),
      cycleSessions: cycles.results.map(mapGoalCycle),
    })
  );
});

function parseRange(c: {
  req: { query: (name: string) => string | undefined };
}): { start: number; end: number } | null {
  const start = finiteNumber(c.req.query('start'), 0, Date.now() + 24 * 60 * 60 * 1000);
  const end = finiteNumber(c.req.query('end'), 0, Date.now() + 48 * 60 * 60 * 1000);
  if (start === null || end === null || end <= start || end - start > 366 * 24 * 60 * 60 * 1000) {
    return null;
  }
  return { start, end };
}

app.get('/api/app/dashboard', async (c) => {
  const range = parseRange(c);
  if (!range || range.end - range.start > 48 * 60 * 60 * 1000) {
    return c.json(jsonError('Choose a valid local-day range.'), 400);
  }
  const userId = c.get('userId');
  const [
    profile,
    foodsResult,
    entriesResult,
    waterResult,
    medicationResult,
    medicationCheckInResult,
    latestWeightRow,
    fastingRows,
  ] = await Promise.all([
    readProfile(c.env.DB, userId, c.get('userName')),
    c.env.DB.prepare(
      `SELECT * FROM foods WHERE user_id = ? AND archived_at IS NULL
         ORDER BY last_used_at DESC, name ASC LIMIT 20`
    )
      .bind(userId)
      .all<FoodRow>(),
    c.env.DB.prepare(
      `SELECT * FROM food_entries
         WHERE user_id = ? AND eaten_at >= ? AND eaten_at < ?
         ORDER BY eaten_at DESC`
    )
      .bind(userId, range.start, range.end)
      .all<FoodEntryRow>(),
    c.env.DB.prepare(
      `SELECT id, amount_ml, drank_at FROM water_entries
         WHERE user_id = ? AND drank_at >= ? AND drank_at < ?
         ORDER BY drank_at DESC`
    )
      .bind(userId, range.start, range.end)
      .all<WaterRow>(),
    c.env.DB.prepare(
      `SELECT id, name, schedule, created_at, archived_at FROM medications
         WHERE user_id = ? AND archived_at IS NULL
         ORDER BY created_at ASC`
    )
      .bind(userId)
      .all<MedicationRow>(),
    c.env.DB.prepare(
      `SELECT id, medication_id, taken_on, taken_at FROM medication_check_ins
         WHERE user_id = ? AND taken_on = ? ORDER BY taken_at DESC`
    )
      .bind(userId, c.req.query('date') ?? '')
      .all<MedicationCheckInRow>(),
    c.env.DB.prepare(
      `SELECT id, weight_kg, recorded_at FROM weight_entries
         WHERE user_id = ? ORDER BY recorded_at DESC LIMIT 1`
    )
      .bind(userId)
      .first<WeightRow>(),
    c.env.DB.prepare(
      `SELECT id, food_id, food_name, amount, unit_label, calories, carbs_g,
          protein_g, fibre_g, eaten_at
         FROM food_entries WHERE user_id = ? AND eaten_at >= ?
         ORDER BY eaten_at ASC`
    )
      .bind(userId, range.start - 31 * 24 * 60 * 60 * 1000)
      .all<FoodEntryRow>(),
  ]);

  const foods: Food[] = foodsResult.results.map(mapFood);
  const entries: FoodEntry[] = entriesResult.results.map(mapFoodEntry);
  const waterEntries: WaterEntry[] = waterResult.results.map(mapWater);
  const medications: Medication[] = medicationResult.results.map(mapMedication);
  const medicationCheckIns: MedicationCheckIn[] =
    medicationCheckInResult.results.map(mapMedicationCheckIn);
  const totals = entries.reduce(
    (sum, entry) => ({
      calories: sum.calories + entry.calories,
      carbsG: sum.carbsG + entry.carbsG,
      proteinG: sum.proteinG + entry.proteinG,
      fibreG: sum.fibreG + entry.fibreG,
      waterMl: sum.waterMl,
    }),
    {
      calories: 0,
      carbsG: 0,
      proteinG: 0,
      fibreG: 0,
      waterMl: waterEntries.reduce((sum, entry) => sum + entry.amountMl, 0),
    }
  );
  const latestWeight = latestWeightRow ? mapWeight(latestWeightRow) : null;
  const timezone = c.req.query('timezone') ?? 'UTC';
  const target = calculateNutritionTarget({
    weightKg: latestWeight?.weightKg ?? null,
    heightCm: profile.heightCm,
    ageYears: profile.ageYears,
    equationProfile: profile.equationProfile,
    activityLevel: profile.activityLevel,
    goal: profile.goal,
    manualCalorieTarget: profile.manualCalorieTarget,
    manualCalorieRange: profile.manualCalorieRange,
  });

  const dashboard: Dashboard = {
    profile,
    foods,
    entries,
    waterEntries,
    medications,
    medicationCheckIns,
    latestWeight,
    totals: {
      calories: round(totals.calories),
      carbsG: round(totals.carbsG, 1),
      proteinG: round(totals.proteinG, 1),
      fibreG: round(totals.fibreG, 1),
      waterMl: totals.waterMl,
    },
    target,
    completedFasts: calculateCompletedFasts(fastingRows.results.map(mapFoodEntry), timezone),
    date: c.req.query('date') ?? '',
    timezone,
  };
  return conditionalJson(c, dashboard);
});

function dateKey(timestamp: number, timezone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(timestamp);
}

app.get('/api/app/history', async (c) => {
  const range = parseRange(c);
  const requestedDays = Number(c.req.query('days'));
  const rangeDays = requestedDays === 30 ? 30 : requestedDays === 7 ? 7 : undefined;
  const timezone = c.req.query('timezone') || 'UTC';
  if (!range || range.end - range.start > 366 * 24 * 60 * 60 * 1000) {
    return c.json(jsonError('Choose a history range of one year or less.'), 400);
  }
  const userId = c.get('userId');
  const [profile, entriesResult, waterResult, weightResult, priorEntry] = await Promise.all([
    readProfile(c.env.DB, userId, c.get('userName')),
    c.env.DB.prepare(
      `SELECT * FROM food_entries
       WHERE user_id = ? AND eaten_at >= ? AND eaten_at < ? ORDER BY eaten_at ASC`
    )
      .bind(userId, range.start, range.end)
      .all<FoodEntryRow>(),
    c.env.DB.prepare(
      `SELECT id, amount_ml, drank_at FROM water_entries
       WHERE user_id = ? AND drank_at >= ? AND drank_at < ? ORDER BY drank_at ASC`
    )
      .bind(userId, range.start, range.end)
      .all<WaterRow>(),
    c.env.DB.prepare(
      `SELECT id, weight_kg, recorded_at FROM weight_entries
       WHERE user_id = ? AND recorded_at >= ? AND recorded_at < ? ORDER BY recorded_at ASC`
    )
      .bind(userId, range.start, range.end)
      .all<WeightRow>(),
    c.env.DB.prepare(
      `SELECT * FROM food_entries
       WHERE user_id = ? AND eaten_at < ? ORDER BY eaten_at DESC LIMIT 1`
    )
      .bind(userId, range.start)
      .first<FoodEntryRow>(),
  ]);
  const entries = entriesResult.results.map(mapFoodEntry);
  const water = waterResult.results.map(mapWater);
  const dayMap = new Map<string, HistoryDay>();
  const ensureDay = (key: string) => {
    const existing = dayMap.get(key);
    if (existing) return existing;
    const created: HistoryDay = {
      date: key,
      calories: 0,
      carbsG: 0,
      proteinG: 0,
      fibreG: 0,
      waterMl: 0,
      fastCount: 0,
    };
    dayMap.set(key, created);
    return created;
  };

  if (rangeDays) {
    for (let index = 0; index < rangeDays; index += 1) {
      ensureDay(dateKey(range.start + index * 24 * 60 * 60 * 1000, timezone));
    }
  }
  for (const entry of entries) {
    const day = ensureDay(dateKey(entry.eatenAt, timezone));
    day.calories += entry.calories;
    day.carbsG += entry.carbsG;
    day.proteinG += entry.proteinG;
    day.fibreG += entry.fibreG;
  }
  for (const entry of water) {
    ensureDay(dateKey(entry.drankAt, timezone)).waterMl += entry.amountMl;
  }
  const fastingEntries = priorEntry ? [mapFoodEntry(priorEntry), ...entries] : entries;
  const fastingThreshold = profile.fastingThresholdHours;
  for (const fast of calculateCompletedFasts(fastingEntries, timezone)) {
    if (
      fast.endAt >= range.start &&
      fast.endAt < range.end &&
      fast.durationHours >= fastingThreshold
    ) {
      ensureDay(dateKey(fast.endAt, timezone)).fastCount += 1;
    }
  }
  const days = [...dayMap.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((day) => ({
      ...day,
      calories: round(day.calories),
      carbsG: round(day.carbsG, 1),
      proteinG: round(day.proteinG, 1),
      fibreG: round(day.fibreG, 1),
    }));

  const response: HistoryResponse = {
    days,
    weights: weightResult.results.map(mapWeight),
    entries,
    ...(rangeDays ? { rangeDays } : {}),
  };
  return conditionalJson(c, response);
});

app.notFound((c) =>
  c.json({ code: 'NOT_FOUND', message: 'That Calorie route does not exist.' }, 404)
);

app.onError((error, c) => {
  console.error(
    JSON.stringify({
      event: 'request_failed',
      path: new URL(c.req.url).pathname,
      message: error instanceof Error ? error.message : String(error),
    })
  );
  return c.json(
    { code: 'SERVER_ERROR', message: 'Calorie could not finish that request. Try again.' },
    500
  );
});

export default app;

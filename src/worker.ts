import { Hono } from 'hono';
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
  HistoryDay,
  HistoryResponse,
  ServingMode,
  UserProfile,
  WaterEntry,
  WeightEntry,
} from './lib/types';
import { type AuthBindings, createAuth, isGoogleConfigured } from './server/auth';

type AppBindings = AuthBindings;
type AppVariables = { userId: string; userName: string };

const app = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>();

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

app.use('/api/*', async (c, next) => {
  await next();
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) c.header(name, value);
  c.header('Cache-Control', 'no-store');
});

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
    wakeTime: row.wake_time,
    sleepHours: row.sleep_hours,
    fastingThresholdHours: row.fasting_threshold_hours,
    waterTargetMl: row.water_target_ml,
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
    wakeTime: '07:00',
    sleepHours: 8,
    fastingThresholdHours: 12,
    waterTargetMl: 2000,
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
  };
}

type WaterRow = { id: string; amount_ml: number; drank_at: number };
type WeightRow = { id: string; weight_kg: number; recorded_at: number };

function mapWater(row: WaterRow): WaterEntry {
  return { id: row.id, amountMl: row.amount_ml, drankAt: row.drank_at };
}

function mapWeight(row: WeightRow): WeightEntry {
  return { id: row.id, weightKg: row.weight_kg, recordedAt: row.recorded_at };
}

app.get('/api/app/profile', async (c) => {
  const profile = await readProfile(c.env.DB, c.get('userId'), c.get('userName'));
  return c.json(profile);
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
  const sleepHours = finiteNumber(body.sleepHours, 5, 12);
  const waterTargetMl = finiteNumber(body.waterTargetMl, 250, 10000);
  const fastingThreshold = [12, 14, 16].includes(Number(body.fastingThresholdHours))
    ? Number(body.fastingThresholdHours)
    : null;
  const wakeTime =
    typeof body.wakeTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(body.wakeTime)
      ? body.wakeTime
      : null;

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
    fastingThreshold === null ||
    !wakeTime
  ) {
    return c.json(jsonError('Check the highlighted profile details and try again.'), 400);
  }

  const now = Date.now();
  const userId = c.get('userId');
  const genderIdentity = optionalText(body.genderIdentity, 40);
  const onboardingComplete = body.onboardingComplete === false ? 0 : 1;

  const statements = [
    c.env.DB.prepare(
      `INSERT INTO profiles (
        user_id, display_name, units, age_years, gender_identity, equation_profile,
        height_cm, activity_level, goal, target_weight_kg, manual_calorie_target,
        wake_time, sleep_hours, fasting_threshold_hours, water_target_ml,
        onboarding_complete, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        wake_time = excluded.wake_time,
        sleep_hours = excluded.sleep_hours,
        fasting_threshold_hours = excluded.fasting_threshold_hours,
        water_target_ml = excluded.water_target_ml,
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
      manualTarget,
      wakeTime,
      sleepHours,
      fastingThreshold,
      Math.round(waterTargetMl),
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
  await c.env.DB.batch(statements);
  return c.json(await readProfile(c.env.DB, userId, displayName));
});

app.get('/api/app/foods', async (c) => {
  const search = c.req.query('q')?.trim().slice(0, 60);
  const result = search
    ? await c.env.DB.prepare(
        `SELECT * FROM foods
         WHERE user_id = ? AND name LIKE ? ESCAPE '\\'
         ORDER BY favourite DESC, last_used_at DESC, name ASC LIMIT 50`
      )
        .bind(c.get('userId'), `%${search.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`)
        .all<FoodRow>()
    : await c.env.DB.prepare(
        `SELECT * FROM foods WHERE user_id = ?
         ORDER BY favourite DESC, last_used_at DESC, name ASC LIMIT 100`
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
        calories, carbs_g, protein_g, fibre_g, favourite, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      calories = ?, carbs_g = ?, protein_g = ?, fibre_g = ?, favourite = ?, updated_at = ?
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
  if (!id || !foodId || amount === null || eatenAt === null) {
    return c.json(jsonError('Choose a food, amount, and time.'), 400);
  }
  const foodRow = await c.env.DB.prepare('SELECT * FROM foods WHERE id = ? AND user_id = ?')
    .bind(foodId, c.get('userId'))
    .first<FoodRow>();
  if (!foodRow) return c.json({ message: 'Food not found.' }, 404);
  const food = mapFood(foodRow);
  const nutrients = scaleNutrients(food, food.servingMode, amount);
  const now = Date.now();

  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT OR IGNORE INTO food_entries (
        id, user_id, food_id, food_name, amount, unit_label, calories,
        carbs_g, protein_g, fibre_g, eaten_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      c.get('userId'),
      food.id,
      food.name,
      amount,
      food.servingMode === 'per_100g' ? 'g' : food.unitLabel,
      nutrients.calories,
      nutrients.carbsG,
      nutrients.proteinG,
      nutrients.fibreG,
      eatenAt,
      now
    ),
    c.env.DB.prepare(
      'UPDATE foods SET last_used_at = ?, updated_at = ? WHERE id = ? AND user_id = ?'
    ).bind(eatenAt, now, food.id, c.get('userId')),
  ]);
  const row = await c.env.DB.prepare('SELECT * FROM food_entries WHERE id = ? AND user_id = ?')
    .bind(id, c.get('userId'))
    .first<FoodEntryRow>();
  if (!row) return c.json({ message: 'The food entry could not be read back.' }, 500);
  return c.json(mapFoodEntry(row), 201);
});

app.patch('/api/app/entries/:id', async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch(() => null);
  if (!body) return c.json(jsonError('Send an entry to update.'), 400);
  const foodId = requiredText(body.foodId, 80);
  const amount = finiteNumber(body.amount, 0.01, 100000);
  const eatenAt = validTimestamp(body.eatenAt);
  if (!foodId || amount === null || eatenAt === null) {
    return c.json(jsonError('Choose a food, amount, and valid time.'), 400);
  }

  const foodRow = await c.env.DB.prepare('SELECT * FROM foods WHERE id = ? AND user_id = ?')
    .bind(foodId, c.get('userId'))
    .first<FoodRow>();
  if (!foodRow) return c.json({ message: 'Saved food not found.' }, 404);
  const food = mapFood(foodRow);
  const nutrients = scaleNutrients(food, food.servingMode, amount);
  const unitLabel = food.servingMode === 'per_100g' ? 'g' : food.unitLabel;
  const result = await c.env.DB.prepare(
    `UPDATE food_entries SET food_id = ?, food_name = ?, amount = ?, unit_label = ?,
      calories = ?, carbs_g = ?, protein_g = ?, fibre_g = ?, eaten_at = ?
     WHERE id = ? AND user_id = ?`
  )
    .bind(
      food.id,
      food.name,
      amount,
      unitLabel,
      nutrients.calories,
      nutrients.carbsG,
      nutrients.proteinG,
      nutrients.fibreG,
      eatenAt,
      c.req.param('id'),
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

app.delete('/api/app/water/:id', async (c) => {
  const result = await c.env.DB.prepare('DELETE FROM water_entries WHERE id = ? AND user_id = ?')
    .bind(c.req.param('id'), c.get('userId'))
    .run();
  return result.meta.changes
    ? c.body(null, 204)
    : c.json({ message: 'Water entry not found.' }, 404);
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

app.delete('/api/app/weights/:id', async (c) => {
  const result = await c.env.DB.prepare('DELETE FROM weight_entries WHERE id = ? AND user_id = ?')
    .bind(c.req.param('id'), c.get('userId'))
    .run();
  return result.meta.changes
    ? c.body(null, 204)
    : c.json({ message: 'Weight entry not found.' }, 404);
});

function parseRange(c: {
  req: { query: (name: string) => string | undefined };
}): { start: number; end: number } | null {
  const start = finiteNumber(c.req.query('start'), 0, Date.now() + 24 * 60 * 60 * 1000);
  const end = finiteNumber(c.req.query('end'), 0, Date.now() + 48 * 60 * 60 * 1000);
  if (start === null || end === null || end <= start || end - start > 31 * 24 * 60 * 60 * 1000) {
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
  const [profile, foodsResult, entriesResult, waterResult, latestWeightRow, fastingRows] =
    await Promise.all([
      readProfile(c.env.DB, userId, c.get('userName')),
      c.env.DB.prepare(
        `SELECT * FROM foods WHERE user_id = ?
         ORDER BY favourite DESC, last_used_at DESC, name ASC LIMIT 20`
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
  const target = calculateNutritionTarget({
    weightKg: latestWeight?.weightKg ?? null,
    heightCm: profile.heightCm,
    ageYears: profile.ageYears,
    equationProfile: profile.equationProfile,
    activityLevel: profile.activityLevel,
    goal: profile.goal,
    manualCalorieTarget: profile.manualCalorieTarget,
  });

  const dashboard: Dashboard = {
    profile,
    foods,
    entries,
    waterEntries,
    latestWeight,
    totals: {
      calories: round(totals.calories),
      carbsG: round(totals.carbsG, 1),
      proteinG: round(totals.proteinG, 1),
      fibreG: round(totals.fibreG, 1),
      waterMl: totals.waterMl,
    },
    target,
    completedFasts: calculateCompletedFasts(
      fastingRows.results.map(mapFoodEntry),
      profile.fastingThresholdHours
    ),
    date: c.req.query('date') ?? '',
    timezone: c.req.query('timezone') ?? 'UTC',
  };
  return c.json(dashboard);
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
  const rangeDays = Number(c.req.query('days')) === 30 ? 30 : 7;
  const timezone = c.req.query('timezone') || 'UTC';
  if (!range || range.end - range.start > 31 * 24 * 60 * 60 * 1000) {
    return c.json(jsonError('Choose a 7-day or 30-day history range.'), 400);
  }
  const userId = c.get('userId');
  const [entriesResult, waterResult, weightResult, priorEntry] = await Promise.all([
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
  const profile = await readProfile(c.env.DB, userId, c.get('userName'));
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

  for (let index = 0; index < rangeDays; index += 1) {
    ensureDay(dateKey(range.start + index * 24 * 60 * 60 * 1000, timezone));
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
  for (const fast of calculateCompletedFasts(fastingEntries, profile.fastingThresholdHours)) {
    if (fast.endAt >= range.start && fast.endAt < range.end) {
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
    rangeDays,
  };
  return c.json(response);
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

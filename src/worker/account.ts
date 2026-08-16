import {
  normalizeDailyActionHidden,
  normalizeDailyActionOrder,
} from '../lib/daily-action-preferences';
import { cycleFromGoal } from '../lib/goal-cycles';
import { createJournalExport } from '../lib/journal-export';
import { calculateNutritionTarget } from '../lib/recommendations';
import type { ActivityLevel, EquationProfile, Goal, UserProfile } from '../lib/types';
import { createReadToken, hashReadToken } from '../server/read-tokens';
import {
  cycleInsertStatement,
  currentTarget,
  type FoodEntryRow,
  type FoodRow,
  type GoalCycleRow,
  mapFood,
  mapFoodEntry,
  mapGoalCycle,
  mapMedication,
  mapMedicationCheckIn,
  mapWater,
  mapWeight,
  type MedicationCheckInRow,
  type MedicationRow,
  readProfile,
  type WaterRow,
  type WeightRow,
} from './db';
import {
  conditionalJson,
  dateKey,
  finiteNumber,
  jsonError,
  optionalText,
  requiredText,
  validDateKey,
} from './http';
import type { App } from './types';

type ReadTokenRow = {
  id: string;
  name: string;
  token_hint: string;
  created_at: number;
};

export function registerAccountRoutes(app: App) {
  app.get('/api/app/mcp-tokens', async (c) => {
    const result = await c.env.DB.prepare(
      `SELECT id, name, token_hint, created_at FROM mcp_read_tokens
       WHERE user_id = ? AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 20`
    )
      .bind(c.get('userId'))
      .all<ReadTokenRow>();
    return c.json(
      result.results.map((row) => ({
        id: row.id,
        name: row.name,
        tokenHint: row.token_hint,
        createdAt: row.created_at,
      }))
    );
  });

  app.post('/api/app/mcp-tokens', async (c) => {
    const body = await c.req
      .json<Record<string, unknown>>()
      .catch((): Record<string, unknown> => ({}));
    const name = optionalText(body.name, 50) ?? 'ChatGPT read access';
    const token = createReadToken();
    const id = crypto.randomUUID();
    const createdAt = Date.now();
    await c.env.DB.prepare(
      `INSERT INTO mcp_read_tokens
        (id, user_id, name, token_hash, token_hint, created_at, revoked_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL)`
    )
      .bind(id, c.get('userId'), name, await hashReadToken(token), token.slice(0, 24), createdAt)
      .run();
    return c.json({ id, name, token, tokenHint: token.slice(0, 24), createdAt }, 201);
  });

  app.delete('/api/app/mcp-tokens/:id', async (c) => {
    const result = await c.env.DB.prepare(
      `UPDATE mcp_read_tokens SET revoked_at = ?
       WHERE id = ? AND user_id = ? AND revoked_at IS NULL`
    )
      .bind(Date.now(), c.req.param('id'), c.get('userId'))
      .run();
    return result.meta.changes
      ? c.body(null, 204)
      : c.json({ message: 'Read token not found.' }, 404);
  });

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
    const units =
      body.units === 'imperial' ? 'imperial' : body.units === 'metric' ? 'metric' : null;
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
    const goal = ['lose_gentle', 'lose_steady', 'maintain', 'gain_gentle'].includes(
      String(body.goal)
    )
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
    const manualRangeInput = Array.isArray(body.manualCalorieRange)
      ? body.manualCalorieRange
      : null;
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
}

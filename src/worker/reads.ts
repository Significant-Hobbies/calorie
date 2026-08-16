import { calculateCompletedFasts, calculateNutritionTarget, round } from '../lib/recommendations';
import type {
  Dashboard,
  Food,
  FoodEntry,
  HistoryDay,
  HistoryResponse,
  Medication,
  MedicationCheckIn,
  WaterEntry,
} from '../lib/types';
import { DASHBOARD_FOODS_QUERY } from '../server/queries';
import {
  type FoodEntryRow,
  type FoodRow,
  type MedicationCheckInRow,
  type MedicationHistoryRow,
  type MedicationRow,
  mapFood,
  mapFoodEntry,
  mapMedication,
  mapMedicationCheckIn,
  mapWater,
  mapWeight,
  readProfile,
  type WaterRow,
  type WeightRow,
} from './db';
import { conditionalJson, dateKey, jsonError, parseRange } from './http';
import type { App, AppContext } from './types';

async function readDashboard(c: AppContext) {
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
    c.env.DB.prepare(DASHBOARD_FOODS_QUERY).bind(userId).all<FoodRow>(),
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
}

async function readHistory(c: AppContext) {
  const range = parseRange(c);
  const requestedDays = Number(c.req.query('days'));
  const rangeDays = requestedDays === 30 ? 30 : requestedDays === 7 ? 7 : undefined;
  const timezone = c.req.query('timezone') || 'UTC';
  if (!range || range.end - range.start > 366 * 24 * 60 * 60 * 1000) {
    return c.json(jsonError('Choose a history range of one year or less.'), 400);
  }
  const userId = c.get('userId');
  const [profile, entriesResult, waterResult, weightResult, medicationResult, priorEntry] =
    await Promise.all([
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
        `SELECT c.id, c.medication_id, c.taken_at, m.name AS medication_name
         FROM medication_check_ins c
         JOIN medications m ON m.id = c.medication_id AND m.user_id = c.user_id
         WHERE c.user_id = ? AND c.taken_at >= ? AND c.taken_at < ? ORDER BY c.taken_at ASC`
      )
        .bind(userId, range.start, range.end)
        .all<MedicationHistoryRow>(),
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
    medicationEvents: medicationResult.results.map((row) => ({
      id: row.id,
      medicationId: row.medication_id,
      medicationName: row.medication_name,
      takenAt: row.taken_at,
    })),
    ...(rangeDays ? { rangeDays } : {}),
  };
  return conditionalJson(c, response);
}

export function registerReadRoutes(app: App) {
  app.get('/api/app/dashboard', readDashboard);
  app.get('/api/app/history', readHistory);
}

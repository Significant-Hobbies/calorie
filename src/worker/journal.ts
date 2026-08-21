import { normalizeFoodLabels } from '../lib/food-context';
import { scaleNutrients } from '../lib/recommendations';
import type { FoodEntry, MedicationSchedule } from '../lib/types';
import {
  directEntryFromBody,
  type FoodEntryRow,
  type FoodRow,
  mapFood,
  mapFoodEntry,
  mapMedication,
  mapMedicationCheckIn,
  mapWater,
  mapWeight,
  type MedicationCheckInRow,
  type MedicationRow,
  parseFoodBody,
  type WaterRow,
  type WeightRow,
} from './db';
import { finiteNumber, jsonError, optionalText, requiredText, validTimestamp } from './http';
import type { App, AppContext } from './types';

function paramId(c: AppContext) {
  return c.req.param('id') ?? '';
}

async function getFoods(c: AppContext) {
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
}

async function postFoods(c: AppContext) {
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
}

async function putFoodsId(c: AppContext) {
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
      paramId(c),
      c.get('userId')
    )
    .run();
  if (!result.meta.changes) return c.json({ message: 'Food not found.' }, 404);
  const row = await c.env.DB.prepare('SELECT * FROM foods WHERE id = ? AND user_id = ?')
    .bind(paramId(c), c.get('userId'))
    .first<FoodRow>();
  if (!row) return c.json({ message: 'The saved food could not be read back.' }, 500);
  return c.json(mapFood(row));
}

async function patchFoodsId(c: AppContext) {
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
    .bind(archivedAt, Date.now(), paramId(c), c.get('userId'))
    .run();
  if (!result.meta.changes) return c.json({ message: 'Food not found.' }, 404);
  const row = await c.env.DB.prepare('SELECT * FROM foods WHERE id = ? AND user_id = ?')
    .bind(paramId(c), c.get('userId'))
    .first<FoodRow>();
  if (!row) return c.json({ message: 'The saved food could not be read back.' }, 500);
  return c.json(mapFood(row));
}

async function deleteFoodsId(c: AppContext) {
  const result = await c.env.DB.prepare('DELETE FROM foods WHERE id = ? AND user_id = ?')
    .bind(paramId(c), c.get('userId'))
    .run();
  return result.meta.changes ? c.body(null, 204) : c.json({ message: 'Food not found.' }, 404);
}

async function resolveEntry(
  c: AppContext,
  body: Record<string, unknown>,
  id: string,
  foodId: string | null,
  amount: number,
  eatenAt: number,
  now: number
): Promise<{ entry: FoodEntry; foodUpdate: D1PreparedStatement | null } | Response> {
  if (foodId) {
    const foodRow = await c.env.DB.prepare(
      'SELECT * FROM foods WHERE id = ? AND user_id = ? AND archived_at IS NULL'
    )
      .bind(foodId, c.get('userId'))
      .first<FoodRow>();
    if (!foodRow) return c.json({ message: 'Food not found.' }, 404);
    const food = mapFood(foodRow);
    return {
      entry: {
        id,
        foodId: food.id,
        foodName: food.name,
        amount,
        unitLabel: food.servingMode === 'per_100g' ? 'g' : food.unitLabel,
        ...scaleNutrients(food, food.servingMode, amount),
        eatenAt,
        isPackaged: food.isPackaged,
        labels: food.labels,
      },
      foodUpdate: c.env.DB.prepare(
        'UPDATE foods SET last_used_at = ?, updated_at = ? WHERE id = ? AND user_id = ?'
      ).bind(eatenAt, now, food.id, c.get('userId')),
    };
  }
  const directEntry = directEntryFromBody(body, id, amount, eatenAt);
  if (!directEntry) return c.json(jsonError('Add a name, unit, and valid nutrient totals.'), 400);
  return { entry: directEntry, foodUpdate: null };
}

export async function createEntry(c: AppContext, body: Record<string, unknown> | null) {
  const id = body ? optionalText(body.id, 80) : null;
  const foodId = body ? optionalText(body.foodId, 80) : null;
  const amount = body ? finiteNumber(body.amount, 0.01, 10000) : null;
  const eatenAt = body ? validTimestamp(body.eatenAt) : null;
  if (!body || !id || amount === null || eatenAt === null) {
    return c.json(jsonError('Add a valid amount and time.'), 400);
  }
  const now = Date.now();
  const resolved = await resolveEntry(c, body, id, foodId, amount, eatenAt, now);
  if (resolved instanceof Response) return resolved;
  const { entry, foodUpdate } = resolved;

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
}

async function postEntries(c: AppContext) {
  return createEntry(c, await c.req.json<Record<string, unknown>>().catch(() => null));
}

async function patchEntriesId(c: AppContext) {
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
      id: paramId(c),
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
    const directEntry = directEntryFromBody(body, paramId(c), amount, eatenAt);
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
    .bind(paramId(c), c.get('userId'))
    .first<FoodEntryRow>();
  if (!row) return c.json({ message: 'The food entry could not be read back.' }, 500);
  return c.json(mapFoodEntry(row));
}

async function deleteEntriesId(c: AppContext) {
  const result = await c.env.DB.prepare('DELETE FROM food_entries WHERE id = ? AND user_id = ?')
    .bind(paramId(c), c.get('userId'))
    .run();
  return result.meta.changes ? c.body(null, 204) : c.json({ message: 'Entry not found.' }, 404);
}

async function postWater(c: AppContext) {
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
}

async function patchWaterId(c: AppContext) {
  const body = await c.req.json<Record<string, unknown>>().catch(() => null);
  const amountMl = body ? finiteNumber(body.amountMl, 1, 5000) : null;
  const drankAt = body ? validTimestamp(body.drankAt) : null;
  if (amountMl === null || drankAt === null) {
    return c.json(jsonError('Choose a water amount and time.'), 400);
  }
  const result = await c.env.DB.prepare(
    'UPDATE water_entries SET amount_ml = ?, drank_at = ? WHERE id = ? AND user_id = ?'
  )
    .bind(Math.round(amountMl), drankAt, paramId(c), c.get('userId'))
    .run();
  if (!result.meta.changes) return c.json({ message: 'Water entry not found.' }, 404);
  const row = await c.env.DB.prepare(
    'SELECT id, amount_ml, drank_at FROM water_entries WHERE id = ? AND user_id = ?'
  )
    .bind(paramId(c), c.get('userId'))
    .first<WaterRow>();
  if (!row) return c.json({ message: 'The water entry could not be read back.' }, 500);
  return c.json(mapWater(row));
}

async function deleteWaterId(c: AppContext) {
  const result = await c.env.DB.prepare('DELETE FROM water_entries WHERE id = ? AND user_id = ?')
    .bind(paramId(c), c.get('userId'))
    .run();
  return result.meta.changes
    ? c.body(null, 204)
    : c.json({ message: 'Water entry not found.' }, 404);
}

async function postMedications(c: AppContext) {
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
}

function parseMedicationPatch(body: Record<string, unknown> | null) {
  if (!body) return null;
  const name = requiredText(body.name, 80);
  const schedule = ['morning', 'evening', 'either'].includes(String(body.schedule))
    ? (body.schedule as MedicationSchedule)
    : null;
  const archivedAt =
    body.archivedAt === null
      ? null
      : body.archivedAt === undefined
        ? undefined
        : validTimestamp(body.archivedAt);
  const hasInvalidArchivedAt =
    body.archivedAt !== null && body.archivedAt !== undefined && archivedAt === null;
  if (!name || !schedule || archivedAt === undefined || hasInvalidArchivedAt) return null;
  return { name, schedule, archivedAt };
}

async function patchMedicationsId(c: AppContext) {
  const body = await c.req.json<Record<string, unknown>>().catch(() => null);
  const parsed = parseMedicationPatch(body);
  if (!parsed) return c.json(jsonError('Add a medication name and when you take it.'), 400);
  const result = await c.env.DB.prepare(
    `UPDATE medications SET name = ?, schedule = ?, archived_at = ?, updated_at = ?
   WHERE id = ? AND user_id = ?`
  )
    .bind(parsed.name, parsed.schedule, parsed.archivedAt, Date.now(), paramId(c), c.get('userId'))
    .run();
  if (!result.meta.changes) return c.json({ message: 'Medication not found.' }, 404);
  const row = await c.env.DB.prepare(
    `SELECT id, name, schedule, created_at, archived_at
   FROM medications WHERE id = ? AND user_id = ?`
  )
    .bind(paramId(c), c.get('userId'))
    .first<MedicationRow>();
  if (!row) return c.json({ message: 'The medication could not be read back.' }, 500);
  return c.json(mapMedication(row));
}

async function postMedicationCheckIns(c: AppContext) {
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
}

async function deleteMedicationCheckInsId(c: AppContext) {
  const result = await c.env.DB.prepare(
    'DELETE FROM medication_check_ins WHERE id = ? AND user_id = ?'
  )
    .bind(paramId(c), c.get('userId'))
    .run();
  return result.meta.changes
    ? c.body(null, 204)
    : c.json({ message: 'Medication check-off not found.' }, 404);
}

async function postWeights(c: AppContext) {
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
}

async function patchWeightsId(c: AppContext) {
  const body = await c.req.json<Record<string, unknown>>().catch(() => null);
  const weightKg = body ? finiteNumber(body.weightKg, 30, 400) : null;
  const recordedAt = body ? validTimestamp(body.recordedAt) : null;
  if (weightKg === null || recordedAt === null) {
    return c.json(jsonError('Enter a valid weight and date.'), 400);
  }
  const result = await c.env.DB.prepare(
    'UPDATE weight_entries SET weight_kg = ?, recorded_at = ? WHERE id = ? AND user_id = ?'
  )
    .bind(weightKg, recordedAt, paramId(c), c.get('userId'))
    .run();
  if (!result.meta.changes) return c.json({ message: 'Weight entry not found.' }, 404);
  const row = await c.env.DB.prepare(
    'SELECT id, weight_kg, recorded_at FROM weight_entries WHERE id = ? AND user_id = ?'
  )
    .bind(paramId(c), c.get('userId'))
    .first<WeightRow>();
  if (!row) return c.json({ message: 'The weight entry could not be read back.' }, 500);
  return c.json(mapWeight(row));
}

async function deleteWeightsId(c: AppContext) {
  const result = await c.env.DB.prepare('DELETE FROM weight_entries WHERE id = ? AND user_id = ?')
    .bind(paramId(c), c.get('userId'))
    .run();
  return result.meta.changes
    ? c.body(null, 204)
    : c.json({ message: 'Weight entry not found.' }, 404);
}

export function registerJournalRoutes(app: App) {
  app.get('/api/app/foods', getFoods);
  app.post('/api/app/foods', postFoods);
  app.put('/api/app/foods/:id', putFoodsId);
  app.patch('/api/app/foods/:id', patchFoodsId);
  app.delete('/api/app/foods/:id', deleteFoodsId);
  app.post('/api/app/entries', postEntries);
  app.patch('/api/app/entries/:id', patchEntriesId);
  app.delete('/api/app/entries/:id', deleteEntriesId);
  app.post('/api/app/water', postWater);
  app.patch('/api/app/water/:id', patchWaterId);
  app.delete('/api/app/water/:id', deleteWaterId);
  app.post('/api/app/medications', postMedications);
  app.patch('/api/app/medications/:id', patchMedicationsId);
  app.post('/api/app/medication-check-ins', postMedicationCheckIns);
  app.delete('/api/app/medication-check-ins/:id', deleteMedicationCheckInsId);
  app.post('/api/app/weights', postWeights);
  app.patch('/api/app/weights/:id', patchWeightsId);
  app.delete('/api/app/weights/:id', deleteWeightsId);
}

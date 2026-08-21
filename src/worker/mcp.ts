import { calculateCompletedFasts, round } from '../lib/recommendations';
import {
  type FoodEntryRow,
  type FoodRow,
  type GoalCycleRow,
  mapFood,
  mapFoodEntry,
  mapGoalCycle,
  mapWater,
  type WaterRow,
} from './db';
import { dateKey, jsonError, validDateKey } from './http';
import type { App } from './types';

const MCP_DAY_MS = 24 * 60 * 60 * 1000;

export function nutritionTotals(entries: Array<ReturnType<typeof mapFoodEntry>>) {
  const totals = entries.reduce(
    (sum, entry) => ({
      calories: sum.calories + entry.calories,
      carbsG: sum.carbsG + entry.carbsG,
      proteinG: sum.proteinG + entry.proteinG,
      fibreG: sum.fibreG + entry.fibreG,
    }),
    { calories: 0, carbsG: 0, proteinG: 0, fibreG: 0 }
  );
  return {
    calories: round(totals.calories),
    carbsG: round(totals.carbsG, 1),
    proteinG: round(totals.proteinG, 1),
    fibreG: round(totals.fibreG, 1),
  };
}

function mcpLimit(value: string | undefined, fallback = 30, maximum = 90) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

function mcpOffset(value: string | undefined) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? Math.min(parsed, 10_000) : 0;
}

export function addUtcDays(date: string, amount: number) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + amount)).toISOString().slice(0, 10);
}

function timezoneOffset(timestamp: number, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(timestamp);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return (
    Date.UTC(
      value('year'),
      value('month') - 1,
      value('day'),
      value('hour'),
      value('minute'),
      value('second')
    ) - timestamp
  );
}

export function localMidnight(date: string, timezone: string): number | null {
  if (!validDateKey(date)) return null;
  const [year, month, day] = date.split('-').map(Number);
  const approximate = Date.UTC(year, month - 1, day);
  try {
    let result = approximate - timezoneOffset(approximate, timezone);
    result = approximate - timezoneOffset(result, timezone);
    return dateKey(result, timezone) === date ? result : null;
  } catch {
    return null;
  }
}

function mcpPage(c: { req: { query: (name: string) => string | undefined } }) {
  return {
    limit: mcpLimit(c.req.query('limit')),
    offset: mcpOffset(c.req.query('offset')),
  };
}

type McpTargetRow = {
  manual_calorie_target: number | null;
  manual_calorie_min: number | null;
  manual_calorie_max: number | null;
  water_target_ml: number;
  fasting_threshold_hours: 12 | 14 | 16;
};

export async function readMcpTargets(db: D1Database, userId: string) {
  const row = await db
    .prepare(
      `SELECT manual_calorie_target, manual_calorie_min, manual_calorie_max,
          water_target_ml, fasting_threshold_hours
       FROM profiles WHERE user_id = ?`
    )
    .bind(userId)
    .first<McpTargetRow>();
  const calorieRange =
    row?.manual_calorie_min !== null &&
    row?.manual_calorie_min !== undefined &&
    row.manual_calorie_max !== null
      ? ([row.manual_calorie_min, row.manual_calorie_max] as [number, number])
      : row?.manual_calorie_target
        ? ([Math.max(800, row.manual_calorie_target - 100), row.manual_calorie_target + 100] as [
            number,
            number,
          ])
        : null;
  return {
    calorieRange,
    waterMl: row?.water_target_ml ?? 2000,
    fastingThresholdHours: row?.fasting_threshold_hours ?? 12,
  };
}

export function registerMcpRoutes(app: App) {
  app.get('/api/mcp/daily', async (c) => {
    const date = validDateKey(c.req.query('date'));
    const timezone = c.req.query('timezone')?.slice(0, 80) || 'UTC';
    const start = date ? localMidnight(date, timezone) : null;
    const end = date ? localMidnight(addUtcDays(date, 1), timezone) : null;
    if (!date || start === null || end === null) {
      return c.json(jsonError('Choose a valid date and IANA timezone.'), 400);
    }
    const userId = c.get('mcpUserId');
    const [profileTargets, entriesResult, waterResult, cycle, priorEntry] = await Promise.all([
      readMcpTargets(c.env.DB, userId),
      c.env.DB.prepare(
        `SELECT * FROM food_entries
         WHERE user_id = ? AND eaten_at >= ? AND eaten_at < ?
         ORDER BY eaten_at ASC LIMIT 251`
      )
        .bind(userId, start, end)
        .all<FoodEntryRow>(),
      c.env.DB.prepare(
        `SELECT id, amount_ml, drank_at FROM water_entries
         WHERE user_id = ? AND drank_at >= ? AND drank_at < ?
         ORDER BY drank_at ASC LIMIT 251`
      )
        .bind(userId, start, end)
        .all<WaterRow>(),
      c.env.DB.prepare(
        `SELECT * FROM goal_cycles WHERE user_id = ?
         AND start_on <= ? AND (end_on IS NULL OR end_on >= ?)
         ORDER BY start_on DESC LIMIT 1`
      )
        .bind(userId, date, date)
        .first<GoalCycleRow>(),
      c.env.DB.prepare(
        `SELECT eaten_at FROM food_entries
         WHERE user_id = ? AND eaten_at < ? ORDER BY eaten_at DESC LIMIT 1`
      )
        .bind(userId, start)
        .first<{ eaten_at: number }>(),
    ]);
    const entries = entriesResult.results.slice(0, 250).map(mapFoodEntry);
    const waterEntries = waterResult.results.slice(0, 250).map(mapWater);
    const completedFasts = calculateCompletedFasts(
      [...(priorEntry ? [{ eatenAt: priorEntry.eaten_at }] : []), ...entries],
      timezone
    ).filter(
      (fast) =>
        fast.endAt >= start &&
        fast.endAt < end &&
        fast.durationHours >= profileTargets.fastingThresholdHours
    );
    return c.json({
      schemaVersion: '1',
      provenance: 'calculated-from-recorded-entries',
      date,
      timezone,
      totals: {
        ...nutritionTotals(entries),
        waterMl: waterEntries.reduce((sum, entry) => sum + entry.amountMl, 0),
      },
      targets: {
        calorieRange: cycle ? mapGoalCycle(cycle).calorieRange : profileTargets.calorieRange,
        proteinRangeG: cycle ? mapGoalCycle(cycle).proteinRangeG : null,
        waterMl: profileTargets.waterMl,
      },
      fasting: {
        thresholdHours: profileTargets.fastingThresholdHours,
        completed: completedFasts,
        provenance: 'calculated-from-recorded-entry-times',
      },
      entries,
      waterEntries,
      truncated: entriesResult.results.length > 250 || waterResult.results.length > 250,
    });
  });

  app.get('/api/mcp/history', async (c) => {
    const startDate = validDateKey(c.req.query('start'));
    const endDate = validDateKey(c.req.query('end'));
    const timezone = c.req.query('timezone')?.slice(0, 80) || 'UTC';
    if (!startDate || !endDate || startDate > endDate) {
      return c.json(jsonError('Choose a valid inclusive date range.'), 400);
    }
    const totalDays =
      Math.round(
        (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / MCP_DAY_MS
      ) + 1;
    if (totalDays < 1 || totalDays > 366) {
      return c.json(jsonError('Choose a history range of one year or less.'), 400);
    }
    const { limit, offset } = mcpPage(c);
    const pageStartDate = addUtcDays(startDate, Math.min(offset, totalDays));
    const pageDays = Math.max(0, Math.min(limit, totalDays - offset));
    const pageEndDate = addUtcDays(pageStartDate, pageDays);
    const start = localMidnight(pageStartDate, timezone);
    const end = localMidnight(pageEndDate, timezone);
    if (start === null || end === null) {
      return c.json(jsonError('Choose a valid IANA timezone.'), 400);
    }
    const userId = c.get('mcpUserId');
    const [entriesResult, waterResult] = await Promise.all([
      c.env.DB.prepare(
        `SELECT * FROM food_entries WHERE user_id = ? AND eaten_at >= ? AND eaten_at < ?
         ORDER BY eaten_at ASC LIMIT 1001`
      )
        .bind(userId, start, end)
        .all<FoodEntryRow>(),
      c.env.DB.prepare(
        `SELECT id, amount_ml, drank_at FROM water_entries
         WHERE user_id = ? AND drank_at >= ? AND drank_at < ? ORDER BY drank_at ASC LIMIT 1001`
      )
        .bind(userId, start, end)
        .all<WaterRow>(),
    ]);
    const entries = entriesResult.results.slice(0, 1000).map(mapFoodEntry);
    const waterEntries = waterResult.results.slice(0, 1000).map(mapWater);
    const days = Array.from({ length: pageDays }, (_, index) => ({
      date: addUtcDays(pageStartDate, index),
      calories: 0,
      carbsG: 0,
      proteinG: 0,
      fibreG: 0,
      waterMl: 0,
      recorded: false,
    }));
    const byDate = new Map(days.map((day) => [day.date, day]));
    for (const entry of entries) {
      const day = byDate.get(dateKey(entry.eatenAt, timezone));
      if (!day) continue;
      day.recorded = true;
      day.calories += entry.calories;
      day.carbsG += entry.carbsG;
      day.proteinG += entry.proteinG;
      day.fibreG += entry.fibreG;
    }
    for (const entry of waterEntries) {
      const day = byDate.get(dateKey(entry.drankAt, timezone));
      if (day) {
        day.recorded = true;
        day.waterMl += entry.amountMl;
      }
    }
    return c.json({
      schemaVersion: '1',
      items: days.map((day) => ({
        ...day,
        calories: round(day.calories),
        carbsG: round(day.carbsG, 1),
        proteinG: round(day.proteinG, 1),
        fibreG: round(day.fibreG, 1),
        provenance: day.recorded ? 'calculated-from-recorded-entries' : 'missing-day',
      })),
      entries,
      page: {
        limit,
        offset,
        total: totalDays,
        nextOffset: offset + pageDays < totalDays ? offset + pageDays : null,
      },
      truncated: entriesResult.results.length > 1000 || waterResult.results.length > 1000,
    });
  });

  app.get('/api/mcp/foods', async (c) => {
    const { limit, offset } = mcpPage(c);
    const search = c.req.query('q')?.trim().slice(0, 60);
    const lifecycleWhere =
      c.req.query('status') === 'archived' ? 'archived_at IS NOT NULL' : 'archived_at IS NULL';
    const escaped = search?.replaceAll('%', '\\%').replaceAll('_', '\\_');
    const where = `user_id = ? AND ${lifecycleWhere}${search ? " AND name LIKE ? ESCAPE '\\\\'" : ''}`;
    const binds = search ? [c.get('mcpUserId'), `%${escaped}%`] : [c.get('mcpUserId')];
    const [result, count] = await Promise.all([
      c.env.DB.prepare(
        `SELECT * FROM foods WHERE ${where}
         ORDER BY last_used_at DESC, name ASC LIMIT ? OFFSET ?`
      )
        .bind(...binds, limit, offset)
        .all<FoodRow>(),
      c.env.DB.prepare(`SELECT COUNT(*) AS total FROM foods WHERE ${where}`)
        .bind(...binds)
        .first<{ total: number }>(),
    ]);
    const total = count?.total ?? 0;
    return c.json({
      schemaVersion: '1',
      items: result.results.map(mapFood),
      page: { limit, offset, total, nextOffset: offset + limit < total ? offset + limit : null },
    });
  });

  app.get('/api/mcp/cycles', async (c) => {
    const { limit, offset } = mcpPage(c);
    const [result, count] = await Promise.all([
      c.env.DB.prepare(
        `SELECT * FROM goal_cycles WHERE user_id = ?
         ORDER BY start_on DESC LIMIT ? OFFSET ?`
      )
        .bind(c.get('mcpUserId'), limit, offset)
        .all<GoalCycleRow>(),
      c.env.DB.prepare('SELECT COUNT(*) AS total FROM goal_cycles WHERE user_id = ?')
        .bind(c.get('mcpUserId'))
        .first<{ total: number }>(),
    ]);
    const total = count?.total ?? 0;
    return c.json({
      schemaVersion: '1',
      items: result.results.map(mapGoalCycle),
      page: { limit, offset, total, nextOffset: offset + limit < total ? offset + limit : null },
    });
  });
}

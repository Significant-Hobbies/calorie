import { type FoodEntryRow, mapFoodEntry } from './db';
import { dateKey, jsonError, validDateKey } from './http';
import { createEntry } from './journal';
import { addUtcDays, localMidnight, nutritionTotals, readMcpTargets } from './mcp';
import type { App, AppContext } from './types';

type PersonalIdentity = { appleSubject?: unknown };
type CalorieUser = { id: string; name: string; email: string; image: string | null };

async function authenticatePersonalRequest(c: AppContext): Promise<Response | null> {
  const authorization = c.req.header('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return c.json({ code: 'UNAUTHORIZED', message: 'Sign in to continue.' }, 401);
  }
  if (!c.env.AUTH_SERVICE) {
    return c.json(
      { code: 'AUTH_SERVICE_UNAVAILABLE', message: 'Shared identity is unavailable.' },
      503
    );
  }

  const identityResponse = await c.env.AUTH_SERVICE.fetch(
    'https://personal-auth.internal/api/personal-platform/session',
    { headers: { Authorization: authorization } }
  );
  if (identityResponse.status === 401) {
    return c.json({ code: 'UNAUTHORIZED', message: 'Sign in to continue.' }, 401);
  }
  if (!identityResponse.ok) {
    return c.json(
      { code: 'AUTH_SERVICE_UNAVAILABLE', message: 'Shared identity is unavailable.' },
      503
    );
  }

  const identity = (await identityResponse.json()) as PersonalIdentity;
  if (typeof identity.appleSubject !== 'string' || identity.appleSubject.length === 0) {
    return c.json(
      { code: 'APPLE_ACCOUNT_REQUIRED', message: 'Link Sign in with Apple in Calorie first.' },
      403
    );
  }

  const user = await c.env.DB.prepare(
    `SELECT u.id, u.name, u.email, u.image
     FROM account a JOIN user u ON u.id = a.userId
     WHERE a.providerId = 'apple' AND a.accountId = ? LIMIT 1`
  )
    .bind(identity.appleSubject)
    .first<CalorieUser>();
  if (!user) {
    return c.json(
      { code: 'CALORIE_ACCOUNT_NOT_FOUND', message: 'Sign in to Calorie with the same Apple ID.' },
      403
    );
  }

  c.set('userId', user.id);
  c.set('userName', user.name);
  c.set('userEmail', user.email);
  c.set('userImage', user.image);
  return null;
}

async function summary(c: AppContext) {
  const timezone = c.req.query('timezone')?.slice(0, 80) || 'UTC';
  const date = validDateKey(c.req.query('date')) ?? dateKey(Date.now(), timezone);
  const start = localMidnight(date, timezone);
  const end = localMidnight(addUtcDays(date, 1), timezone);
  if (start === null || end === null) {
    return c.json(jsonError('Choose a valid date and IANA timezone.'), 400);
  }

  const userId = c.get('userId');
  const [targets, entriesResult] = await Promise.all([
    readMcpTargets(c.env.DB, userId),
    c.env.DB.prepare(
      `SELECT * FROM food_entries
       WHERE user_id = ? AND eaten_at >= ? AND eaten_at < ? ORDER BY eaten_at ASC LIMIT 251`
    )
      .bind(userId, start, end)
      .all<FoodEntryRow>(),
  ]);
  const entries = entriesResult.results.slice(0, 250).map(mapFoodEntry);
  const latestEntry = entries.at(-1);
  return c.json({
    date,
    timezone,
    totals: nutritionTotals(entries),
    targets: { calorieRange: targets.calorieRange, waterMl: targets.waterMl },
    entryCount: entries.length,
    lastUpdatedAt: latestEntry ? new Date(latestEntry.eatenAt).toISOString() : null,
    truncated: entriesResult.results.length > 250,
  });
}

async function logFood(c: AppContext) {
  const body = await c.req.json<Record<string, unknown>>().catch(() => null);
  const input = body?.input;
  if (!body || !input || typeof input !== 'object' || Array.isArray(input)) {
    return c.json(jsonError('Send a typed food entry.'), 400);
  }
  const idempotencyKey =
    typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim().slice(0, 74) : '';
  if (!idempotencyKey) return c.json(jsonError('Send an idempotency key.'), 400);
  const typedInput = input as Record<string, unknown>;
  const entry = {
    ...typedInput,
    id: `pace-${idempotencyKey}`,
    eatenAt: typeof typedInput.eatenAt === 'number' ? typedInput.eatenAt : Date.now(),
  };
  const response = await createEntry(c, entry);
  if (!response.ok) return response;
  return c.json({ status: 'completed', record: await response.json() });
}

export function registerPersonalPlatformRoutes(app: App) {
  app.use('/v1/personal/*', async (c, next) => {
    const failure = await authenticatePersonalRequest(c);
    if (failure) return failure;
    await next();
  });
  app.get('/v1/personal/summary', summary);
  app.post('/v1/personal/actions/log_food', logFood);
}

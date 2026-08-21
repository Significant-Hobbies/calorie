import type { AppContext } from './types';

type SharedIdentity = {
  userId?: unknown;
  appleSubject?: unknown;
};

export type CalorieUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

type SharedIdentityResult =
  | { status: 'authorized'; user: CalorieUser }
  | {
      status: 'error';
      response: Response;
    };

export async function authenticateSharedIdentity(c: AppContext): Promise<SharedIdentityResult> {
  const authorization = c.req.header('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return error(c, 401, 'UNAUTHORIZED', 'Sign in to continue.');
  }
  if (!c.env.AUTH_SERVICE) {
    return error(c, 503, 'AUTH_SERVICE_UNAVAILABLE', 'Shared identity is unavailable.');
  }

  const identityResponse = await c.env.AUTH_SERVICE.fetch(
    'https://personal-auth.internal/api/personal-platform/session',
    { headers: { Authorization: authorization } }
  );
  if (identityResponse.status === 401) {
    return error(c, 401, 'UNAUTHORIZED', 'Sign in to continue.');
  }
  if (!identityResponse.ok) {
    return error(c, 503, 'AUTH_SERVICE_UNAVAILABLE', 'Shared identity is unavailable.');
  }

  const identity = (await identityResponse.json()) as SharedIdentity;
  if (typeof identity.userId !== 'string' || identity.userId.length === 0) {
    return error(c, 502, 'INVALID_IDENTITY', 'Shared identity returned no user ID.');
  }

  const existing = await findByPersonalUserId(c.env.DB, identity.userId);
  if (existing) return { status: 'authorized', user: existing };

  if (typeof identity.appleSubject !== 'string' || identity.appleSubject.length === 0) {
    return error(
      c,
      403,
      'CALORIE_LINK_REQUIRED',
      'Link the existing Calorie account with Sign in with Apple once.'
    );
  }

  const legacy = await findByAppleSubject(c.env.DB, identity.appleSubject);
  if (!legacy) {
    return error(
      c,
      403,
      'CALORIE_ACCOUNT_NOT_FOUND',
      'Sign in to Calorie with the same Apple account once.'
    );
  }

  await c.env.DB.prepare(
    'UPDATE user SET personal_user_id = ?1, updatedAt = ?2 WHERE id = ?3 AND personal_user_id IS NULL'
  )
    .bind(identity.userId, Date.now(), legacy.id)
    .run();
  const linked = await findByPersonalUserId(c.env.DB, identity.userId);
  return { status: 'authorized', user: linked ?? legacy };
}

export function applyCalorieUser(c: AppContext, user: CalorieUser): void {
  c.set('userId', user.id);
  c.set('userName', user.name);
  c.set('userEmail', user.email);
  c.set('userImage', user.image);
}

async function findByPersonalUserId(db: D1Database, userId: string) {
  return db
    .prepare('SELECT id, name, email, image FROM user WHERE personal_user_id = ?1 LIMIT 1')
    .bind(userId)
    .first<CalorieUser>();
}

export async function findCalorieUserByPersonalId(db: D1Database, userId: string) {
  return findByPersonalUserId(db, userId);
}

async function findByAppleSubject(db: D1Database, appleSubject: string) {
  return db
    .prepare(
      `SELECT u.id, u.name, u.email, u.image
       FROM account a JOIN user u ON u.id = a.userId
       WHERE a.providerId = 'apple' AND a.accountId = ?1 LIMIT 1`
    )
    .bind(appleSubject)
    .first<CalorieUser>();
}

function error(
  c: AppContext,
  status: 401 | 403 | 502 | 503,
  code: string,
  message: string
): SharedIdentityResult {
  return { status: 'error', response: c.json({ code, message }, status) };
}

import { describe, expect, it } from 'vitest';
import app from './worker';

function database(user: { id: string } | null, initiallyLinked = false) {
  let personalUserId = initiallyLinked ? 'shared-user' : null;
  return {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          return {
            first: async () => {
              if (sql.includes('WHERE personal_user_id')) {
                return user && values[0] === personalUserId
                  ? { ...user, name: 'Owner', email: 'owner@example.com', image: null }
                  : null;
              }
              if (sql.includes('FROM account')) {
                return user && { ...user, name: 'Owner', email: 'owner@example.com', image: null };
              }
              return null;
            },
            all: async () => ({ results: [] }),
            run: async () => {
              if (sql.startsWith('UPDATE user SET personal_user_id')) {
                personalUserId = String(values[0]);
              }
              return { meta: { changes: 1 } };
            },
          };
        },
      };
    },
  } as unknown as D1Database;
}

function environment(
  identity: Response,
  user: { id: string } | null = { id: 'calorie-user' },
  initiallyLinked = false
) {
  return {
    APPLE_APP_BUNDLE_IDENTIFIER: 'com.significanthobbies.calorie',
    ASSETS: {} as Fetcher,
    AUTH_SERVICE: { fetch: async () => identity.clone() } as Fetcher,
    DB: database(user, initiallyLinked),
    GOOGLE_CLIENT_ID: 'google-client',
    GOOGLE_CLIENT_SECRET: 'google-secret',
  };
}

describe('Personal Platform connector', () => {
  it('fails closed without the shared bearer token', async () => {
    const response = await app.request(
      'https://calorie.example/v1/personal/summary',
      {},
      environment(Response.json({ appleSubject: 'apple-subject' }))
    );
    expect(response.status).toBe(401);
  });

  it('links the stable family user ID through the existing Apple account', async () => {
    const response = await app.request(
      'https://calorie.example/v1/personal/summary?date=2026-08-21&timezone=Asia%2FKolkata',
      { headers: { Authorization: 'Bearer signed-session' } },
      environment(Response.json({ userId: 'shared-user', appleSubject: 'apple-subject' }))
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      date: '2026-08-21',
      timezone: 'Asia/Kolkata',
      entryCount: 0,
    });
  });

  it('uses the stable family user ID without requiring Apple on later requests', async () => {
    const response = await app.request(
      'https://calorie.example/v1/personal/summary?date=2026-08-21&timezone=UTC',
      { headers: { Authorization: 'Bearer signed-session' } },
      environment(Response.json({ userId: 'shared-user' }), { id: 'calorie-user' }, true)
    );
    expect(response.status).toBe(200);
  });

  it('deletes only Calorie data for a shared family session', async () => {
    const response = await app.request(
      'https://calorie.example/api/app/data',
      { method: 'DELETE', headers: { Authorization: 'Bearer signed-session' } },
      environment(Response.json({ userId: 'shared-user' }), { id: 'calorie-user' }, true)
    );
    expect(response.status).toBe(204);
  });

  it('does not fall back to email when the Apple account is not linked', async () => {
    const response = await app.request(
      'https://calorie.example/v1/personal/summary',
      { headers: { Authorization: 'Bearer signed-session' } },
      environment(Response.json({ userId: 'shared-user', email: 'owner@example.com' }))
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'CALORIE_LINK_REQUIRED' });
  });
});

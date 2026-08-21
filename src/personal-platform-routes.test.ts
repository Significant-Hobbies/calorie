import { describe, expect, it } from 'vitest';
import app from './worker';

function database(user: { id: string } | null) {
  return {
    prepare(sql: string) {
      return {
        bind() {
          return {
            first: async () =>
              sql.includes('FROM account')
                ? user && { ...user, name: 'Owner', email: 'owner@example.com', image: null }
                : null,
            all: async () => ({ results: [] }),
          };
        },
      };
    },
  } as unknown as D1Database;
}

function environment(identity: Response, user: { id: string } | null = { id: 'calorie-user' }) {
  return {
    APPLE_APP_BUNDLE_IDENTIFIER: 'com.significanthobbies.calorie',
    ASSETS: {} as Fetcher,
    AUTH_SERVICE: { fetch: async () => identity.clone() } as Fetcher,
    DB: database(user),
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

  it('maps the shared Apple subject to the existing Calorie account', async () => {
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

  it('does not fall back to email when the Apple account is not linked', async () => {
    const response = await app.request(
      'https://calorie.example/v1/personal/summary',
      { headers: { Authorization: 'Bearer signed-session' } },
      environment(Response.json({ userId: 'shared-user', email: 'owner@example.com' }))
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'APPLE_ACCOUNT_REQUIRED' });
  });
});

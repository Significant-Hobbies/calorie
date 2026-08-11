import { describe, expect, it } from 'vitest';
import app from './worker';

const env = {
  APPLE_APP_BUNDLE_IDENTIFIER: 'com.significanthobbies.calorie',
  ASSETS: {} as Fetcher,
  DB: {} as D1Database,
  GOOGLE_CLIENT_ID: 'google-client',
  GOOGLE_CLIENT_SECRET: 'google-secret',
};

describe('native authentication routes', () => {
  it('rejects callbacks outside the native allowlist', async () => {
    const response = await app.request(
      'https://calorie.example/api/native/auth/google/start?callback=https%3A%2F%2Fevil.example',
      {},
      env
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'INVALID_CALLBACK' });
  });

  it('rejects malformed handoff codes before touching storage', async () => {
    const response = await app.request(
      'https://calorie.example/api/native/auth/exchange',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'short' }),
      },
      env
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'INVALID_HANDOFF' });
  });
});

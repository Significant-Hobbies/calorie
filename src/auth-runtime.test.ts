import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAuth } from './server/auth';
import app from './worker';

const fixtures: DatabaseSync[] = [];

function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  fixtures.push(sqlite);
  for (const migration of [
    '0001_initial.sql',
    '0007_native_auth_handoffs.sql',
    '0008_shared_family_identity.sql',
  ]) {
    sqlite.exec(readFileSync(new URL(`../migrations/${migration}`, import.meta.url), 'utf8'));
  }
  const now = Math.floor(Date.now() / 1000);
  sqlite
    .prepare(
      'INSERT INTO user (id, name, email, emailVerified, image, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .run('fixture-user', 'Fixture', 'fixture@example.invalid', 1, null, now, now);
  sqlite
    .prepare('INSERT INTO session VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(
      'fixture-session',
      now + 3600,
      'fixture-bearer-token',
      now,
      now,
      null,
      null,
      'fixture-user'
    );
  sqlite
    .prepare(`INSERT INTO account
    (id, accountId, providerId, userId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('fixture-account', 'fixture-google-subject', 'google', 'fixture-user', now, now);
  function prepare(sql: string, values: unknown[] = []) {
    return {
      bind: (...bound: unknown[]) => prepare(sql, bound),
      first: async () => sqlite.prepare(sql).get(...values) ?? null,
      all: async () => ({ results: sqlite.prepare(sql).all(...values) }),
      raw: async () => {
        const statement = sqlite.prepare(sql);
        statement.setReturnArrays(true);
        return statement.all(...values);
      },
      run: async () => ({ meta: { changes: Number(sqlite.prepare(sql).run(...values).changes) } }),
    };
  }
  const env = {
    DB: { prepare } as unknown as D1Database,
    ASSETS: {} as Fetcher,
    BETTER_AUTH_SECRET: 'synthetic-auth-regression-secret-at-least-32-characters',
    GOOGLE_CLIENT_ID: 'fixture-google-client',
    GOOGLE_CLIENT_SECRET: 'fixture-google-secret',
    APPLE_APP_BUNDLE_IDENTIFIER: 'com.significanthobbies.calorie',
  };
  return { env, sqlite, auth: createAuth(env, 'https://calorie.example') };
}

beforeEach(() => {
  vi.stubGlobal('fetch', () => {
    throw new Error('Auth compatibility fixtures must not contact external services.');
  });
});

afterEach(() => {
  for (const sqlite of fixtures.splice(0)) sqlite.close();
  vi.unstubAllGlobals();
});

describe('Better Auth installed-package compatibility', () => {
  it('reads an existing 1.6 bearer session and rejects unknown or expired tokens', async () => {
    const { env, sqlite } = fixture();
    const getSession = (token: string) =>
      app.request(
        '/api/auth/get-session',
        {
          headers: { Authorization: `Bearer ${token}` },
        },
        env
      );
    const valid = await getSession('fixture-bearer-token');
    expect(valid.status).toBe(200);
    await expect(valid.json()).resolves.toMatchObject({
      user: { id: 'fixture-user', email: 'fixture@example.invalid' },
      session: { token: 'fixture-bearer-token', userId: 'fixture-user' },
    });
    await expect((await getSession('unknown-token')).json()).resolves.toBeNull();
    sqlite.prepare('UPDATE session SET expiresAt = 1').run();
    await expect((await getSession('fixture-bearer-token')).json()).resolves.toBeNull();
  });

  it('preserves provider/account identity without an issuer migration and requires a session to link', async () => {
    const { auth, sqlite } = fixture();
    const accounts = await auth.api.listUserAccounts({
      headers: new Headers({ Authorization: 'Bearer fixture-bearer-token' }),
    });
    expect(accounts).toEqual([
      expect.objectContaining({
        accountId: 'fixture-google-subject',
        providerId: 'google',
      }),
    ]);
    await expect(
      auth.api.linkSocialAccount({
        body: { provider: 'google', callbackURL: 'https://calorie.example/' },
        headers: new Headers(),
      })
    ).rejects.toMatchObject({ status: 'UNAUTHORIZED' });
    const context = await auth.$context;
    expect(context.options.account?.accountLinking).toMatchObject({
      enabled: true,
      disableImplicitLinking: true,
      trustedProviders: ['google', 'apple'],
      allowDifferentEmails: true,
    });
    expect(context.socialProviders.map((provider) => provider.id)).toEqual(['google', 'apple']);
    const link = await auth.api.linkSocialAccount({
      body: { provider: 'google', callbackURL: 'https://calorie.example/' },
      headers: new Headers({ Authorization: 'Bearer fixture-bearer-token' }),
    });
    expect(new URL(link.url).origin).toBe('https://accounts.google.com');
    const value = sqlite.prepare('SELECT value FROM verification').get()?.value;
    expect(JSON.parse(String(value))).toMatchObject({
      link: { userId: 'fixture-user', email: 'fixture@example.invalid' },
    });
  });

  it('starts Google OAuth with namespaced state and rejects a forged callback', async () => {
    const { env, sqlite } = fixture();
    const start = await app.request(
      'https://calorie.example/api/native/auth/google/start',
      {},
      env
    );
    expect(start.status).toBe(302);
    const location = new URL(start.headers.get('location') ?? '');
    expect(location.origin).toBe('https://accounts.google.com');
    expect(location.searchParams.get('redirect_uri')).toBe(
      'https://calorie.example/api/auth/callback/google'
    );
    const state = location.searchParams.get('state');
    expect(state).toBeTruthy();
    expect(sqlite.prepare('SELECT identifier FROM verification').get()?.identifier).toBe(
      `auth-state:${state}`
    );
    const callback = await app.request(
      'https://calorie.example/api/auth/callback/google?state=forged&code=forged',
      {},
      env
    );
    expect(callback.status).toBe(302);
    expect(callback.headers.get('location')).toContain('error=');
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM session').get()?.count).toBe(1);
  });

  it('exchanges the authenticated native handoff once and never redirects with a bearer token', async () => {
    const { env } = fixture();
    const complete = await app.request(
      'https://calorie.example/api/native/auth/google/complete',
      {
        headers: { Authorization: 'Bearer fixture-bearer-token' },
      },
      env
    );
    expect(complete.status).toBe(302);
    const redirect = new URL(complete.headers.get('location') ?? '');
    expect(`${redirect.protocol}//${redirect.host}`).toBe('calorie://auth');
    expect(redirect.toString()).not.toContain('fixture-bearer-token');
    const exchange = () =>
      app.request(
        'https://calorie.example/api/native/auth/exchange',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: redirect.searchParams.get('code') }),
        },
        env
      );
    const first = await exchange();
    expect(first.status).toBe(200);
    await expect(first.json()).resolves.toEqual({ token: 'fixture-bearer-token' });
    expect((await exchange()).status).toBe(401);
  });

  it('revokes the bearer session on sign-out and refuses an unauthenticated native handoff', async () => {
    const { env, sqlite } = fixture();
    const signedOut = await app.request(
      'https://calorie.example/api/auth/sign-out',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer fixture-bearer-token' },
      },
      env
    );
    expect(signedOut.status).toBe(200);
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM session').get()?.count).toBe(0);
    const complete = await app.request(
      'https://calorie.example/api/native/auth/google/complete',
      {
        headers: { Authorization: 'Bearer fixture-bearer-token' },
      },
      env
    );
    expect(complete.status).toBe(302);
    const redirect = new URL(complete.headers.get('location') ?? '');
    expect(redirect.searchParams.get('error')).toBe('google_auth_failed');
    expect(redirect.searchParams.has('code')).toBe(false);
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM native_auth_handoffs').get()?.count).toBe(
      0
    );
  });
});

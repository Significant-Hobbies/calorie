import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/d1';
import { account, session, user, verification } from './schema';

export type AuthBindings = {
  DB: D1Database;
  ASSETS: Fetcher;
  BETTER_AUTH_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
};

const LOCAL_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:8787',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8787',
];

function isLocalUrl(url: string) {
  return url.includes('localhost') || url.includes('127.0.0.1');
}

export function isGoogleConfigured(env: AuthBindings) {
  return Boolean(env.GOOGLE_CLIENT_ID?.trim() && env.GOOGLE_CLIENT_SECRET?.trim());
}

export function createAuth(env: AuthBindings, requestUrl: string) {
  const origin = new URL(requestUrl).origin;
  const baseURL = isLocalUrl(origin) ? 'http://localhost:8787' : origin;
  const secret =
    env.BETTER_AUTH_SECRET ??
    (isLocalUrl(baseURL) ? 'calorie-local-dev-secret-never-use-in-production' : undefined);

  return betterAuth({
    database: drizzleAdapter(drizzle(env.DB), {
      provider: 'sqlite',
      schema: { user, session, account, verification },
    }),
    baseURL,
    secret,
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID?.trim() ?? '',
        clientSecret: env.GOOGLE_CLIENT_SECRET?.trim() ?? '',
        scope: ['openid', 'email', 'profile'],
      },
    },
    trustedOrigins: [...new Set([baseURL, ...LOCAL_ORIGINS])],
    rateLimit: {
      enabled: false,
    },
  });
}

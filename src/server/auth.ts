import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { bearer } from 'better-auth/plugins';
import { drizzle } from 'drizzle-orm/d1';
import { account, session, user, verification } from './schema';

export type AuthBindings = {
  DB: D1Database;
  ASSETS: Fetcher;
  BETTER_AUTH_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  APPLE_CLIENT_ID?: string;
  APPLE_CLIENT_SECRET?: string;
  APPLE_APP_BUNDLE_IDENTIFIER?: string;
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

export function isAppleConfigured(env: AuthBindings) {
  return Boolean(env.APPLE_APP_BUNDLE_IDENTIFIER?.trim());
}

export function isAppleWebConfigured(env: AuthBindings) {
  return Boolean(
    env.APPLE_CLIENT_ID?.trim() &&
      env.APPLE_CLIENT_SECRET?.trim() &&
      env.APPLE_APP_BUNDLE_IDENTIFIER?.trim()
  );
}

export function createAuth(env: AuthBindings, requestUrl: string) {
  const origin = new URL(requestUrl).origin;
  const baseURL = isLocalUrl(origin) ? 'http://localhost:8787' : origin;
  const secret =
    env.BETTER_AUTH_SECRET ??
    (isLocalUrl(baseURL) ? 'calorie-local-dev-secret-never-use-in-production' : undefined);
  const appleBundleIdentifier = env.APPLE_APP_BUNDLE_IDENTIFIER?.trim() ?? '';

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
      ...(isAppleConfigured(env)
        ? {
            apple: {
              clientId: env.APPLE_CLIENT_ID?.trim() || appleBundleIdentifier,
              clientSecret: env.APPLE_CLIENT_SECRET?.trim() ?? '',
              appBundleIdentifier: appleBundleIdentifier,
            },
          }
        : {}),
    },
    account: {
      accountLinking: {
        enabled: true,
        disableImplicitLinking: true,
        trustedProviders: ['google', 'apple'],
        allowDifferentEmails: true,
      },
    },
    user: {
      deleteUser: {
        enabled: true,
      },
    },
    plugins: [bearer()],
    trustedOrigins: [
      ...new Set([baseURL, ...LOCAL_ORIGINS, 'https://appleid.apple.com', 'calorie://auth']),
    ],
    rateLimit: {
      enabled: false,
    },
  });
}

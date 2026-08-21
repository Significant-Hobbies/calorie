import {
  createAuth,
  isAppleConfigured,
  isAppleWebConfigured,
  isGoogleConfigured,
} from '../server/auth';
import {
  consumeNativeHandoff,
  createNativeHandoffCode,
  isAllowedNativeCallback,
  NATIVE_AUTH_CALLBACK,
  saveNativeHandoff,
} from '../server/native-handoff';
import { authenticateMcpRead } from '../server/read-tokens';
import { applyCalorieUser, authenticateSharedIdentity } from './shared-identity';
import type { App, AppContext } from './types';

function health(c: AppContext) {
  return c.json({
    ok: true,
    auth: {
      googleConfigured: isGoogleConfigured(c.env),
      appleConfigured: isAppleConfigured(c.env),
      appleWebConfigured: isAppleWebConfigured(c.env),
    },
    storage: 'd1',
  });
}

function authConfig(c: AppContext) {
  return c.json({
    googleConfigured: isGoogleConfigured(c.env),
    appleConfigured: isAppleConfigured(c.env),
    appleWebConfigured: isAppleWebConfigured(c.env),
  });
}

async function authHandler(c: AppContext) {
  const path = new URL(c.req.url).pathname;
  if (path.endsWith('/sign-in/social') && c.req.method === 'POST') {
    const body = await c.req.raw
      .clone()
      .json<{ idToken?: unknown; provider?: unknown }>()
      .catch(() => null);
    const provider = body?.provider;
    if (provider === 'google' && !isGoogleConfigured(c.env)) {
      return c.json(
        {
          code: 'OAUTH_NOT_CONFIGURED',
          message: 'Google sign-in is not configured in this environment.',
        },
        503
      );
    }
    if (provider === 'apple' && !isAppleConfigured(c.env)) {
      return c.json(
        {
          code: 'OAUTH_NOT_CONFIGURED',
          message: 'Apple sign-in is not configured in this environment.',
        },
        503
      );
    }
    if (provider === 'apple' && !body?.idToken && !isAppleWebConfigured(c.env)) {
      return c.json(
        {
          code: 'OAUTH_NOT_CONFIGURED',
          message: 'Apple browser sign-in is not configured in this environment.',
        },
        503
      );
    }
  }
  return createAuth(c.env, c.req.url).handler(c.req.raw);
}

async function startNativeGoogleAuth(c: AppContext) {
  if (!isGoogleConfigured(c.env)) {
    return c.json({ code: 'OAUTH_NOT_CONFIGURED', message: 'Google sign-in is unavailable.' }, 503);
  }
  const callback = c.req.query('callback') ?? NATIVE_AUTH_CALLBACK;
  if (!isAllowedNativeCallback(callback)) {
    return c.json(
      { code: 'INVALID_CALLBACK', message: 'The native callback is not allowed.' },
      400
    );
  }
  const completeURL = new URL('/api/native/auth/google/complete', c.req.url);
  completeURL.searchParams.set('callback', callback);
  const result = await createAuth(c.env, c.req.url).api.signInSocial({
    body: {
      provider: 'google',
      callbackURL: completeURL.toString(),
      errorCallbackURL: completeURL.toString(),
    },
    headers: c.req.raw.headers,
  });
  if (!result.url) {
    return c.json({ code: 'OAUTH_START_FAILED', message: 'Google sign-in could not start.' }, 502);
  }
  return c.redirect(result.url);
}

async function completeNativeGoogleAuth(c: AppContext) {
  const callback = c.req.query('callback') ?? NATIVE_AUTH_CALLBACK;
  if (!isAllowedNativeCallback(callback)) {
    return c.json(
      { code: 'INVALID_CALLBACK', message: 'The native callback is not allowed.' },
      400
    );
  }
  const session = await createAuth(c.env, c.req.url).api.getSession({
    headers: c.req.raw.headers,
  });
  const redirect = new URL(callback);
  if (!session?.session.token) {
    redirect.searchParams.set('error', 'google_auth_failed');
    return c.redirect(redirect.toString());
  }
  const code = createNativeHandoffCode();
  await saveNativeHandoff(c.env.DB, code, session.session.token);
  redirect.searchParams.set('code', code);
  return c.redirect(redirect.toString());
}

async function exchangeNativeAuth(c: AppContext) {
  const body = await c.req.json<{ code?: unknown }>().catch(() => null);
  const code = typeof body?.code === 'string' ? body.code.trim() : '';
  if (code.length < 32 || code.length > 128) {
    return c.json({ code: 'INVALID_HANDOFF', message: 'The sign-in handoff is invalid.' }, 400);
  }
  const token = await consumeNativeHandoff(c.env.DB, code);
  if (!token) {
    return c.json(
      { code: 'EXPIRED_HANDOFF', message: 'The sign-in handoff expired or was already used.' },
      401
    );
  }
  return c.json({ token });
}

export function registerAuthRoutes(app: App) {
  app.get('/api/health', health);
  app.get('/api/auth/config', authConfig);
  app.on(['GET', 'POST'], '/api/auth/*', authHandler);
  app.get('/api/native/auth/google/start', startNativeGoogleAuth);
  app.get('/api/native/auth/google/complete', completeNativeGoogleAuth);
  app.post('/api/native/auth/exchange', exchangeNativeAuth);
}

export function registerSessionMiddleware(app: App) {
  app.use('/api/app/*', async (c, next) => {
    const session = await createAuth(c.env, c.req.url)
      .api.getSession({ headers: c.req.raw.headers })
      .catch(() => null);
    if (session?.user?.id) {
      c.set('userId', session.user.id);
      c.set('userName', session.user.name || 'You');
      c.set('userEmail', session.user.email || '');
      c.set('userImage', session.user.image || null);
      await next();
      return;
    }

    const shared = await authenticateSharedIdentity(c);
    if (shared.status === 'error') return shared.response;
    applyCalorieUser(c, shared.user);
    await next();
  });

  app.use('/api/mcp/*', async (c, next) => {
    const auth = await authenticateMcpRead(c.env.DB, c.req.header('Authorization'), c.env);
    if (auth.status === 'account_not_found') {
      return c.json(
        {
          code: 'ACCOUNT_NOT_FOUND',
          message: 'Sign in to Calorie with the same Google account first.',
        },
        403
      );
    }
    if (auth.status !== 'authorized') {
      return c.json({ code: 'UNAUTHORIZED', message: 'Provide a valid Calorie read token.' }, 401);
    }
    c.set('mcpUserId', auth.userId);
    await next();
  });
}

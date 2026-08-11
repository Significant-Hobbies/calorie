import { verifyWithJwks } from 'hono/jwt';
import type { AuthBindings } from './auth';

const REQUIRED_SCOPE = 'calorie.read';
const MAX_TOKEN_LIFETIME_SECONDS = 3_600;
const GOOGLE_SUBJECT = /^google-oauth2\|([A-Za-z0-9._-]{3,256})$/u;

type JwksOptions = Parameters<typeof verifyWithJwks>[1];

function auth0Issuer(value: string | undefined): string | null {
  try {
    const url = new URL(value ?? '');
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      url.pathname !== '/' ||
      url.search ||
      url.hash ||
      !url.hostname.endsWith('.auth0.com')
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}

function exactAudience(value: string | undefined): string | null {
  try {
    const url = new URL(value ?? '');
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash ||
      url.pathname !== '/calorie/mcp'
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}

function stringClaims(value: unknown): string[] {
  if (typeof value === 'string') return value.split(/\s+/u).filter(Boolean);
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return value;
  return [];
}

export async function verifyCalorieAuth0Subject(
  token: string,
  env: Pick<AuthBindings, 'AUTH0_ISSUER' | 'AUTH0_MCP_AUDIENCE'>,
  keys?: JwksOptions['keys']
): Promise<string | null> {
  const issuer = auth0Issuer(env.AUTH0_ISSUER);
  const audience = exactAudience(env.AUTH0_MCP_AUDIENCE);
  if (!issuer || !audience) return null;
  try {
    const payload = await verifyWithJwks(
      token,
      {
        ...(keys ? { keys } : { jwks_uri: new URL('.well-known/jwks.json', issuer).href }),
        allowedAlgorithms: ['RS256'],
        verification: { iss: issuer, aud: audience },
      },
      { cf: { cacheEverything: true, cacheTtl: 3_600 } }
    );
    const match = typeof payload.sub === 'string' ? GOOGLE_SUBJECT.exec(payload.sub) : null;
    const permissions = new Set([
      ...stringClaims(payload.scope),
      ...stringClaims(payload.scopes),
      ...stringClaims(payload.permissions),
    ]);
    if (
      !match ||
      typeof payload.iat !== 'number' ||
      typeof payload.exp !== 'number' ||
      payload.exp <= payload.iat ||
      payload.exp - payload.iat > MAX_TOKEN_LIFETIME_SECONDS ||
      !permissions.has(REQUIRED_SCOPE)
    )
      return null;
    return match[1] ?? null;
  } catch {
    return null;
  }
}

export async function findCalorieUserByGoogleId(
  db: D1Database,
  googleId: string
): Promise<string | null> {
  const row = await db
    .prepare(
      `SELECT userId FROM account
       WHERE providerId = 'google' AND accountId = ?
       LIMIT 1`
    )
    .bind(googleId)
    .first<{ userId: string }>();
  return row?.userId ?? null;
}

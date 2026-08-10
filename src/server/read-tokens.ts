const TOKEN_PREFIX = 'calorie_read_';

function toHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function readBearerToken(header: string | undefined): string | null {
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token.startsWith(TOKEN_PREFIX) && /^[A-Za-z0-9_-]+$/.test(token) ? token : null;
}

export async function hashReadToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return toHex(new Uint8Array(digest));
}

export function createReadToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const encoded = btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
  return `${TOKEN_PREFIX}${encoded}`;
}

export async function authenticateReadToken(
  db: D1Database,
  authorization: string | undefined
): Promise<string | null> {
  const token = readBearerToken(authorization);
  if (!token) return null;
  const row = await db
    .prepare(
      `SELECT user_id FROM mcp_read_tokens
       WHERE token_hash = ? AND revoked_at IS NULL`
    )
    .bind(await hashReadToken(token))
    .first<{ user_id: string }>();
  return row?.user_id ?? null;
}

export const NATIVE_AUTH_CALLBACK = 'calorie://auth';
export const NATIVE_HANDOFF_TTL_MS = 5 * 60 * 1000;

export function isAllowedNativeCallback(value: string) {
  return value === NATIVE_AUTH_CALLBACK;
}

export function createNativeHandoffCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

export async function hashNativeHandoffCode(code: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function saveNativeHandoff(
  db: D1Database,
  code: string,
  sessionToken: string,
  now = Date.now()
) {
  const codeHash = await hashNativeHandoffCode(code);
  await db
    .prepare(
      `INSERT INTO native_auth_handoffs (code_hash, session_token, expires_at, created_at)
       VALUES (?, ?, ?, ?)`
    )
    .bind(codeHash, sessionToken, now + NATIVE_HANDOFF_TTL_MS, now)
    .run();
}

export async function consumeNativeHandoff(db: D1Database, code: string, now = Date.now()) {
  const codeHash = await hashNativeHandoffCode(code);
  const row = await db
    .prepare(
      `DELETE FROM native_auth_handoffs
       WHERE code_hash = ? AND expires_at > ?
       RETURNING session_token`
    )
    .bind(codeHash, now)
    .first<{ session_token: string }>();
  await db.prepare('DELETE FROM native_auth_handoffs WHERE expires_at <= ?').bind(now).run();
  return row?.session_token ?? null;
}

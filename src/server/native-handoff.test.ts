import { describe, expect, it } from 'vitest';
import {
  consumeNativeHandoff,
  createNativeHandoffCode,
  hashNativeHandoffCode,
  isAllowedNativeCallback,
  NATIVE_AUTH_CALLBACK,
  NATIVE_HANDOFF_TTL_MS,
  PACE_AUTH_CALLBACK,
  saveNativeHandoff,
} from './native-handoff';

type StoredHandoff = { sessionToken: string; expiresAt: number };

function handoffDatabase() {
  const rows = new Map<string, StoredHandoff>();
  const database = {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          return {
            async run() {
              if (sql.includes('INSERT INTO native_auth_handoffs')) {
                rows.set(String(values[0]), {
                  sessionToken: String(values[1]),
                  expiresAt: Number(values[2]),
                });
              } else if (sql.includes('expires_at <= ?')) {
                const now = Number(values[0]);
                for (const [key, row] of rows) if (row.expiresAt <= now) rows.delete(key);
              }
              return { success: true };
            },
            async first<T>() {
              if (!sql.includes('DELETE FROM native_auth_handoffs')) return null;
              const row = rows.get(String(values[0]));
              if (!row || row.expiresAt <= Number(values[1])) return null;
              rows.delete(String(values[0]));
              return { session_token: row.sessionToken } as T;
            },
          };
        },
      };
    },
  } as unknown as D1Database;
  return database;
}

describe('native authentication handoff', () => {
  it('allows only the exact Calorie and Pace app callbacks', () => {
    expect(isAllowedNativeCallback(NATIVE_AUTH_CALLBACK)).toBe(true);
    expect(isAllowedNativeCallback(PACE_AUTH_CALLBACK)).toBe(true);
    expect(isAllowedNativeCallback('calorie://auth.evil.example')).toBe(false);
    expect(isAllowedNativeCallback('pace://calorie-auth.evil.example')).toBe(false);
    expect(isAllowedNativeCallback('https://calorie.example/auth')).toBe(false);
  });

  it('creates opaque high-entropy codes and deterministic hashes', async () => {
    const first = createNativeHandoffCode();
    const second = createNativeHandoffCode();
    expect(first).toHaveLength(43);
    expect(second).not.toBe(first);
    expect(await hashNativeHandoffCode(first)).toBe(await hashNativeHandoffCode(first));
    expect(await hashNativeHandoffCode(first)).not.toBe(await hashNativeHandoffCode(second));
  });

  it('consumes a valid handoff exactly once', async () => {
    const db = handoffDatabase();
    const now = 1_700_000_000_000;
    await saveNativeHandoff(db, 'a'.repeat(43), 'session-token', now);
    expect(await consumeNativeHandoff(db, 'a'.repeat(43), now + 1)).toBe('session-token');
    expect(await consumeNativeHandoff(db, 'a'.repeat(43), now + 2)).toBeNull();
  });

  it('rejects and removes expired handoffs', async () => {
    const db = handoffDatabase();
    const now = 1_700_000_000_000;
    await saveNativeHandoff(db, 'b'.repeat(43), 'expired-token', now);
    expect(await consumeNativeHandoff(db, 'b'.repeat(43), now + NATIVE_HANDOFF_TTL_MS)).toBeNull();
  });
});

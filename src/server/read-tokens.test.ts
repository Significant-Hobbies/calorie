import { describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import {
  authenticateReadToken,
  createReadToken,
  hashReadToken,
  readBearerToken,
} from './read-tokens';

describe('Calorie MCP read tokens', () => {
  it('creates scoped, high-entropy tokens and stores only a deterministic hash', async () => {
    const token = createReadToken();
    expect(token).toMatch(/^calorie_read_[A-Za-z0-9_-]{40,}$/);
    expect(await hashReadToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(await hashReadToken(token)).not.toContain(token);
  });

  it('rejects cookies, JWTs, malformed values, and wrong token scopes', () => {
    expect(readBearerToken(undefined)).toBeNull();
    expect(readBearerToken('session=calorie_read_secret')).toBeNull();
    expect(readBearerToken('Bearer header.payload.signature')).toBeNull();
    expect(readBearerToken('Bearer anime_list_secret')).toBeNull();
    expect(readBearerToken('Bearer calorie_read_bad value')).toBeNull();
  });

  it('resolves only an active token to its owning user', async () => {
    const token = createReadToken();
    const bindings: unknown[][] = [];
    const prepare = vi.fn((sql: string) => ({
      bind: (...args: unknown[]) => {
        bindings.push(args);
        return {
          first: async () => (sql.includes('revoked_at IS NULL') ? { user_id: 'owner-a' } : null),
        };
      },
    }));
    const db = { prepare } as unknown as D1Database;

    await expect(authenticateReadToken(db, `Bearer ${token}`)).resolves.toBe('owner-a');
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining('revoked_at IS NULL'));
    expect(bindings).toEqual([[await hashReadToken(token)]]);
  });

  it('fails closed for a revoked or unknown token', async () => {
    const db = {
      prepare: () => ({
        bind: () => ({ first: async () => null }),
      }),
    } as unknown as D1Database;

    await expect(authenticateReadToken(db, `Bearer ${createReadToken()}`)).resolves.toBeNull();
  });
});

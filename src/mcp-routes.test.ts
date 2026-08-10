import { describe, expect, it } from 'vitest';
import { createReadToken } from './server/read-tokens';
import app from './worker';

type QueryCall = { sql: string; args: unknown[] };

function fakeDatabase(options?: {
  tokenUser?: string | null;
  foods?: Record<string, unknown>[];
  totalFoods?: number;
}) {
  const calls: QueryCall[] = [];
  const tokenUser = options?.tokenUser === undefined ? 'owner-a' : options.tokenUser;
  const foods = options?.foods ?? [];
  const totalFoods = options?.totalFoods ?? foods.length;
  const db = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          calls.push({ sql, args });
          return {
            first: async () => {
              if (sql.includes('FROM mcp_read_tokens')) {
                return tokenUser ? { user_id: tokenUser } : null;
              }
              if (sql.includes('COUNT(*) AS total FROM foods')) return { total: totalFoods };
              return null;
            },
            all: async () => {
              if (sql.includes('FROM foods')) return { results: foods };
              return { results: [] };
            },
          };
        },
      };
    },
  } as unknown as D1Database;
  return { db, calls };
}

function readRequest(path: string, token = createReadToken()) {
  return new Request(`https://calorie.example${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

describe('Calorie MCP routes', () => {
  it('binds saved-food reads to the token owner and clamps pagination', async () => {
    const food = {
      id: 'food-a',
      name: 'Dal',
      serving_mode: 'per_100g',
      unit_label: 'g',
      default_amount: 100,
      calories: 120,
      carbs_g: 18,
      protein_g: 7,
      fibre_g: 5,
      favourite: 1,
      last_used_at: 1,
      archived_at: null,
      food_kind: 'prepared',
      is_packaged: 0,
      labels_json: '[]',
      medication_schedule: 'must-not-escape',
    };
    const { db, calls } = fakeDatabase({ foods: [food], totalFoods: 101 });
    const response = await app.fetch(readRequest('/api/mcp/foods?limit=500&offset=1'), {
      DB: db,
    } as never);
    const body = await response.json<Record<string, unknown>>();

    expect(response.status).toBe(200);
    expect(body.page).toEqual({ limit: 90, offset: 1, total: 101, nextOffset: 91 });
    expect(JSON.stringify(body)).not.toContain('must-not-escape');
    const foodCalls = calls.filter((call) => call.sql.includes('FROM foods'));
    expect(foodCalls).toHaveLength(2);
    expect(foodCalls.every((call) => call.args[0] === 'owner-a')).toBe(true);
  });

  it('returns explicit zero-value missing days over a bounded history window', async () => {
    const { db } = fakeDatabase();
    const response = await app.fetch(
      readRequest(
        '/api/mcp/history?start=2026-08-01&end=2026-08-03&timezone=UTC&limit=30&offset=0'
      ),
      { DB: db } as never
    );
    const body = await response.json<{
      items: Array<{ date: string; calories: number; waterMl: number }>;
      page: { total: number; nextOffset: number | null };
    }>();

    expect(response.status).toBe(200);
    expect(body.items).toEqual([
      expect.objectContaining({
        date: '2026-08-01',
        calories: 0,
        waterMl: 0,
        recorded: false,
        provenance: 'missing-day',
      }),
      expect.objectContaining({
        date: '2026-08-02',
        calories: 0,
        waterMl: 0,
        recorded: false,
        provenance: 'missing-day',
      }),
      expect.objectContaining({
        date: '2026-08-03',
        calories: 0,
        waterMl: 0,
        recorded: false,
        provenance: 'missing-day',
      }),
    ]);
    expect(body.page).toMatchObject({ total: 3, nextOffset: null });
  });

  it('reads only the target columns needed for a daily response', async () => {
    const { db, calls } = fakeDatabase();
    const response = await app.fetch(readRequest('/api/mcp/daily?date=2026-08-01&timezone=UTC'), {
      DB: db,
    } as never);

    expect(response.status).toBe(200);
    const profileRead = calls.find((call) => call.sql.includes('FROM profiles'));
    expect(profileRead?.sql).toContain(
      'SELECT manual_calorie_target, manual_calorie_min, manual_calorie_max,'
    );
    expect(profileRead?.sql).toContain('water_target_ml, fasting_threshold_hours');
    expect(profileRead?.sql).not.toContain('SELECT *');
    expect(profileRead?.args).toEqual(['owner-a']);
  });

  it('rejects revoked tokens before querying any owner data', async () => {
    const { db, calls } = fakeDatabase({ tokenUser: null });
    const response = await app.fetch(readRequest('/api/mcp/foods'), { DB: db } as never);

    expect(response.status).toBe(401);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.sql).toContain('FROM mcp_read_tokens');
  });
});

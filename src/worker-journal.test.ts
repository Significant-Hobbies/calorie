import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import app from './worker';

type StoredFood = {
  id: string;
  user_id: string;
  name: string;
  serving_mode: 'per_100g' | 'per_unit';
  unit_label: string;
  default_amount: number;
  calories: number;
  carbs_g: number;
  protein_g: number;
  fibre_g: number;
  favourite: number;
  last_used_at: number | null;
  archived_at: number | null;
  food_kind: string;
  is_packaged: number;
  labels_json: string;
};

type DatabaseOptions = {
  uniqueNames: boolean;
  foods?: StoredFood[];
  failInsert?: boolean;
  raceBeforeInsert?: StoredFood;
  hideFoodReadback?: boolean;
};

function food(id: string, userID: string, name: string, calories = 100): StoredFood {
  return {
    id,
    user_id: userID,
    name,
    serving_mode: 'per_unit',
    unit_label: 'serving',
    default_amount: 1,
    calories,
    carbs_g: 10,
    protein_g: 5,
    fibre_g: 2,
    favourite: 0,
    last_used_at: null,
    archived_at: null,
    food_kind: 'prepared',
    is_packaged: 0,
    labels_json: '[]',
  };
}

function database(options: DatabaseOptions) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE user (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      image TEXT,
      personal_user_id TEXT
    );
    CREATE TABLE session (
      id TEXT PRIMARY KEY NOT NULL,
      expiresAt INTEGER NOT NULL,
      token TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      ipAddress TEXT,
      userAgent TEXT,
      userId TEXT NOT NULL
    );
    CREATE TABLE foods (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      serving_mode TEXT NOT NULL,
      unit_label TEXT NOT NULL,
      default_amount REAL NOT NULL,
      calories REAL NOT NULL,
      carbs_g REAL NOT NULL,
      protein_g REAL NOT NULL,
      fibre_g REAL NOT NULL,
      favourite INTEGER NOT NULL,
      last_used_at INTEGER,
      archived_at INTEGER,
      food_kind TEXT NOT NULL,
      is_packaged INTEGER NOT NULL,
      labels_json TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0
    );
    CREATE UNIQUE INDEX foods_user_name_idx ON foods(user_id, name COLLATE NOCASE);
    INSERT INTO user (id, name, email, personal_user_id)
      VALUES ('calorie-user', 'Owner', 'owner@example.com', 'shared-user');
  `);
  if (!options.uniqueNames) {
    sqlite.exec(
      'DROP INDEX foods_user_name_idx; CREATE INDEX foods_user_name_idx ON foods(user_id, name COLLATE NOCASE);'
    );
  }

  const insertFood = sqlite.prepare(`
    INSERT INTO foods (
      id, user_id, name, serving_mode, unit_label, default_amount,
      calories, carbs_g, protein_g, fibre_g, favourite, food_kind, is_packaged, labels_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insert = (row: StoredFood) => {
    insertFood.run(
      row.id,
      row.user_id,
      row.name,
      row.serving_mode,
      row.unit_label,
      row.default_amount,
      row.calories,
      row.carbs_g,
      row.protein_g,
      row.fibre_g,
      row.favourite,
      row.food_kind,
      row.is_packaged,
      row.labels_json
    );
  };
  for (const row of options.foods ?? []) insert(row);

  let raceApplied = false;
  const db = {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          return {
            first: async () => {
              if (
                options.hideFoodReadback &&
                sql.includes('SELECT * FROM foods WHERE id = ? AND user_id = ?')
              ) {
                return null;
              }
              const row = sqlite.prepare(sql).get(...values);
              return row ?? null;
            },
            all: async () => ({ results: sqlite.prepare(sql).all(...values) }),
            run: async () => {
              if (options.failInsert && sql.includes('INSERT INTO foods')) {
                throw new Error('synthetic database outage');
              }
              if (options.raceBeforeInsert && !raceApplied && sql.includes('INSERT INTO foods')) {
                raceApplied = true;
                insert(options.raceBeforeInsert);
              }
              const result = sqlite.prepare(sql).run(...values);
              return { meta: { changes: Number(result.changes) } };
            },
          };
        },
      };
    },
  } as unknown as D1Database;
  return {
    db,
    countFoods: () => Number(sqlite.prepare('SELECT COUNT(*) AS count FROM foods').get()?.count),
    close: () => sqlite.close(),
  };
}

function environment(database: D1Database) {
  return {
    APPLE_APP_BUNDLE_IDENTIFIER: 'com.significanthobbies.calorie',
    ASSETS: {} as Fetcher,
    AUTH_SERVICE: {
      fetch: async () => Response.json({ userId: 'shared-user' }),
    } as Fetcher,
    DB: database,
  };
}

function request(body: Record<string, unknown>) {
  return new Request('https://calorie.example/api/app/foods', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer synthetic-session',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function payload(id: string, name: string, calories = 100) {
  return {
    id,
    name,
    servingMode: 'per_unit',
    unitLabel: 'serving',
    defaultAmount: 1,
    calories,
    carbsG: 10,
    proteinG: 5,
    fibreG: 2,
  };
}

describe('legacy saved-food creation', () => {
  it('replays the existing owner row without overwriting changed input', async () => {
    const fixture = database({
      uniqueNames: true,
      foods: [food('food-1', 'calorie-user', 'Oats', 300)],
    });

    try {
      const response = await app.fetch(
        request(payload('food-1', 'Changed oats', 999)),
        environment(fixture.db)
      );

      expect(response.status).toBe(201);
      await expect(response.json()).resolves.toMatchObject({
        id: 'food-1',
        name: 'Oats',
        calories: 300,
      });
    } finally {
      fixture.close();
    }
  });

  it('returns a generic conflict for old-schema name and cross-owner ID collisions', async () => {
    const oldSchema = database({
      uniqueNames: true,
      foods: [food('food-old', 'calorie-user', 'Oats')],
    });
    const foreignID = database({
      uniqueNames: false,
      foods: [food('food-foreign', 'another-user', 'Different name')],
    });

    try {
      const oldSchemaResponse = await app.fetch(
        request(payload('food-new', 'oats')),
        environment(oldSchema.db)
      );
      const foreignIDResponse = await app.fetch(
        request(payload('food-foreign', 'New name')),
        environment(foreignID.db)
      );

      expect(oldSchemaResponse.status).toBe(409);
      expect(foreignIDResponse.status).toBe(409);
      const oldSchemaBody = await oldSchemaResponse.json();
      const foreignIDBody = await foreignIDResponse.json();
      expect(oldSchemaBody).toEqual({
        code: 'VALIDATION_ERROR',
        message: 'That food could not be created.',
        fields: undefined,
      });
      expect(foreignIDBody).toEqual({
        code: 'VALIDATION_ERROR',
        message: 'That food could not be created.',
        fields: undefined,
      });
      expect(JSON.stringify(oldSchemaBody)).not.toContain('calorie-user');
      expect(JSON.stringify(foreignIDBody)).not.toContain('another-user');
    } finally {
      oldSchema.close();
      foreignID.close();
    }
  });

  it('allows duplicate names when the schema has already removed the unique index', async () => {
    const fixture = database({
      uniqueNames: false,
      foods: [food('food-old', 'calorie-user', 'Oats')],
    });

    try {
      const response = await app.fetch(
        request(payload('food-new', 'oats')),
        environment(fixture.db)
      );

      expect(response.status).toBe(201);
      expect(fixture.countFoods()).toBe(2);
      await expect(response.json()).resolves.toMatchObject({ id: 'food-new', name: 'oats' });
    } finally {
      fixture.close();
    }
  });

  it('re-reads the concurrent winner after a raced same-ID insert', async () => {
    const fixture = database({
      uniqueNames: false,
      raceBeforeInsert: food('food-race', 'calorie-user', 'Concurrent winner', 275),
    });

    try {
      const response = await app.fetch(
        request(payload('food-race', 'Losing payload', 999)),
        environment(fixture.db)
      );

      expect(response.status).toBe(201);
      await expect(response.json()).resolves.toMatchObject({
        id: 'food-race',
        name: 'Concurrent winner',
        calories: 275,
      });
    } finally {
      fixture.close();
    }
  });

  it('keeps unexpected insert failures on the normal 500 path', async () => {
    const fixture = database({ uniqueNames: true, failInsert: true });

    try {
      const response = await app.fetch(
        request(payload('food-failure', 'Oats')),
        environment(fixture.db)
      );

      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toMatchObject({
        code: 'SERVER_ERROR',
        message: 'Calorie could not finish that request. Try again.',
      });
    } finally {
      fixture.close();
    }
  });

  it('keeps a successful-insert readback failure on the 500 path', async () => {
    const fixture = database({ uniqueNames: false, hideFoodReadback: true });

    try {
      const response = await app.fetch(
        request(payload('food-readback', 'Oats')),
        environment(fixture.db)
      );

      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toMatchObject({
        message: 'The saved food could not be read back.',
      });
    } finally {
      fixture.close();
    }
  });
});

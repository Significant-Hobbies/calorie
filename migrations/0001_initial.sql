PRAGMA foreign_keys = ON;

CREATE TABLE user (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  emailVerified INTEGER NOT NULL DEFAULT 0,
  image TEXT,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE TABLE session (
  id TEXT PRIMARY KEY NOT NULL,
  expiresAt INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  ipAddress TEXT,
  userAgent TEXT,
  userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX session_user_idx ON session(userId);

CREATE TABLE account (
  id TEXT PRIMARY KEY NOT NULL,
  accountId TEXT NOT NULL,
  providerId TEXT NOT NULL,
  userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  accessToken TEXT,
  refreshToken TEXT,
  idToken TEXT,
  accessTokenExpiresAt INTEGER,
  refreshTokenExpiresAt INTEGER,
  scope TEXT,
  password TEXT,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE INDEX account_user_idx ON account(userId);

CREATE TABLE verification (
  id TEXT PRIMARY KEY NOT NULL,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expiresAt INTEGER NOT NULL,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE INDEX verification_identifier_idx ON verification(identifier);

CREATE TABLE profiles (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  units TEXT NOT NULL DEFAULT 'metric' CHECK (units IN ('metric', 'imperial')),
  age_years INTEGER CHECK (age_years BETWEEN 18 AND 120),
  gender_identity TEXT,
  equation_profile TEXT CHECK (equation_profile IN ('female', 'male', 'none')),
  height_cm REAL CHECK (height_cm BETWEEN 100 AND 250),
  activity_level TEXT NOT NULL DEFAULT 'moderate'
    CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'very')),
  goal TEXT NOT NULL DEFAULT 'maintain'
    CHECK (goal IN ('lose_gentle', 'lose_steady', 'maintain', 'gain_gentle')),
  target_weight_kg REAL CHECK (target_weight_kg BETWEEN 30 AND 400),
  manual_calorie_target INTEGER CHECK (manual_calorie_target BETWEEN 800 AND 6000),
  wake_time TEXT NOT NULL DEFAULT '07:00',
  sleep_hours REAL NOT NULL DEFAULT 8 CHECK (sleep_hours BETWEEN 5 AND 12),
  fasting_threshold_hours INTEGER NOT NULL DEFAULT 12
    CHECK (fasting_threshold_hours IN (12, 14, 16)),
  water_target_ml INTEGER NOT NULL DEFAULT 2000 CHECK (water_target_ml BETWEEN 250 AND 10000),
  onboarding_complete INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE foods (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  serving_mode TEXT NOT NULL CHECK (serving_mode IN ('per_100g', 'per_unit')),
  unit_label TEXT NOT NULL DEFAULT 'serving',
  default_amount REAL NOT NULL CHECK (default_amount > 0),
  calories REAL NOT NULL DEFAULT 0 CHECK (calories >= 0),
  carbs_g REAL NOT NULL DEFAULT 0 CHECK (carbs_g >= 0),
  protein_g REAL NOT NULL DEFAULT 0 CHECK (protein_g >= 0),
  fibre_g REAL NOT NULL DEFAULT 0 CHECK (fibre_g >= 0),
  favourite INTEGER NOT NULL DEFAULT 0,
  last_used_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX foods_user_recent_idx ON foods(user_id, last_used_at DESC);
CREATE UNIQUE INDEX foods_user_name_idx ON foods(user_id, name COLLATE NOCASE);

CREATE TABLE food_entries (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  food_id TEXT REFERENCES foods(id) ON DELETE SET NULL,
  food_name TEXT NOT NULL,
  amount REAL NOT NULL CHECK (amount > 0),
  unit_label TEXT NOT NULL,
  calories REAL NOT NULL CHECK (calories >= 0),
  carbs_g REAL NOT NULL CHECK (carbs_g >= 0),
  protein_g REAL NOT NULL CHECK (protein_g >= 0),
  fibre_g REAL NOT NULL CHECK (fibre_g >= 0),
  eaten_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX food_entries_user_time_idx ON food_entries(user_id, eaten_at DESC);

CREATE TABLE water_entries (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  amount_ml INTEGER NOT NULL CHECK (amount_ml BETWEEN 1 AND 5000),
  drank_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX water_entries_user_time_idx ON water_entries(user_id, drank_at DESC);

CREATE TABLE weight_entries (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  weight_kg REAL NOT NULL CHECK (weight_kg BETWEEN 30 AND 400),
  recorded_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX weight_entries_user_time_idx ON weight_entries(user_id, recorded_at DESC);


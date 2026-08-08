ALTER TABLE profiles
  ADD COLUMN daily_action_order TEXT NOT NULL DEFAULT 'weight,creatine,food,water';

ALTER TABLE profiles
  ADD COLUMN daily_action_hidden TEXT NOT NULL DEFAULT '';

ALTER TABLE foods ADD COLUMN food_kind TEXT NOT NULL DEFAULT 'prepared'
  CHECK (food_kind IN ('whole_food', 'prepared', 'packaged', 'supplement'));
ALTER TABLE foods ADD COLUMN labels_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE food_entries ADD COLUMN food_kind TEXT NOT NULL DEFAULT 'prepared'
  CHECK (food_kind IN ('whole_food', 'prepared', 'packaged', 'supplement'));
ALTER TABLE food_entries ADD COLUMN labels_json TEXT NOT NULL DEFAULT '[]';

CREATE TABLE goal_cycles (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  cycle TEXT NOT NULL CHECK (cycle IN ('cut', 'gain', 'recomposition')),
  goal TEXT NOT NULL CHECK (goal IN ('lose_gentle', 'lose_steady', 'maintain', 'gain_gentle')),
  start_on TEXT NOT NULL,
  end_on TEXT,
  calorie_range_low INTEGER,
  calorie_range_high INTEGER,
  protein_range_low INTEGER,
  protein_range_high INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX goal_cycles_user_active_idx
  ON goal_cycles(user_id)
  WHERE end_on IS NULL;

CREATE INDEX goal_cycles_user_dates_idx
  ON goal_cycles(user_id, start_on DESC, end_on DESC);

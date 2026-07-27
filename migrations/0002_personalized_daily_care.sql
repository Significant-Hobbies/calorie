ALTER TABLE profiles
  ADD COLUMN manual_calorie_min INTEGER CHECK (manual_calorie_min BETWEEN 800 AND 6000);

ALTER TABLE profiles
  ADD COLUMN manual_calorie_max INTEGER CHECK (manual_calorie_max BETWEEN 800 AND 6000);

UPDATE profiles
SET
  manual_calorie_min = MAX(800, manual_calorie_target - 100),
  manual_calorie_max = manual_calorie_target + 100
WHERE manual_calorie_target IS NOT NULL;

CREATE TABLE medications (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  schedule TEXT NOT NULL CHECK (schedule IN ('morning', 'evening', 'either')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  archived_at INTEGER
);

CREATE INDEX medications_user_active_idx
  ON medications(user_id, archived_at, created_at);

CREATE TABLE medication_check_ins (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  medication_id TEXT NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  taken_on TEXT NOT NULL,
  taken_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(user_id, medication_id, taken_on)
);

CREATE INDEX medication_check_ins_user_day_idx
  ON medication_check_ins(user_id, taken_on, taken_at DESC);

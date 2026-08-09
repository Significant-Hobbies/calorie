ALTER TABLE foods
  ADD COLUMN is_packaged INTEGER NOT NULL DEFAULT 0
  CHECK (is_packaged IN (0, 1));

ALTER TABLE food_entries
  ADD COLUMN is_packaged INTEGER NOT NULL DEFAULT 0
  CHECK (is_packaged IN (0, 1));

UPDATE foods
SET is_packaged = CASE WHEN food_kind = 'packaged' THEN 1 ELSE 0 END;

UPDATE food_entries
SET is_packaged = CASE WHEN food_kind = 'packaged' THEN 1 ELSE 0 END;

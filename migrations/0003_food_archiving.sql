ALTER TABLE foods
  ADD COLUMN archived_at INTEGER;

CREATE INDEX foods_user_lifecycle_idx
  ON foods(user_id, archived_at, last_used_at DESC);

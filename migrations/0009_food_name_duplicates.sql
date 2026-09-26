DROP INDEX foods_user_name_idx;

CREATE INDEX foods_user_name_idx
  ON foods(user_id, name COLLATE NOCASE);

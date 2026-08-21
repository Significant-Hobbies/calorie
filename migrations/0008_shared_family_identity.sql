ALTER TABLE user ADD COLUMN personal_user_id TEXT;

CREATE UNIQUE INDEX user_personal_user_id_idx
ON user(personal_user_id)
WHERE personal_user_id IS NOT NULL;

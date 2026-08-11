CREATE TABLE native_auth_handoffs (
  code_hash TEXT PRIMARY KEY NOT NULL,
  session_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX native_auth_handoffs_expiry_idx
ON native_auth_handoffs(expires_at);

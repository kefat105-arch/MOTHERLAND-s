-- Additive persistent auth HMAC secret table + refresh/watch history indexes
-- Preserves all existing tables, users, sessions, and watch history

CREATE TABLE IF NOT EXISTS app_secrets (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token_hash
  ON sessions (refresh_token_hash);

CREATE INDEX IF NOT EXISTS idx_watch_history_user_meaningful
  ON watch_history (user_id, meaningful_view);

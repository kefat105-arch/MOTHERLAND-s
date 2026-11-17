-- MOTHERLAND Schema Migration 002
-- Ensures media visibility/bucket/key columns and composite performance indexes exist safely on upgrades.

ALTER TABLE media_assets
  ADD COLUMN IF NOT EXISTS storage_key TEXT,
  ADD COLUMN IF NOT EXISTS bucket TEXT,
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS conversation_id TEXT;

CREATE INDEX IF NOT EXISTS idx_media_assets_visibility ON media_assets (visibility);
CREATE INDEX IF NOT EXISTS idx_posts_audience_created ON posts (audience, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions (token_hash) WHERE token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_watch_history_user_meaningful ON watch_history (user_id, last_viewed_at DESC) WHERE meaningful_view = TRUE;

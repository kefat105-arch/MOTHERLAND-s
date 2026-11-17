-- MOTHERLAND Schema Migration 003
-- Additive recommendation profile persistence & category classification columns.
-- Preserves all existing user data, watch history, posts, and media records.

CREATE TABLE IF NOT EXISTS recommendation_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  category_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  subcategory_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  creator_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  keyword_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  language_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  search_interests JSONB NOT NULL DEFAULT '[]'::jsonb,
  hidden_creators JSONB NOT NULL DEFAULT '[]'::jsonb,
  reduced_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  not_interested_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  skipped_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  replayed_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_signals INTEGER NOT NULL DEFAULT 0,
  learning_stage TEXT NOT NULL DEFAULT 'initial_discovery',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE watch_history
  ADD COLUMN IF NOT EXISTS category_id TEXT,
  ADD COLUMN IF NOT EXISTS subcategory TEXT,
  ADD COLUMN IF NOT EXISTS replay_count INTEGER NOT NULL DEFAULT 1;

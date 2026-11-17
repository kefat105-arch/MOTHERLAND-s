-- MOTHERLAND Production PostgreSQL Schema
-- Repeatable, non-destructive initial schema for Supabase PostgreSQL (Session Pooler compatible)
-- Preserves all existing application-level string IDs (usr_*, post_*, conv_*, msg_*, media_*, etc.)

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  checksum TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================
-- 1. USERS, AUTHENTICATION & SESSIONS
-- ==========================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  phone_number TEXT,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL DEFAULT 120000,
  has_password BOOLEAN NOT NULL DEFAULT TRUE,
  auth_provider TEXT NOT NULL DEFAULT 'password',
  auth_providers JSONB NOT NULL DEFAULT '["password"]'::jsonb,
  google_id TEXT,
  google_email TEXT,
  display_name TEXT NOT NULL,
  avatar TEXT NOT NULL DEFAULT '',
  cover_image TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  website TEXT,
  location TEXT,
  work TEXT,
  education TEXT,
  date_of_birth TEXT,
  gender TEXT,
  address TEXT,
  joined_date TEXT NOT NULL DEFAULT 'November 2026',
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('owner', 'admin', 'user')),
  is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
  two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  is_private BOOLEAN NOT NULL DEFAULT FALSE,
  deactivated BOOLEAN NOT NULL DEFAULT FALSE,
  deactivated_at TIMESTAMPTZ,
  privacy JSONB NOT NULL DEFAULT '{}'::jsonb,
  notification_prefs JSONB,
  translation_prefs JSONB,
  data_saver BOOLEAN NOT NULL DEFAULT FALSE,
  last_active_at TIMESTAMPTZ,
  social_links JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower_uniq
  ON users (LOWER(username));

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower_uniq
  ON users (LOWER(email))
  WHERE email <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_uniq
  ON users (phone_number)
  WHERE phone_number IS NOT NULL AND phone_number <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id_uniq
  ON users (google_id)
  WHERE google_id IS NOT NULL AND google_id <> '';

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT,
  token_hash TEXT UNIQUE,
  refresh_token_hash TEXT,
  refresh_expires_at TIMESTAMPTZ,
  device_name TEXT,
  ip_address TEXT,
  auth_method TEXT DEFAULT 'password',
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS otp_codes (
  identifier TEXT NOT NULL,
  type TEXT NOT NULL,
  code TEXT NOT NULL,
  channel TEXT,
  expires_at BIGINT NOT NULL,
  PRIMARY KEY (identifier, type)
);

CREATE TABLE IF NOT EXISTS verified_contacts (
  identifier TEXT NOT NULL,
  method TEXT NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at BIGINT NOT NULL,
  PRIMARY KEY (identifier, method)
);

CREATE TABLE IF NOT EXISTS login_activity (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_activity_user_created
  ON login_activity (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS youtube_oauth_tokens (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at BIGINT NOT NULL,
  scope TEXT NOT NULL DEFAULT '',
  channel_id TEXT NOT NULL DEFAULT '',
  channel_title TEXT NOT NULL DEFAULT '',
  channel_avatar TEXT NOT NULL DEFAULT '',
  subscriber_count TEXT,
  custom_url TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================
-- 2. POSTS, REACTIONS, COMMENTS, DRAFTS & SAVED
-- ==========================================
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'motherland',
  external_id TEXT,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_snapshot JSONB NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  media_type TEXT NOT NULL DEFAULT 'none',
  media_url TEXT,
  images JSONB,
  thumbnail_url TEXT,
  media_aspect_ratio TEXT DEFAULT '16:9',
  hashtags JSONB NOT NULL DEFAULT '[]'::jsonb,
  audience TEXT NOT NULL DEFAULT 'public' CHECK (audience IN ('public', 'friends', 'only_me')),
  stats JSONB NOT NULL DEFAULT '{"likes":0,"comments":0,"shares":0,"views":0}'::jsonb,
  shared_post JSONB,
  is_edited BOOLEAN NOT NULL DEFAULT FALSE,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_created_at_desc ON posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_author_created ON posts (author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_source_created ON posts (source, created_at DESC);

CREATE TABLE IF NOT EXISTS post_reactions (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'like',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_reactions_user ON post_reactions (user_id);

CREATE TABLE IF NOT EXISTS saved_posts (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_posts_user ON saved_posts (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS post_comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  parent_id TEXT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_display_name TEXT NOT NULL,
  user_username TEXT NOT NULL,
  user_avatar TEXT NOT NULL DEFAULT '',
  text TEXT NOT NULL,
  liked_by JSONB NOT NULL DEFAULT '[]'::jsonb,
  likes_count INTEGER NOT NULL DEFAULT 0,
  is_edited BOOLEAN NOT NULL DEFAULT FALSE,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_comments_post_created ON post_comments (post_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_post_comments_parent ON post_comments (parent_id) WHERE parent_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'post',
  content TEXT NOT NULL DEFAULT '',
  short_title TEXT,
  media_type TEXT DEFAULT 'none',
  media_url TEXT,
  images JSONB,
  hashtags JSONB,
  audience TEXT DEFAULT 'public',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drafts_user_updated ON drafts (user_id, updated_at DESC);

-- ==========================================
-- 3. STORIES & MEDIA ASSETS
-- ==========================================
CREATE TABLE IF NOT EXISTS stories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_display_name TEXT NOT NULL,
  user_username TEXT NOT NULL,
  user_avatar TEXT NOT NULL DEFAULT '',
  is_user_verified BOOLEAN NOT NULL DEFAULT FALSE,
  source TEXT NOT NULL DEFAULT 'motherland',
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image',
  caption TEXT NOT NULL DEFAULT '',
  viewers_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stories_expires_at ON stories (expires_at);
CREATE INDEX IF NOT EXISTS idx_stories_user ON stories (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS expired_stories_archive (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  media_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  expired_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expired_stories_utc ON expired_stories_archive (expired_at_utc DESC);

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_filename TEXT NOT NULL,
  stored_filename TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  storage_key TEXT,
  bucket TEXT,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  conversation_id TEXT,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  size_bytes BIGINT NOT NULL DEFAULT 0,
  sha256 TEXT NOT NULL DEFAULT '',
  storage_provider TEXT NOT NULL DEFAULT 'supabase_s3',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_assets_owner ON media_assets (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_assets_url ON media_assets (url);
CREATE INDEX IF NOT EXISTS idx_media_assets_conv ON media_assets (conversation_id) WHERE conversation_id IS NOT NULL;

-- ==========================================
-- 4. VIDEOS, SAVED VIDEOS & WATCH HISTORY
-- ==========================================
CREATE TABLE IF NOT EXISTS short_videos (
  id TEXT PRIMARY KEY,
  author_id TEXT,
  source TEXT NOT NULL DEFAULT 'motherland',
  youtube_id TEXT,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_short_videos_created ON short_videos (created_at DESC);

CREATE TABLE IF NOT EXISTS long_videos (
  id TEXT PRIMARY KEY,
  author_id TEXT,
  source TEXT NOT NULL DEFAULT 'motherland',
  youtube_id TEXT,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_long_videos_created ON long_videos (created_at DESC);

CREATE TABLE IF NOT EXISTS saved_videos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL,
  video_type TEXT NOT NULL DEFAULT 'long',
  source TEXT NOT NULL DEFAULT 'youtube',
  youtube_id TEXT,
  title TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL DEFAULT '',
  channel_title TEXT NOT NULL DEFAULT '',
  channel_avatar TEXT,
  duration TEXT,
  video_url TEXT,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, video_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_videos_user_saved ON saved_videos (user_id, saved_at DESC);

CREATE TABLE IF NOT EXISTS watch_history (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL,
  youtube_id TEXT,
  video_type TEXT NOT NULL DEFAULT 'long',
  source TEXT NOT NULL DEFAULT 'youtube',
  title TEXT NOT NULL DEFAULT '',
  thumbnail_url TEXT NOT NULL DEFAULT '',
  channel_title TEXT NOT NULL DEFAULT '',
  duration TEXT,
  watch_seconds DOUBLE PRECISION NOT NULL DEFAULT 0,
  duration_seconds DOUBLE PRECISION NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  meaningful_view BOOLEAN NOT NULL DEFAULT FALSE,
  first_viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, video_id)
);

CREATE INDEX IF NOT EXISTS idx_watch_history_user_last ON watch_history (user_id, last_viewed_at DESC);

-- ==========================================
-- 5. SOCIAL GRAPH, REPORTS & NOTIFICATIONS
-- ==========================================
CREATE TABLE IF NOT EXISTS friendships (
  user1_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user2_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user1_id, user2_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_user2 ON friendships (user2_id);

CREATE TABLE IF NOT EXISTS friend_requests (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  recipient_snapshot JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'canceled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON friend_requests (receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_friend_requests_sender ON friend_requests (sender_id, status);

CREATE TABLE IF NOT EXISTS follows (
  follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_following ON follows (following_id);

CREATE TABLE IF NOT EXISTS blocks (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, blocked_user_id)
);

CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON blocks (blocked_user_id);

CREATE TABLE IF NOT EXISTS user_reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL,
  target_user_id TEXT,
  target_conversation_id TEXT,
  target_message_id TEXT,
  reason TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT DEFAULT 'motherland',
  type TEXT NOT NULL,
  sender_snapshot JSONB NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  target_id TEXT,
  target_type TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
  ON notifications (recipient_id, created_at DESC);

-- ==========================================
-- 6. WAVE MESSAGING & CALLS
-- ==========================================
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  is_group BOOLEAN NOT NULL DEFAULT FALSE,
  name TEXT,
  photo TEXT,
  creator_id TEXT,
  admin_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  pinned_message_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  disappearing_seconds INTEGER NOT NULL DEFAULT 0,
  is_request BOOLEAN NOT NULL DEFAULT FALSE,
  request_status TEXT,
  requested_by TEXT,
  archived_by JSONB NOT NULL DEFAULT '[]'::jsonb,
  muted_by JSONB NOT NULL DEFAULT '[]'::jsonb,
  pinned_by JSONB NOT NULL DEFAULT '[]'::jsonb,
  participant_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_message JSONB,
  last_read_at_by_user JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations (updated_at DESC);

CREATE TABLE IF NOT EXISTS conversation_participants (
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_participants_user ON conversation_participants (user_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  sender_avatar TEXT NOT NULL DEFAULT '',
  text TEXT NOT NULL DEFAULT '',
  media_url TEXT,
  media_type TEXT,
  file_name TEXT,
  file_size BIGINT,
  mime_type TEXT,
  attachments JSONB,
  audio_duration DOUBLE PRECISION,
  audio_waveform JSONB,
  reply_to JSONB,
  forwarded_from JSONB,
  reactions JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_edited BOOLEAN NOT NULL DEFAULT FALSE,
  edited_at TIMESTAMPTZ,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_for_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  message_type TEXT NOT NULL DEFAULT 'text',
  delivered_to JSONB NOT NULL DEFAULT '[]'::jsonb,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conv_created
  ON chat_messages (conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_expires
  ON chat_messages (expires_at) WHERE expires_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS call_records (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  caller_id TEXT NOT NULL,
  caller_name TEXT NOT NULL,
  caller_avatar TEXT NOT NULL DEFAULT '',
  callee_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  callee_name TEXT,
  callee_avatar TEXT,
  call_type TEXT NOT NULL DEFAULT 'audio',
  is_group_call BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'ended',
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_call_records_created ON call_records (created_at DESC);

-- ==========================================
-- 7. SERVER REGISTRY, OWNER CONFIG & BD PREFS
-- ==========================================
CREATE TABLE IF NOT EXISTS server_registry (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  health_path TEXT,
  ws_url TEXT,
  environment TEXT,
  assigned_services JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  isolated BOOLEAN NOT NULL DEFAULT FALSE,
  last_health_status TEXT DEFAULT 'unknown',
  last_latency_ms INTEGER,
  last_checked_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS server_switch_history (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  server_id TEXT NOT NULL,
  server_name TEXT NOT NULL,
  previous_primary_id TEXT,
  new_primary_id TEXT,
  actor_id TEXT NOT NULL,
  actor_username TEXT NOT NULL,
  summary TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_server_switch_history_created ON server_switch_history (created_at DESC);

CREATE TABLE IF NOT EXISTS admin_config_messages (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  sender_id TEXT,
  sender_name TEXT,
  text TEXT NOT NULL,
  parsed_intent JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_config_messages_created ON admin_config_messages (created_at ASC);

CREATE TABLE IF NOT EXISTS bd_service_prefs (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  favorites JSONB NOT NULL DEFAULT '[]'::jsonb,
  recent JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

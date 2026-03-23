-- Migration 009: App config for force-update + user activity tracking

-- ============================================================================
-- APP CONFIG (singleton row for remote config)
-- ============================================================================

CREATE TABLE app_config (
  singleton_key BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton_key = true),
  min_version TEXT NOT NULL DEFAULT '0.0.0',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Seed the single row
INSERT INTO app_config (min_version) VALUES ('0.0.0');

-- RLS
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- Everyone (including anonymous/guest) can read config
CREATE POLICY "App config is readable by everyone"
  ON app_config FOR SELECT
  USING (true);

-- Only admins can update config
CREATE POLICY "Only admins can update app config"
  ON app_config FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
  );

-- No INSERT/DELETE policies — the row is seeded in migration and never added/removed

-- ============================================================================
-- USER ACTIVITY (one row per user, upserted on app launch/foreground)
-- ============================================================================

CREATE TABLE user_activity (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  app_version TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios')),
  os_version TEXT,
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX idx_user_activity_last_seen ON user_activity(last_seen_at DESC);

-- RLS
ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;

-- Users can view their own activity
CREATE POLICY "Users can view their own activity"
  ON user_activity FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own activity
CREATE POLICY "Users can insert their own activity"
  ON user_activity FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own activity
CREATE POLICY "Users can update their own activity"
  ON user_activity FOR UPDATE
  USING (auth.uid() = user_id);

-- Admins can view all activity (for version analytics)
CREATE POLICY "Admins can view all activity"
  ON user_activity FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
  );

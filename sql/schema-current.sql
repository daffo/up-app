-- UP App Database Schema (Current State)
-- Run this on a fresh Supabase project to set up the complete database
-- This is equivalent to running all migrations (000-004) in sequence
--
-- Last updated: After migration-011-route-stats-functions

-- ============================================================================
-- TABLES
-- ============================================================================

-- Admins table (track who can manage photos)
CREATE TABLE admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Photos table (spray wall images with setup/teardown period)
CREATE TABLE photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  image_url TEXT NOT NULL,
  setup_date DATE,
  teardown_date DATE,
  user_id UUID REFERENCES auth.users NOT NULL,
  holds_version INTEGER NOT NULL DEFAULT 0
);

-- Detected holds table (physical holds on the wall, auto-detected or manual)
CREATE TABLE detected_holds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  photo_id UUID REFERENCES photos(id) ON DELETE CASCADE NOT NULL,
  polygon JSONB NOT NULL,           -- Array of {x, y} as percentages [0-100]
  center JSONB NOT NULL,            -- {x, y} as percentages (for display/sorting)
  dominant_color TEXT,              -- Optional: hex color (e.g., "#FF0000")
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Routes table (climbing routes with hold references)
CREATE TABLE routes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  title TEXT NOT NULL CHECK (char_length(title) <= 100),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 500),
  grade TEXT NOT NULL,
  photo_id UUID REFERENCES photos(id) ON DELETE CASCADE NOT NULL,
  holds JSONB NOT NULL DEFAULT '{"hand_holds":[],"foot_holds":[]}'::jsonb,  -- {hand_holds: [...], foot_holds: [...]}
  user_id UUID REFERENCES auth.users NOT NULL,
  is_draft BOOLEAN NOT NULL DEFAULT true
);

-- User profiles table (display names and account settings)
CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT CHECK (display_name IS NULL OR char_length(display_name) <= 50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Sends table (tracks when a user completes a route)
CREATE TABLE sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  quality_rating SMALLINT CHECK (quality_rating >= 1 AND quality_rating <= 5),
  difficulty_rating SMALLINT CHECK (difficulty_rating >= -1 AND difficulty_rating <= 1),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, route_id)
);

-- Comments table (user comments on routes)
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  text TEXT NOT NULL CHECK (char_length(text) > 0 AND char_length(text) <= 500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- App config table (singleton row for remote config like force-update)
CREATE TABLE app_config (
  singleton_key BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton_key = true),
  min_version TEXT NOT NULL DEFAULT '0.0.0',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Seed the single config row
INSERT INTO app_config (min_version) VALUES ('0.0.0');

-- User activity table (tracks app version and last seen per user)
CREATE TABLE user_activity (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  app_version TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios')),
  os_version TEXT,
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_photos_user_id ON photos(user_id);
CREATE INDEX idx_photos_dates ON photos(setup_date, teardown_date);
CREATE INDEX idx_detected_holds_photo_id ON detected_holds(photo_id);
CREATE INDEX idx_routes_photo_id ON routes(photo_id);
CREATE INDEX idx_routes_user_id ON routes(user_id);
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_sends_route_id ON sends(route_id);
CREATE INDEX idx_sends_user_id ON sends(user_id);
CREATE INDEX idx_comments_route_id ON comments(route_id);
CREATE INDEX idx_comments_route_created ON comments(route_id, created_at DESC);
CREATE INDEX idx_user_activity_last_seen ON user_activity(last_seen_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE detected_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES: admins
-- ============================================================================

CREATE POLICY "Admins can view admins table"
  ON admins FOR SELECT
  USING (user_id = auth.uid());

-- ============================================================================
-- RLS POLICIES: photos
-- ============================================================================

CREATE POLICY "Photos are viewable by everyone"
  ON photos FOR SELECT
  USING (true);

CREATE POLICY "Only admins can insert photos"
  ON photos FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
  );

CREATE POLICY "Only admins can update photos"
  ON photos FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
  );

CREATE POLICY "Only admins can delete photos"
  ON photos FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
  );

-- ============================================================================
-- RLS POLICIES: detected_holds
-- ============================================================================

CREATE POLICY "Detected holds are viewable by everyone"
  ON detected_holds FOR SELECT
  USING (true);

CREATE POLICY "Only admins can insert detected holds"
  ON detected_holds FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
  );

CREATE POLICY "Only admins can update detected holds"
  ON detected_holds FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
  );

CREATE POLICY "Only admins can delete detected holds"
  ON detected_holds FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
  );

-- ============================================================================
-- RLS POLICIES: routes
-- ============================================================================

CREATE POLICY "Published routes viewable by everyone, drafts by owner"
  ON routes FOR SELECT
  USING (
    is_draft = false
    OR auth.uid() = user_id
  );

CREATE POLICY "Users can insert routes"
  ON routes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own routes"
  ON routes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own routes"
  ON routes FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- RLS POLICIES: user_profiles
-- ============================================================================

CREATE POLICY "User profiles are viewable by everyone"
  ON user_profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- RLS POLICIES: sends
-- ============================================================================

CREATE POLICY "Sends are viewable by everyone"
  ON sends FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own sends"
  ON sends FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sends"
  ON sends FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sends"
  ON sends FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- RLS POLICIES: comments
-- ============================================================================

CREATE POLICY "Comments are viewable by everyone"
  ON comments FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own comments"
  ON comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
  ON comments FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- RLS POLICIES: app_config
-- ============================================================================

CREATE POLICY "App config is readable by everyone"
  ON app_config FOR SELECT
  USING (true);

CREATE POLICY "Only admins can update app config"
  ON app_config FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
  );

-- ============================================================================
-- RLS POLICIES: user_activity
-- ============================================================================

CREATE POLICY "Users can view their own activity"
  ON user_activity FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity"
  ON user_activity FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own activity"
  ON user_activity FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all activity"
  ON user_activity FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
  );

-- ============================================================================
-- COMPUTED COLUMN FUNCTIONS (PostgREST virtual columns)
-- ============================================================================

-- Average quality rating for a route (computed from sends)
CREATE OR REPLACE FUNCTION avg_rating(route routes)
RETURNS NUMERIC AS $$
  SELECT AVG(s.quality_rating)::NUMERIC
  FROM sends s
  WHERE s.route_id = route.id
    AND s.quality_rating IS NOT NULL;
$$ LANGUAGE sql STABLE;

-- Number of sends for a route
CREATE OR REPLACE FUNCTION send_count(route routes)
RETURNS BIGINT AS $$
  SELECT COUNT(*)
  FROM sends s
  WHERE s.route_id = route.id;
$$ LANGUAGE sql STABLE;

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Increment holds_version on detected_holds changes
CREATE OR REPLACE FUNCTION increment_holds_version()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE photos
  SET holds_version = holds_version + 1
  WHERE id = COALESCE(NEW.photo_id, OLD.photo_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER detected_holds_version_trigger
  AFTER INSERT OR UPDATE OR DELETE ON detected_holds
  FOR EACH ROW
  EXECUTE FUNCTION increment_holds_version();

-- Auto-update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for user_profiles
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- POST-SETUP: Add yourself as admin
-- ============================================================================
--
-- 1. Sign up in the app to create a user account
-- 2. Get your user ID from: Authentication > Users in Supabase dashboard
-- 3. Run this SQL (replace YOUR_USER_ID with your actual UUID):
--
--    INSERT INTO admins (user_id) VALUES ('YOUR_USER_ID');
--
-- ============================================================================

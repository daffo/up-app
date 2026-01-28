-- UP App Database Schema (Current State)
-- Run this on a fresh Supabase project to set up the complete database
-- This is equivalent to running all migrations (000-004) in sequence
--
-- Last updated: After migration-004-sends-comments

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
  setup_date DATE NOT NULL,
  teardown_date DATE,
  user_id UUID REFERENCES auth.users NOT NULL
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
  title TEXT NOT NULL,
  description TEXT,
  grade TEXT NOT NULL,
  photo_id UUID REFERENCES photos(id) ON DELETE CASCADE NOT NULL,
  holds JSONB NOT NULL DEFAULT '[]'::jsonb,  -- Array of {order, detected_hold_id, labelX, labelY, note?}
  user_id UUID REFERENCES auth.users NOT NULL
);

-- User profiles table (display names and account settings)
CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT,
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
  text TEXT NOT NULL CHECK (char_length(text) > 0),
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

CREATE POLICY "Routes are viewable by everyone"
  ON routes FOR SELECT
  USING (true);

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
-- FUNCTIONS & TRIGGERS
-- ============================================================================

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

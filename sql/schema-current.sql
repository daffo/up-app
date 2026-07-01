-- UP App Database Schema (Current State)
-- Run this on a fresh Supabase project to set up the complete database
-- This is equivalent to running all migrations (000-004) in sequence
--
-- Last updated: After migration-013-stats-on-logs

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

-- Logs table (FEAT-2 — replaces sends. A log represents any interaction:
-- sent or attempted. Quality rating is optional and independent of status.
-- Difficulty rating only set when status='sent'. Fall hold only when
-- status='attempted'. One log per (user, route); re-log overrides.)
CREATE TABLE logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('sent', 'attempted')),
  quality_rating SMALLINT CHECK (quality_rating BETWEEN 1 AND 5),
  difficulty_rating SMALLINT CHECK (difficulty_rating BETWEEN -1 AND 1),
  fall_hold_id UUID REFERENCES detected_holds(id) ON DELETE SET NULL,
  logged_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, route_id),
  CHECK (status = 'sent' OR difficulty_rating IS NULL),
  CHECK (status = 'attempted' OR fall_hold_id IS NULL)
);

-- Bookmarks table (FEAT-2 — per-user saved routes, independent from logs)
CREATE TABLE bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
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
CREATE INDEX idx_logs_route_id ON logs(route_id);
CREATE INDEX idx_logs_user_id ON logs(user_id);
CREATE INDEX idx_logs_status ON logs(status);
CREATE INDEX idx_logs_route_status ON logs(route_id, status);
CREATE INDEX idx_bookmarks_user_id ON bookmarks(user_id);
CREATE INDEX idx_bookmarks_route_id ON bookmarks(route_id);
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
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
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
-- RLS POLICIES: logs
-- ============================================================================

CREATE POLICY "Logs are viewable by everyone"
  ON logs FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own logs"
  ON logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own logs"
  ON logs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own logs"
  ON logs FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- RLS POLICIES: bookmarks
-- ============================================================================

CREATE POLICY "Users can view their own bookmarks"
  ON bookmarks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bookmarks"
  ON bookmarks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bookmarks"
  ON bookmarks FOR DELETE
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

-- Average quality rating for a route (any log status — attempts can rate too)
CREATE OR REPLACE FUNCTION avg_rating(route routes)
RETURNS NUMERIC AS $$
  SELECT AVG(l.quality_rating)::NUMERIC
  FROM logs l
  WHERE l.route_id = route.id
    AND l.quality_rating IS NOT NULL;
$$ LANGUAGE sql STABLE;

-- Number of sends for a route (status='sent')
CREATE OR REPLACE FUNCTION send_count(route routes)
RETURNS BIGINT AS $$
  SELECT COUNT(*)
  FROM logs l
  WHERE l.route_id = route.id
    AND l.status = 'sent';
$$ LANGUAGE sql STABLE;

-- Number of attempts for a route (status='attempted')
CREATE OR REPLACE FUNCTION attempt_count(route routes)
RETURNS BIGINT AS $$
  SELECT COUNT(*)
  FROM logs l
  WHERE l.route_id = route.id
    AND l.status = 'attempted';
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
-- BADGES (FEAT-3) — DB-authoritative gamification
-- ============================================================================

-- Catalog: one row per badge definition
CREATE TABLE badges (
  key        TEXT PRIMARY KEY,        -- 'first_send', 'sends_10', ...
  category   TEXT NOT NULL,           -- 'send' | 'attempt' | 'creator' | 'community' | 'social'
  threshold  INT,                     -- count needed (NULL for boolean badges)
  sort_order INT NOT NULL DEFAULT 0   -- display ordering
);

-- Earned rows: one per (user, badge)
CREATE TABLE user_badges (
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_key TEXT NOT NULL REFERENCES badges(key),
  earned_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  seen      BOOLEAN NOT NULL DEFAULT false,  -- false until the unlock toast is shown
  PRIMARY KEY (user_id, badge_key)
);

CREATE INDEX idx_user_badges_user ON user_badges(user_id);

ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Badges are viewable by everyone"
  ON badges FOR SELECT
  USING (true);

CREATE POLICY "User badges are viewable by everyone"
  ON user_badges FOR SELECT
  USING (true);

-- No client INSERT: awarding happens only via the SECURITY DEFINER helper.
CREATE POLICY "Users can mark their own badges seen"
  ON user_badges FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own badges"
  ON user_badges FOR DELETE
  USING (auth.uid() = user_id);

-- Seed catalog (16 badges)
INSERT INTO badges (key, category, threshold, sort_order) VALUES
  ('first_send',          'send',      1,    10),
  ('sends_10',            'send',      10,   20),
  ('sends_25',            'send',      25,   30),
  ('sends_50',            'send',      50,   40),
  ('sends_100',           'send',      100,  50),
  ('first_attempt',       'attempt',   1,    60),
  ('comeback',            'attempt',   NULL, 70),
  ('first_route',         'creator',   1,    80),
  ('routes_10',           'creator',   10,   90),
  ('sadist',              'challenge', 10,   95),
  ('first_comment',       'community', 1,    100),
  ('route_sent_by_other', 'social',    NULL, 110),
  ('grade_5',             'grade',     5,    51),
  ('grade_6',             'grade',     6,    52),
  ('grade_7',             'grade',     7,    53),
  ('grade_8',             'grade',     8,    54);

-- Idempotent awarding helper (bypasses RLS via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION award_badge(p_user_id UUID, p_key TEXT)
RETURNS VOID AS $$
  INSERT INTO user_badges (user_id, badge_key)
  VALUES (p_user_id, p_key)
  ON CONFLICT (user_id, badge_key) DO NOTHING;
$$ LANGUAGE sql SECURITY DEFINER;

-- Count a user's "sandbagged" published routes (>= 1 attempt, 0 sends).
CREATE OR REPLACE FUNCTION sandbagged_route_count(p_owner UUID)
RETURNS INT AS $$
  SELECT COUNT(*)::INT
  FROM routes r
  WHERE r.user_id = p_owner
    AND r.is_draft = false
    AND EXISTS (
      SELECT 1 FROM logs l
      WHERE l.route_id = r.id AND l.status = 'attempted'
    )
    AND NOT EXISTS (
      SELECT 1 FROM logs l
      WHERE l.route_id = r.id AND l.status = 'sent'
    );
$$ LANGUAGE sql STABLE;

-- Trigger: logs (send milestones, first attempt, comeback, crowd pleaser, sadist)
CREATE OR REPLACE FUNCTION award_badges_from_log()
RETURNS TRIGGER AS $$
DECLARE
  sent_total INT;
  route_owner UUID;
  max_grade INT;
BEGIN
  IF NEW.status = 'sent' THEN
    SELECT COUNT(*) INTO sent_total
    FROM logs
    WHERE user_id = NEW.user_id AND status = 'sent';

    PERFORM award_badge(NEW.user_id, b.key)
    FROM badges b
    WHERE b.category = 'send' AND b.threshold <= sent_total;

    -- Grade ladder: highest French grade number among the user's sent routes.
    SELECT MAX(NULLIF(substring(r.grade from '^\s*([0-9]+)'), '')::int)
      INTO max_grade
    FROM logs l
    JOIN routes r ON r.id = l.route_id
    WHERE l.user_id = NEW.user_id AND l.status = 'sent';

    IF max_grade IS NOT NULL THEN
      PERFORM award_badge(NEW.user_id, b.key)
      FROM badges b
      WHERE b.category = 'grade' AND b.threshold <= max_grade;
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.status = 'attempted' THEN
      PERFORM award_badge(NEW.user_id, 'comeback');
    END IF;

    SELECT user_id INTO route_owner FROM routes WHERE id = NEW.route_id;
    IF route_owner IS NOT NULL AND route_owner <> NEW.user_id THEN
      PERFORM award_badge(route_owner, 'route_sent_by_other');
    END IF;
  END IF;

  IF NEW.status = 'attempted' THEN
    PERFORM award_badge(NEW.user_id, 'first_attempt');
  END IF;

  -- Sadist: evaluate for the owner of the affected route.
  SELECT user_id INTO route_owner FROM routes WHERE id = NEW.route_id;
  IF route_owner IS NOT NULL AND sandbagged_route_count(route_owner) >= 10 THEN
    PERFORM award_badge(route_owner, 'sadist');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER logs_award_badges
AFTER INSERT OR UPDATE ON logs
FOR EACH ROW EXECUTE FUNCTION award_badges_from_log();

-- Trigger: routes (creator milestones)
CREATE OR REPLACE FUNCTION award_badges_from_route()
RETURNS TRIGGER AS $$
DECLARE
  route_total INT;
BEGIN
  SELECT COUNT(*) INTO route_total
  FROM routes
  WHERE user_id = NEW.user_id AND is_draft = false;

  PERFORM award_badge(NEW.user_id, b.key)
  FROM badges b
  WHERE b.category = 'creator' AND b.threshold <= route_total;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER routes_award_badges
AFTER INSERT OR UPDATE ON routes
FOR EACH ROW EXECUTE FUNCTION award_badges_from_route();

-- Trigger: comments (first comment)
CREATE OR REPLACE FUNCTION award_badges_from_comment()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM award_badge(NEW.user_id, 'first_comment');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER comments_award_badges
AFTER INSERT ON comments
FOR EACH ROW EXECUTE FUNCTION award_badges_from_comment();

-- Showcase badge: one earned badge a user displays next to their name.
ALTER TABLE user_profiles
  ADD COLUMN showcase_badge_key TEXT REFERENCES badges(key);

CREATE OR REPLACE FUNCTION enforce_showcase_badge_earned()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.showcase_badge_key IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM user_badges
    WHERE user_id = NEW.user_id AND badge_key = NEW.showcase_badge_key
  ) THEN
    RAISE EXCEPTION 'showcase_badge_key must reference a badge earned by the user';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_profiles_showcase_badge_check
BEFORE INSERT OR UPDATE ON user_profiles
FOR EACH ROW EXECUTE FUNCTION enforce_showcase_badge_earned();

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

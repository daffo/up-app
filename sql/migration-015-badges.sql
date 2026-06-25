-- Migration 015: Account badges (FEAT-3)
--
-- DB-authoritative gamification. The badge catalog and awarding rules live
-- entirely in Postgres. Triggers on logs/routes/comments evaluate criteria on
-- every write and award badges idempotently via a SECURITY DEFINER helper, so
-- users can never self-grant. The client only renders badges + the unlock toast.
--
-- Non-destructive. Safe to run on a live DB.

-- ============================================================================
-- 1. CATALOG TABLE
-- ============================================================================

CREATE TABLE badges (
  key        TEXT PRIMARY KEY,        -- 'first_send', 'sends_10', ...
  category   TEXT NOT NULL,           -- 'send' | 'attempt' | 'creator' | 'community' | 'social'
  threshold  INT,                     -- count needed (NULL for boolean badges)
  sort_order INT NOT NULL DEFAULT 0   -- display ordering
);

-- ============================================================================
-- 2. EARNED ROWS TABLE
-- ============================================================================

CREATE TABLE user_badges (
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_key TEXT NOT NULL REFERENCES badges(key),
  earned_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  seen      BOOLEAN NOT NULL DEFAULT false,  -- false until the unlock toast is shown
  PRIMARY KEY (user_id, badge_key)
);

CREATE INDEX idx_user_badges_user ON user_badges(user_id);

-- ============================================================================
-- 3. RLS
-- ============================================================================

ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

-- Catalog is public read, no client writes (seeded here / via migrations only).
CREATE POLICY "Badges are viewable by everyone"
  ON badges FOR SELECT
  USING (true);

-- Earned rows are public read (other users' profiles show earned badges).
CREATE POLICY "User badges are viewable by everyone"
  ON user_badges FOR SELECT
  USING (true);

-- No client INSERT policy: awarding happens only via the SECURITY DEFINER
-- helper below, which bypasses RLS. Users cannot self-award.

-- Users may UPDATE only the `seen` flag on their own rows (mark toast seen).
-- WITH CHECK keeps the row theirs; column-level "seen only" is enforced by the
-- API (it only ever sets seen) — RLS guards ownership.
CREATE POLICY "Users can mark their own badges seen"
  ON user_badges FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users may DELETE only their own rows (account deletion path).
CREATE POLICY "Users can delete their own badges"
  ON user_badges FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 4. SEED CATALOG (11 badges)
-- ============================================================================

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
  ('first_comment',       'community', 1,    100),
  ('route_sent_by_other', 'social',    NULL, 110);

-- ============================================================================
-- 5. AWARDING HELPER (SECURITY DEFINER)
--
-- Bypasses RLS so triggers can write user_badges for any user. Idempotent via
-- ON CONFLICT DO NOTHING on the (user_id, badge_key) primary key.
-- ============================================================================

CREATE OR REPLACE FUNCTION award_badge(p_user_id UUID, p_key TEXT)
RETURNS VOID AS $$
  INSERT INTO user_badges (user_id, badge_key)
  VALUES (p_user_id, p_key)
  ON CONFLICT (user_id, badge_key) DO NOTHING;
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================================================
-- 6. TRIGGER: logs (send milestones, first attempt, comeback, crowd pleaser)
-- ============================================================================

CREATE OR REPLACE FUNCTION award_badges_from_log()
RETURNS TRIGGER AS $$
DECLARE
  sent_total INT;
  route_owner UUID;
BEGIN
  IF NEW.status = 'sent' THEN
    -- Send milestones: award every threshold <= current sent count.
    SELECT COUNT(*) INTO sent_total
    FROM logs
    WHERE user_id = NEW.user_id AND status = 'sent';

    PERFORM award_badge(NEW.user_id, b.key)
    FROM badges b
    WHERE b.category = 'send' AND b.threshold <= sent_total;

    -- Comeback: an existing attempt upgraded to sent (UPDATE fires with OLD).
    IF TG_OP = 'UPDATE' AND OLD.status = 'attempted' THEN
      PERFORM award_badge(NEW.user_id, 'comeback');
    END IF;

    -- Crowd Pleaser: someone else sent a route you created.
    SELECT user_id INTO route_owner FROM routes WHERE id = NEW.route_id;
    IF route_owner IS NOT NULL AND route_owner <> NEW.user_id THEN
      PERFORM award_badge(route_owner, 'route_sent_by_other');
    END IF;
  END IF;

  IF NEW.status = 'attempted' THEN
    PERFORM award_badge(NEW.user_id, 'first_attempt');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER logs_award_badges
AFTER INSERT OR UPDATE ON logs
FOR EACH ROW EXECUTE FUNCTION award_badges_from_log();

-- ============================================================================
-- 7. TRIGGER: routes (creator milestones)
-- ============================================================================

CREATE OR REPLACE FUNCTION award_badges_from_route()
RETURNS TRIGGER AS $$
DECLARE
  route_total INT;
BEGIN
  SELECT COUNT(*) INTO route_total
  FROM routes
  WHERE user_id = NEW.user_id;

  PERFORM award_badge(NEW.user_id, b.key)
  FROM badges b
  WHERE b.category = 'creator' AND b.threshold <= route_total;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER routes_award_badges
AFTER INSERT ON routes
FOR EACH ROW EXECUTE FUNCTION award_badges_from_route();

-- ============================================================================
-- 8. TRIGGER: comments (first comment)
-- ============================================================================

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

-- ============================================================================
-- 9. BACKFILL (one-time, seen = true -> no retroactive toast spam)
--
-- Evaluates every count-based and boolean badge for all existing users from
-- current logs / routes / comments. Skips `comeback` (no reliable history).
-- ============================================================================

-- Send milestones (first_send, sends_10/25/50/100)
INSERT INTO user_badges (user_id, badge_key, seen)
SELECT l.user_id, b.key, true
FROM (
  SELECT user_id, COUNT(*) AS sent_total
  FROM logs WHERE status = 'sent'
  GROUP BY user_id
) l
JOIN badges b ON b.category = 'send' AND b.threshold <= l.sent_total
ON CONFLICT (user_id, badge_key) DO NOTHING;

-- First attempt
INSERT INTO user_badges (user_id, badge_key, seen)
SELECT DISTINCT user_id, 'first_attempt', true
FROM logs WHERE status = 'attempted'
ON CONFLICT (user_id, badge_key) DO NOTHING;

-- Creator milestones (first_route, routes_10)
INSERT INTO user_badges (user_id, badge_key, seen)
SELECT r.user_id, b.key, true
FROM (
  SELECT user_id, COUNT(*) AS route_total
  FROM routes
  GROUP BY user_id
) r
JOIN badges b ON b.category = 'creator' AND b.threshold <= r.route_total
ON CONFLICT (user_id, badge_key) DO NOTHING;

-- First comment
INSERT INTO user_badges (user_id, badge_key, seen)
SELECT DISTINCT user_id, 'first_comment', true
FROM comments
ON CONFLICT (user_id, badge_key) DO NOTHING;

-- Crowd Pleaser: route creators who had someone else send their route
INSERT INTO user_badges (user_id, badge_key, seen)
SELECT DISTINCT r.user_id, 'route_sent_by_other', true
FROM logs l
JOIN routes r ON r.id = l.route_id
WHERE l.status = 'sent' AND l.user_id <> r.user_id
ON CONFLICT (user_id, badge_key) DO NOTHING;

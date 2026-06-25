-- Migration 017: Add the Sadist badge + rename routes_10 to Architect (FEAT-3)
--
-- routes_10 keeps its key/criteria (create 10 routes) but is re-themed as
-- "Architect" (display copy only — handled in i18n).
--
-- New `sadist` badge: awarded to a route CREATOR once 10 of their published
-- routes have been attempted but never sent (pure spray-wall sandbagging).
-- Because the criteria depends on logs (attempts/sends), it is evaluated in
-- the logs trigger for the route owner — NOT the routes trigger. It uses a new
-- `challenge` category so the generic creator-milestone loop never touches it.
--
-- Non-destructive. Idempotent awarding via award_badge(). Includes a backfill.

-- ============================================================================
-- 1. CATALOG: add the sadist badge
-- ============================================================================

INSERT INTO badges (key, category, threshold, sort_order) VALUES
  ('sadist', 'challenge', 10, 95)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 2. Helper: count a user's "sandbagged" published routes
--    (>= 1 attempt, 0 sends). Reused by the trigger and the backfill.
-- ============================================================================

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

-- ============================================================================
-- 3. Extend the logs trigger to also evaluate Sadist for the route owner.
--    (Full function redefinition — keeps the existing awards intact.)
-- ============================================================================

CREATE OR REPLACE FUNCTION award_badges_from_log()
RETURNS TRIGGER AS $$
DECLARE
  sent_total INT;
  route_owner UUID;
BEGIN
  IF NEW.status = 'sent' THEN
    SELECT COUNT(*) INTO sent_total
    FROM logs
    WHERE user_id = NEW.user_id AND status = 'sent';

    PERFORM award_badge(NEW.user_id, b.key)
    FROM badges b
    WHERE b.category = 'send' AND b.threshold <= sent_total;

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

-- ============================================================================
-- 4. BACKFILL: award Sadist to anyone already at >= 10 sandbagged routes.
--    seen = true (no retroactive toast spam).
-- ============================================================================

INSERT INTO user_badges (user_id, badge_key, seen)
SELECT r.user_id, 'sadist', true
FROM routes r
WHERE r.is_draft = false
GROUP BY r.user_id
HAVING sandbagged_route_count(r.user_id) >= 10
ON CONFLICT (user_id, badge_key) DO NOTHING;

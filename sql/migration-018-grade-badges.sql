-- Migration 018: Grade badges (French grade ladder) — FEAT-3 follow-up
--
-- Adds a second send progression: the GRADE ladder (grade_5/6/7/8), awarded on
-- the highest French grade number a user has SENT. Coexists with the existing
-- count ladder (sends_10/25/50/100), which is unchanged here — its monkey
-- rename is client-only i18n. first_send is untouched.
--
-- Grade is free text on routes.grade (French: 5a, 6a+, 7b, ...). Only the
-- leading number matters. Non-French / unparseable grades -> NULL -> ignored.
-- This regex mirrors utils/grade.ts::parseFrenchGradeNumber — keep in sync.
--
-- Non-destructive. Idempotent awarding via award_badge(). Includes a backfill.

-- ============================================================================
-- 1. CATALOG: add the four grade badges (new `grade` category).
-- ============================================================================
INSERT INTO badges (key, category, threshold, sort_order) VALUES
  ('grade_5', 'grade', 5, 51),
  ('grade_6', 'grade', 6, 52),
  ('grade_7', 'grade', 7, 53),
  ('grade_8', 'grade', 8, 54)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 2. Redefine the logs trigger to also evaluate the grade ladder.
--    Full redefinition — keeps every existing award from migration 015/017.
-- ============================================================================
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

-- ============================================================================
-- 3. BACKFILL grade tiers for existing users (seen = true -> no toast spam).
-- ============================================================================
INSERT INTO user_badges (user_id, badge_key, seen)
SELECT g.user_id, b.key, true
FROM (
  SELECT l.user_id,
         MAX(NULLIF(substring(r.grade from '^\s*([0-9]+)'), '')::int) AS max_grade
  FROM logs l
  JOIN routes r ON r.id = l.route_id
  WHERE l.status = 'sent'
  GROUP BY l.user_id
) g
JOIN badges b ON b.category = 'grade' AND b.threshold <= g.max_grade
WHERE g.max_grade IS NOT NULL
ON CONFLICT (user_id, badge_key) DO NOTHING;

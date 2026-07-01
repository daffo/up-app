-- Migration 019: Correct earned_at for backfilled grade badges (FEAT-3)
--
-- Migration 018's backfill stamped earned_at = now() for grade_5/6/7/8 (same
-- gap migration 016 fixed for the original 12 badges). The real moment is the
-- earliest sent log whose route's parsed French grade already met the
-- threshold. Uses LEAST(earned_at, derived) so it can only move a timestamp
-- EARLIER — organically-awarded rows (already accurate, earned after this
-- migration runs) are never pushed later. Idempotent: safe to re-run.

WITH grade_crossings AS (
  SELECT
    l.user_id,
    b.key AS badge_key,
    MIN(l.logged_at) AS at
  FROM logs l
  JOIN routes r ON r.id = l.route_id
  JOIN badges b
    ON b.category = 'grade'
    AND b.threshold <= NULLIF(substring(r.grade from '^\s*([0-9]+)'), '')::int
  WHERE l.status = 'sent'
  GROUP BY l.user_id, b.key
)
UPDATE user_badges ub
SET earned_at = LEAST(ub.earned_at, gc.at)
FROM grade_crossings gc
WHERE ub.user_id = gc.user_id
  AND ub.badge_key = gc.badge_key;

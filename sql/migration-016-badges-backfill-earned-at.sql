-- Migration 016: Correct earned_at for backfilled badges (FEAT-3)
--
-- Migration 015's backfill stamped earned_at = now(). For most badges the real
-- moment is recoverable from the source rows (logs / routes / comments). Each
-- UPDATE uses LEAST(earned_at, <derived>) so it can only move a timestamp
-- EARLIER — organically-awarded rows (already accurate) are never pushed later.
-- Idempotent: safe to re-run.
--
-- Notes / limitations:
--   - `comeback` has no reliable history -> left as-is.
--   - Creator badges use route.created_at as an approximation: drafts are
--     published via an untracked UPDATE, so the exact publish time is unknown.

-- ============================================================================
-- Send milestones: earned_at = logged_at of the threshold-crossing sent log
-- (the Nth sent log per user, ordered chronologically).
-- ============================================================================

WITH ranked AS (
  SELECT
    user_id,
    logged_at,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY logged_at, id) AS n
  FROM logs
  WHERE status = 'sent'
)
UPDATE user_badges ub
SET earned_at = LEAST(ub.earned_at, r.logged_at)
FROM badges b
JOIN ranked r ON r.n = b.threshold
WHERE ub.badge_key = b.key
  AND b.category = 'send'
  AND ub.user_id = r.user_id;

-- ============================================================================
-- First attempt: earned_at = logged_at of the user's first attempted log.
-- ============================================================================

WITH first_attempt AS (
  SELECT user_id, MIN(logged_at) AS at
  FROM logs
  WHERE status = 'attempted'
  GROUP BY user_id
)
UPDATE user_badges ub
SET earned_at = LEAST(ub.earned_at, fa.at)
FROM first_attempt fa
WHERE ub.badge_key = 'first_attempt'
  AND ub.user_id = fa.user_id;

-- ============================================================================
-- First comment: earned_at = created_at of the user's first comment.
-- ============================================================================

WITH first_comment AS (
  SELECT user_id, MIN(created_at) AS at
  FROM comments
  GROUP BY user_id
)
UPDATE user_badges ub
SET earned_at = LEAST(ub.earned_at, fc.at)
FROM first_comment fc
WHERE ub.badge_key = 'first_comment'
  AND ub.user_id = fc.user_id;

-- ============================================================================
-- Creator milestones: earned_at = created_at of the Nth published route
-- (approximation — see header note on publish time).
-- ============================================================================

WITH ranked AS (
  SELECT
    user_id,
    created_at,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at, id) AS n
  FROM routes
  WHERE is_draft = false
)
UPDATE user_badges ub
SET earned_at = LEAST(ub.earned_at, r.created_at)
FROM badges b
JOIN ranked r ON r.n = b.threshold
WHERE ub.badge_key = b.key
  AND b.category = 'creator'
  AND ub.user_id = r.user_id;

-- ============================================================================
-- Crowd Pleaser: earned_at = the earliest time another user sent one of your
-- published routes.
-- ============================================================================

WITH first_other_send AS (
  SELECT r.user_id AS owner_id, MIN(l.logged_at) AS at
  FROM logs l
  JOIN routes r ON r.id = l.route_id
  WHERE l.status = 'sent' AND l.user_id <> r.user_id
  GROUP BY r.user_id
)
UPDATE user_badges ub
SET earned_at = LEAST(ub.earned_at, fos.at)
FROM first_other_send fos
WHERE ub.badge_key = 'route_sent_by_other'
  AND ub.user_id = fos.owner_id;

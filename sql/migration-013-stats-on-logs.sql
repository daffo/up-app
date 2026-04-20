-- Migration 013: Point route stats at `logs` and add attempt_count (FEAT-2)
--
-- Redefines PostgREST computed columns so they read from `logs` instead
-- of `sends`. Both old and new app will see full picture (old-app writes
-- reach `logs` via sends_to_logs_sync trigger from migration 012).
--
-- Non-destructive: CREATE OR REPLACE keeps the functions exposed to
-- PostgREST without a cache reload.

-- Average quality rating for a route (any log status — attempts can rate too)
CREATE OR REPLACE FUNCTION avg_rating(route routes)
RETURNS NUMERIC AS $$
  SELECT AVG(l.quality_rating)::NUMERIC
  FROM logs l
  WHERE l.route_id = route.id
    AND l.quality_rating IS NOT NULL;
$$ LANGUAGE sql STABLE;

-- Number of sends for a route (status='sent' only)
CREATE OR REPLACE FUNCTION send_count(route routes)
RETURNS BIGINT AS $$
  SELECT COUNT(*)
  FROM logs l
  WHERE l.route_id = route.id
    AND l.status = 'sent';
$$ LANGUAGE sql STABLE;

-- Number of attempts for a route (status='attempted' only)
CREATE OR REPLACE FUNCTION attempt_count(route routes)
RETURNS BIGINT AS $$
  SELECT COUNT(*)
  FROM logs l
  WHERE l.route_id = route.id
    AND l.status = 'attempted';
$$ LANGUAGE sql STABLE;

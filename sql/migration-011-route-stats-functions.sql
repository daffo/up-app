-- Migration 011: Add computed column functions for route stats
-- PostgREST exposes these as virtual/computed columns on the routes table.
-- Usage in Supabase client: .select('*, avg_rating, send_count')

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

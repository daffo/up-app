CREATE OR REPLACE FUNCTION avg_rating(route routes)
RETURNS NUMERIC AS $$
  SELECT AVG(l.quality_rating)::NUMERIC
  FROM logs l
  WHERE l.route_id = route.id
    AND l.status = 'sent'
    AND l.quality_rating IS NOT NULL;
$$ LANGUAGE sql STABLE;

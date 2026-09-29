-- Migration 025: grade_rank on routes for list sorting
-- grade stays free text. Rank reads only the leading French grade, rest ignored
-- (6b? = 6b, 5c+/6a = 5c+). Bare number sits below its "a": 5c+ < 6 < 6a.
-- No leading French grade (?, V5) = NULL, sorted last both directions.
-- Rank = number*10 + letter (a=2, b=4, c=6) + 1 for "+".
-- Redefining parse_grade_rank does not recompute stored values: rerun
-- UPDATE routes SET grade = grade after changing it.

CREATE OR REPLACE FUNCTION parse_grade_rank(grade TEXT)
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT m[1]::int * 10
    + COALESCE(CASE lower(m[2]) WHEN 'a' THEN 2 WHEN 'b' THEN 4 WHEN 'c' THEN 6 END, 0)
    + CASE WHEN m[3] IS NOT NULL THEN 1 ELSE 0 END
  FROM (SELECT regexp_match(grade, '^\s*([0-9]+)([abcABC])?(\+)?')) AS r(m);
$$;

ALTER TABLE routes ADD COLUMN IF NOT EXISTS grade_rank INT
  GENERATED ALWAYS AS (parse_grade_rank(grade)) STORED;

CREATE INDEX IF NOT EXISTS idx_routes_grade_rank
  ON routes(grade_rank, created_at, id);

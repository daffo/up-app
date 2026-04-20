-- Migration 012: Add logs and bookmarks tables (FEAT-2)
--
-- Strategy: coexistence + one-way sync
--   - `sends` stays as-is (live app keeps writing to it)
--   - `logs` is a new table; sends are a subset (status='sent')
--   - Trigger mirrors sends -> logs one way
--   - New app writes directly to `logs` (and stops writing to `sends`)
--   - After adoption threshold, drop trigger + sends (see future migration)
--
-- No destructive changes in this migration. Safe to run while old app is live.

-- ============================================================================
-- 1. LOGS TABLE
-- ============================================================================

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

CREATE INDEX idx_logs_route_id ON logs(route_id);
CREATE INDEX idx_logs_user_id ON logs(user_id);
CREATE INDEX idx_logs_status ON logs(status);
CREATE INDEX idx_logs_route_status ON logs(route_id, status);

-- RLS
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;

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
-- 2. BOOKMARKS TABLE
-- ============================================================================

CREATE TABLE bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, route_id)
);

CREATE INDEX idx_bookmarks_user_id ON bookmarks(user_id);
CREATE INDEX idx_bookmarks_route_id ON bookmarks(route_id);

ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

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
-- 3. BACKFILL: copy every existing send into logs as status='sent'
-- ============================================================================

INSERT INTO logs (id, user_id, route_id, status, quality_rating,
                  difficulty_rating, logged_at, created_at)
SELECT id, user_id, route_id, 'sent', quality_rating,
       difficulty_rating, sent_at, created_at
FROM sends
ON CONFLICT (user_id, route_id) DO NOTHING;

-- ============================================================================
-- 4. ONE-WAY SYNC TRIGGER: sends -> logs
--
-- Old app keeps writing to `sends`. This trigger mirrors every change into
-- `logs` so the new app (reading `logs`) stays consistent.
--
-- Not bidirectional: new-app writes to `logs` do NOT flow back to `sends`.
-- Acceptable during bridge — old app may see stale community data.
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_send_to_log()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    INSERT INTO logs (id, user_id, route_id, status, quality_rating,
                      difficulty_rating, fall_hold_id, logged_at, created_at)
    VALUES (NEW.id, NEW.user_id, NEW.route_id, 'sent', NEW.quality_rating,
            NEW.difficulty_rating, NULL, NEW.sent_at, NEW.created_at)
    ON CONFLICT (user_id, route_id) DO UPDATE SET
      status = 'sent',
      quality_rating = EXCLUDED.quality_rating,
      difficulty_rating = EXCLUDED.difficulty_rating,
      fall_hold_id = NULL,
      logged_at = EXCLUDED.logged_at;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM logs
    WHERE user_id = OLD.user_id AND route_id = OLD.route_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sends_to_logs_sync
AFTER INSERT OR UPDATE OR DELETE ON sends
FOR EACH ROW EXECUTE FUNCTION sync_send_to_log();

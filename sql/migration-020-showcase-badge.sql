-- Migration 020: Showcase badge (pick one earned badge to display next to
-- your name)
--
-- Adds a single nullable column on user_profiles. A trigger enforces that it
-- can only be set to a badge_key the user has actually earned (row exists in
-- user_badges) — same server-authoritative philosophy as badge awarding
-- itself: the client can request a change, but the DB decides if it's valid.
-- No RLS change needed: user_profiles is already owner-writable (the same
-- policy that lets a user freely set display_name covers this column too);
-- the trigger is the real guardrail, firing on both INSERT and UPDATE and
-- rejecting the write outright (not silently nulling it) so a client bug
-- surfaces immediately instead of failing silently.
--
-- Non-destructive. Safe to run on a live DB.

ALTER TABLE user_profiles
  ADD COLUMN showcase_badge_key TEXT REFERENCES badges(key);

CREATE OR REPLACE FUNCTION enforce_showcase_badge_earned()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.showcase_badge_key IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM user_badges
    WHERE user_id = NEW.user_id AND badge_key = NEW.showcase_badge_key
  ) THEN
    RAISE EXCEPTION 'showcase_badge_key must reference a badge earned by the user';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_profiles_showcase_badge_check
BEFORE INSERT OR UPDATE ON user_profiles
FOR EACH ROW EXECUTE FUNCTION enforce_showcase_badge_earned();

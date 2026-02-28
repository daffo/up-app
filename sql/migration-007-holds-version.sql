-- Migration 007: Add holds_version to photos for detected holds cache invalidation
--
-- This version counter increments automatically whenever detected_holds are
-- modified for a photo. Clients compare their cached version to decide
-- whether to re-fetch holds.

-- Add version column
ALTER TABLE photos ADD COLUMN holds_version INTEGER NOT NULL DEFAULT 0;

-- Trigger function: increment holds_version on the parent photo
CREATE OR REPLACE FUNCTION increment_holds_version()
RETURNS TRIGGER AS $$
BEGIN
  -- On DELETE, use OLD.photo_id; on INSERT/UPDATE, use NEW.photo_id
  UPDATE photos
  SET holds_version = holds_version + 1
  WHERE id = COALESCE(NEW.photo_id, OLD.photo_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger on detected_holds table
CREATE TRIGGER detected_holds_version_trigger
  AFTER INSERT OR UPDATE OR DELETE ON detected_holds
  FOR EACH ROW
  EXECUTE FUNCTION increment_holds_version();

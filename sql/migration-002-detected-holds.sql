-- Migration: Add detected_holds table and update holds structure
-- This migration adds support for automatic hold detection with polygon shapes

-- 1. Create detected_holds table (physical holds on the wall)
CREATE TABLE detected_holds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  photo_id UUID REFERENCES photos(id) ON DELETE CASCADE NOT NULL,
  polygon JSONB NOT NULL,           -- Array of {x, y} as percentages [0-100]
  center JSONB NOT NULL,            -- {x, y} as percentages (for display/sorting)
  dominant_color TEXT,              -- Optional: hex color (e.g., "#FF0000")
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create index for efficient queries by photo
CREATE INDEX idx_detected_holds_photo_id ON detected_holds(photo_id);

-- 3. Enable Row Level Security
ALTER TABLE detected_holds ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for detected_holds table

-- Everyone can view detected holds
CREATE POLICY "Detected holds are viewable by everyone"
  ON detected_holds FOR SELECT
  USING (true);

-- Only admins can insert detected holds
CREATE POLICY "Only admins can insert detected holds"
  ON detected_holds FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
  );

-- Only admins can update detected holds
CREATE POLICY "Only admins can update detected holds"
  ON detected_holds FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
  );

-- Only admins can delete detected holds
CREATE POLICY "Only admins can delete detected holds"
  ON detected_holds FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
  );

-- ============================================================================
-- NOTES ON HOLDS STRUCTURE CHANGE
-- ============================================================================
--
-- The routes.holds JSONB column structure is now:
-- [
--   {
--     "order": 1,
--     "detected_hold_id": "uuid-here",
--     "labelX": 15.5,
--     "labelY": 20.3,
--     "note": "optional note"
--   },
--   ...
-- ]
--
-- Old fields removed: holdX, holdY, radius
-- New field added: detected_hold_id (references detected_holds.id)
--
-- To render a hold, join with detected_holds table to get the polygon shape.
-- ============================================================================

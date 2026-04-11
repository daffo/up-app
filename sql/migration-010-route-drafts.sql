-- Migration 010: Add draft status to routes
-- New routes default to draft (is_draft = true). Existing routes are backfilled as published.

ALTER TABLE routes ADD COLUMN is_draft BOOLEAN NOT NULL DEFAULT true;

-- Backfill: all existing routes should be published
UPDATE routes SET is_draft = false;

-- Update SELECT policy: published routes visible to everyone, drafts only to owner
DROP POLICY "Routes are viewable by everyone" ON routes;
CREATE POLICY "Published routes viewable by everyone, drafts by owner"
  ON routes FOR SELECT
  USING (
    is_draft = false
    OR auth.uid() = user_id
  );

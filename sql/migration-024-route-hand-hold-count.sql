-- Migration 024: hand_hold_count on routes for list sorting
-- Generated from holds JSONB, Postgres keeps it in sync. Existing rows filled on ALTER.

ALTER TABLE routes ADD COLUMN IF NOT EXISTS hand_hold_count INT
  GENERATED ALWAYS AS (jsonb_array_length(holds->'hand_holds')) STORED;

CREATE INDEX IF NOT EXISTS idx_routes_hand_hold_count
  ON routes(hand_hold_count, created_at, id);

-- Migration: Update routes table to use new holds structure
-- This migration replaces coordinates column with holds

-- Drop old coordinates column
ALTER TABLE routes DROP COLUMN coordinates;

-- Add new holds column with detailed structure
-- Structure: [{order: number, holdX: number, holdY: number, labelX: number, labelY: number, radius: number, note?: string}]
ALTER TABLE routes ADD COLUMN holds JSONB NOT NULL DEFAULT '[]'::jsonb;

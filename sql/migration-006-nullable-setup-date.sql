-- Migration 006: Make setup_date nullable
-- This allows photos to be uploaded without a setup_date.
-- The photo lifecycle becomes: upload → detect holds → set setup_date → photo goes live

ALTER TABLE photos ALTER COLUMN setup_date DROP NOT NULL;

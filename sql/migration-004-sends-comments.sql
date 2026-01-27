-- Migration 004: Add sends and comments tables for route interactions
-- Run this in your Supabase SQL Editor

-- 1. Create sends table (tracks when a user completes a route)
CREATE TABLE sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  quality_rating SMALLINT CHECK (quality_rating >= 1 AND quality_rating <= 5),
  difficulty_rating SMALLINT CHECK (difficulty_rating >= -1 AND difficulty_rating <= 1),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, route_id)
);

-- 2. Create comments table (standalone comments on routes)
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  text TEXT NOT NULL CHECK (char_length(text) > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Enable Row Level Security
ALTER TABLE sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- 4. Sends RLS Policies

CREATE POLICY "Sends are viewable by everyone"
  ON sends FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own sends"
  ON sends FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sends"
  ON sends FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sends"
  ON sends FOR DELETE
  USING (auth.uid() = user_id);

-- 5. Comments RLS Policies

CREATE POLICY "Comments are viewable by everyone"
  ON comments FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own comments"
  ON comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
  ON comments FOR DELETE
  USING (auth.uid() = user_id);

-- 6. Create indexes for common queries
CREATE INDEX idx_sends_route_id ON sends(route_id);
CREATE INDEX idx_sends_user_id ON sends(user_id);
CREATE INDEX idx_comments_route_id ON comments(route_id);
CREATE INDEX idx_comments_route_created ON comments(route_id, created_at DESC);

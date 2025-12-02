-- Spray Wall Route Tracker Database Schema
-- Run this in your Supabase SQL Editor

-- 1. Create admins table (track who can manage photos)
CREATE TABLE admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create photos table (spray wall images with up period)
CREATE TABLE photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  image_url TEXT NOT NULL,
  setup_date DATE NOT NULL,
  teardown_date DATE,
  user_id UUID REFERENCES auth.users NOT NULL
);

-- 3. Create routes table (routes with hold coordinates)
CREATE TABLE routes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  grade TEXT NOT NULL,
  photo_id UUID REFERENCES photos(id) ON DELETE CASCADE NOT NULL,
  coordinates JSONB NOT NULL, -- Array of {x, y} coordinates
  user_id UUID REFERENCES auth.users NOT NULL
);

-- 4. Create indexes for better query performance
CREATE INDEX idx_routes_photo_id ON routes(photo_id);
CREATE INDEX idx_routes_user_id ON routes(user_id);
CREATE INDEX idx_photos_user_id ON photos(user_id);
CREATE INDEX idx_photos_dates ON photos(setup_date, teardown_date);

-- 5. Enable Row Level Security
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for admins table

-- Only admins can view the admins table
CREATE POLICY "Admins can view admins table"
  ON admins FOR SELECT
  USING (user_id = auth.uid());

-- 7. RLS Policies for photos table

-- Everyone can view photos
CREATE POLICY "Photos are viewable by everyone"
  ON photos FOR SELECT
  USING (true);

-- Only admins can insert photos
CREATE POLICY "Only admins can insert photos"
  ON photos FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
  );

-- Only admins can update photos
CREATE POLICY "Only admins can update photos"
  ON photos FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
  );

-- Only admins can delete photos
CREATE POLICY "Only admins can delete photos"
  ON photos FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
  );

-- 8. RLS Policies for routes table

-- Everyone can view routes
CREATE POLICY "Routes are viewable by everyone"
  ON routes FOR SELECT
  USING (true);

-- Authenticated users can insert routes
CREATE POLICY "Users can insert routes"
  ON routes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own routes
CREATE POLICY "Users can update their own routes"
  ON routes FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own routes
CREATE POLICY "Users can delete their own routes"
  ON routes FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- IMPORTANT: After running this SQL, you need to add yourself as an admin!
-- ============================================================================
--
-- 1. First, sign up in your app to create a user account
-- 2. Get your user ID from: Authentication > Users in Supabase dashboard
-- 3. Run this SQL (replace YOUR_USER_ID with your actual UUID):
--
--    INSERT INTO admins (user_id) VALUES ('YOUR_USER_ID');
--
-- Now you'll be able to upload and manage photos!

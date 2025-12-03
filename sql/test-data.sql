-- Add test photo and route
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new)

-- First, add a test photo
INSERT INTO photos (image_url, setup_date, user_id)
VALUES (
  'https://teekzobtticdptpmuflz.supabase.co/storage/v1/object/public/spray-wall-photos/test_spraywall.jpg',
  '2025-09-01',
  (SELECT id FROM auth.users LIMIT 1)
);

-- Then, add a test route referencing that photo
INSERT INTO routes (
  title,
  description,
  grade,
  photo_id,
  coordinates,
  user_id
)
VALUES (
  'The Crimper',
  'Fun crimpy route with technical footwork. Start with left hand on the blue crimp.',
  'V4',
  (SELECT id FROM photos ORDER BY created_at DESC LIMIT 1),
  '[
    {"x": 100, "y": 200},
    {"x": 150, "y": 300},
    {"x": 200, "y": 400},
    {"x": 250, "y": 500}
  ]'::jsonb,
  (SELECT id FROM auth.users LIMIT 1)
);

-- Add a second route for variety
INSERT INTO routes (
  title,
  description,
  grade,
  photo_id,
  coordinates,
  user_id
)
VALUES (
  'Slopey Goodness',
  'All about body tension and keeping your hips close to the wall.',
  'V6',
  (SELECT id FROM photos ORDER BY created_at DESC LIMIT 1),
  '[
    {"x": 120, "y": 180},
    {"x": 180, "y": 280},
    {"x": 240, "y": 380}
  ]'::jsonb,
  (SELECT id FROM auth.users LIMIT 1)
);

-- Add a third easier route
INSERT INTO routes (
  title,
  grade,
  photo_id,
  coordinates,
  user_id
)
VALUES (
  'Beginner Friendly',
  'V2',
  (SELECT id FROM photos ORDER BY created_at DESC LIMIT 1),
  '[
    {"x": 80, "y": 150},
    {"x": 140, "y": 250},
    {"x": 200, "y": 350},
    {"x": 260, "y": 450},
    {"x": 320, "y": 550}
  ]'::jsonb,
  (SELECT id FROM auth.users LIMIT 1)
);

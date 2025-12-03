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
  holds,
  user_id
)
VALUES (
  'The Crimper',
  'Fun crimpy route with technical footwork. Start with left hand on the blue crimp.',
  'V4',
  (SELECT id FROM photos ORDER BY created_at DESC LIMIT 1),
  '[
    {"order": 1, "holdX": 100, "holdY": 200, "labelX": 80, "labelY": 180, "note": "Start - LH"},
    {"order": 2, "holdX": 150, "holdY": 300, "labelX": 130, "labelY": 280, "note": "Crimp"},
    {"order": 3, "holdX": 200, "holdY": 400, "labelX": 180, "labelY": 380, "note": null},
    {"order": 4, "holdX": 250, "holdY": 500, "labelX": 230, "labelY": 480, "note": "Top"}
  ]'::jsonb,
  (SELECT id FROM auth.users LIMIT 1)
);

-- Add a second route for variety
INSERT INTO routes (
  title,
  description,
  grade,
  photo_id,
  holds,
  user_id
)
VALUES (
  'Slopey Goodness',
  'All about body tension and keeping your hips close to the wall.',
  'V6',
  (SELECT id FROM photos ORDER BY created_at DESC LIMIT 1),
  '[
    {"order": 1, "holdX": 120, "holdY": 180, "labelX": 100, "labelY": 160, "note": "Sloper start"},
    {"order": 2, "holdX": 180, "holdY": 280, "labelX": 160, "labelY": 260, "note": "Big move"},
    {"order": 3, "holdX": 240, "holdY": 380, "labelX": 220, "labelY": 360, "note": null}
  ]'::jsonb,
  (SELECT id FROM auth.users LIMIT 1)
);

-- Add a third easier route
INSERT INTO routes (
  title,
  grade,
  photo_id,
  holds,
  user_id
)
VALUES (
  'Beginner Friendly',
  'V2',
  (SELECT id FROM photos ORDER BY created_at DESC LIMIT 1),
  '[
    {"order": 1, "holdX": 80, "holdY": 150, "labelX": 60, "labelY": 130, "note": null},
    {"order": 2, "holdX": 140, "holdY": 250, "labelX": 120, "labelY": 230, "note": null},
    {"order": 3, "holdX": 200, "holdY": 350, "labelX": 180, "labelY": 330, "note": null},
    {"order": 4, "holdX": 260, "holdY": 450, "labelX": 240, "labelY": 430, "note": null},
    {"order": 5, "holdX": 320, "holdY": 550, "labelX": 300, "labelY": 530, "note": "Finish"}
  ]'::jsonb,
  (SELECT id FROM auth.users LIMIT 1)
);

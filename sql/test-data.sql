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
    {"order": 1, "holdX": 150, "holdY": 800, "labelX": 120, "labelY": 770, "radius": 20, "note": "Start - LH"},
    {"order": 2, "holdX": 250, "holdY": 650, "labelX": 280, "labelY": 630, "radius": 12, "note": "Crimp"},
    {"order": 3, "holdX": 180, "holdY": 500, "labelX": 150, "labelY": 470, "radius": 18, "note": null},
    {"order": 4, "holdX": 300, "holdY": 350, "labelX": 330, "labelY": 330, "radius": 15, "note": null},
    {"order": 5, "holdX": 220, "holdY": 200, "labelX": 190, "labelY": 170, "radius": 25, "note": "Top"}
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
    {"order": 1, "holdX": 350, "holdY": 750, "labelX": 380, "labelY": 730, "radius": 30, "note": "Sloper start"},
    {"order": 2, "holdX": 280, "holdY": 550, "labelX": 250, "labelY": 520, "radius": 22, "note": "Big move"},
    {"order": 3, "holdX": 400, "holdY": 400, "labelX": 430, "labelY": 380, "radius": 18, "note": null},
    {"order": 4, "holdX": 320, "holdY": 250, "labelX": 290, "labelY": 220, "radius": 28, "note": "Top out"}
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
    {"order": 1, "holdX": 200, "holdY": 850, "labelX": 170, "labelY": 820, "radius": 25, "note": null},
    {"order": 2, "holdX": 180, "holdY": 700, "labelX": 150, "labelY": 670, "radius": 20, "note": null},
    {"order": 3, "holdX": 220, "holdY": 550, "labelX": 250, "labelY": 530, "radius": 22, "note": null},
    {"order": 4, "holdX": 200, "holdY": 400, "labelX": 170, "labelY": 370, "radius": 18, "note": null},
    {"order": 5, "holdX": 240, "holdY": 280, "labelX": 270, "labelY": 260, "radius": 20, "note": null},
    {"order": 6, "holdX": 200, "holdY": 150, "labelX": 170, "labelY": 120, "radius": 30, "note": "Finish"}
  ]'::jsonb,
  (SELECT id FROM auth.users LIMIT 1)
);

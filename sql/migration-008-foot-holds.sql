-- Migration 008: Convert holds from array to object with hand_holds and foot_holds
-- This converts existing routes' holds JSONB from array format to object format

UPDATE routes
SET holds = jsonb_build_object(
  'hand_holds', holds,
  'foot_holds', '[]'::jsonb
)
WHERE jsonb_typeof(holds) = 'array';

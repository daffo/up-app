-- Migration 005: Add length constraints to text fields
-- Matches frontend validation: title (100), description (500), display_name (50), comment text (500)

-- Routes: title max 100 characters
ALTER TABLE routes
ADD CONSTRAINT routes_title_length CHECK (char_length(title) <= 100);

-- Routes: description max 500 characters
ALTER TABLE routes
ADD CONSTRAINT routes_description_length CHECK (description IS NULL OR char_length(description) <= 500);

-- User profiles: display_name max 50 characters
ALTER TABLE user_profiles
ADD CONSTRAINT user_profiles_display_name_length CHECK (display_name IS NULL OR char_length(display_name) <= 50);

-- Comments: text max 500 characters (already has > 0 check, replace with combined check)
ALTER TABLE comments
DROP CONSTRAINT IF EXISTS comments_text_check;

ALTER TABLE comments
ADD CONSTRAINT comments_text_length CHECK (char_length(text) > 0 AND char_length(text) <= 500);

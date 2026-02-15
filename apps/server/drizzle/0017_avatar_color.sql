-- Add avatar color preference to users table
ALTER TABLE users ADD COLUMN avatar_color TEXT NOT NULL DEFAULT 'blue';

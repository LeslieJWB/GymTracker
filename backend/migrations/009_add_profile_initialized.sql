ALTER TABLE users
ADD COLUMN IF NOT EXISTS profile_initialized BOOLEAN NOT NULL DEFAULT false;

UPDATE users
SET profile_initialized = false;

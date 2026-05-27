ALTER TABLE food_consumptions
  ADD COLUMN IF NOT EXISTS fat_g NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (fat_g >= 0);

ALTER TABLE records
  ADD COLUMN IF NOT EXISTS daily_fat_target_g NUMERIC(6, 2);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS daily_fat_target_g NUMERIC(6, 2);

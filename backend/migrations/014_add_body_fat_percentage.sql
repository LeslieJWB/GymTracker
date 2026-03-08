ALTER TABLE users
  ADD COLUMN IF NOT EXISTS default_body_fat_percentage NUMERIC(4, 1)
    CHECK (
      default_body_fat_percentage IS NULL
      OR (default_body_fat_percentage >= 3 AND default_body_fat_percentage <= 60)
    );

ALTER TABLE body_weight_records
  ADD COLUMN IF NOT EXISTS body_fat_percentage NUMERIC(4, 1)
    CHECK (
      body_fat_percentage IS NULL
      OR (body_fat_percentage >= 3 AND body_fat_percentage <= 60)
    );

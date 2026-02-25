ALTER TABLE exercise_items
  ALTER COLUMN name TYPE VARCHAR(255),
  ADD COLUMN IF NOT EXISTS source_id VARCHAR(150),
  ADD COLUMN IF NOT EXISTS image_path VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS exercise_items_source_id_unique
  ON exercise_items (source_id)
  WHERE source_id IS NOT NULL;

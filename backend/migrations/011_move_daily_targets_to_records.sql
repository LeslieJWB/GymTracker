ALTER TABLE records
  ADD COLUMN IF NOT EXISTS check_in_initialized BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS daily_calorie_target_kcal NUMERIC(7, 2),
  ADD COLUMN IF NOT EXISTS daily_protein_target_g NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS daily_target_source VARCHAR(20),
  ADD COLUMN IF NOT EXISTS daily_target_comment TEXT;

UPDATE records
SET check_in_initialized = true
WHERE theme IS NOT NULL
  AND btrim(theme) <> '';

ALTER TABLE users
  DROP COLUMN IF EXISTS daily_calorie_target_kcal,
  DROP COLUMN IF EXISTS daily_protein_target_g;

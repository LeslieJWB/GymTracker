ALTER TABLE users
  ADD COLUMN IF NOT EXISTS daily_calorie_target_kcal NUMERIC(7, 2),
  ADD COLUMN IF NOT EXISTS daily_protein_target_g NUMERIC(6, 2);

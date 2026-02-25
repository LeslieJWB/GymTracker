ALTER TABLE users
  ADD COLUMN IF NOT EXISTS supabase_user_id TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS auth_provider TEXT,
  ADD COLUMN IF NOT EXISTS height_cm NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS gender VARCHAR(30),
  ADD COLUMN IF NOT EXISTS default_body_weight_kg NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS global_llm_prompt TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_supabase_user_id_unique
  ON users (supabase_user_id)
  WHERE supabase_user_id IS NOT NULL;


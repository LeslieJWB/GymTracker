CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS records (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  record_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT records_user_date_unique UNIQUE (user_id, record_date)
);

CREATE TABLE IF NOT EXISTS exercise_items (
  id UUID PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  muscle_group VARCHAR(60),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS exercise_items_name_lower_unique
  ON exercise_items ((lower(name)));

CREATE TABLE IF NOT EXISTS exercises (
  id UUID PRIMARY KEY,
  record_id UUID NOT NULL REFERENCES records(id) ON DELETE CASCADE,
  exercise_item_id UUID NOT NULL REFERENCES exercise_items(id) ON DELETE RESTRICT,
  notes TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS exercises_record_sort_idx
  ON exercises (record_id, sort_order);

CREATE INDEX IF NOT EXISTS exercises_item_idx
  ON exercises (exercise_item_id);

CREATE TABLE IF NOT EXISTS exercise_sets (
  id UUID PRIMARY KEY,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  reps INT NOT NULL CHECK (reps > 0),
  weight NUMERIC(6, 2) NOT NULL CHECK (weight >= 0),
  set_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS exercise_sets_exercise_order_idx
  ON exercise_sets (exercise_id, set_order);

CREATE INDEX IF NOT EXISTS records_user_date_idx
  ON records (user_id, record_date DESC);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  response_status INT NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT idempotency_keys_unique UNIQUE (user_id, endpoint, idempotency_key)
);


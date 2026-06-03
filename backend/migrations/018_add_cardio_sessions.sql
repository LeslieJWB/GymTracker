CREATE TABLE IF NOT EXISTS cardio_sessions (
  id UUID PRIMARY KEY,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
  distance_km NUMERIC(8, 3) NULL CHECK (distance_km IS NULL OR distance_km >= 0),
  session_order INT NOT NULL DEFAULT 0,
  notes TEXT,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cardio_sessions_exercise_order_idx
  ON cardio_sessions (exercise_id, session_order);

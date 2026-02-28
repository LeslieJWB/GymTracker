CREATE TABLE IF NOT EXISTS body_weight_records (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  record_date DATE NOT NULL,
  weight_kg NUMERIC(6,2) NOT NULL CHECK (weight_kg >= 20 AND weight_kg <= 400),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, record_date)
);

CREATE INDEX IF NOT EXISTS idx_body_weight_records_user_date
  ON body_weight_records (user_id, record_date DESC);

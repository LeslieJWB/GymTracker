CREATE TABLE IF NOT EXISTS food_consumptions (
  id UUID PRIMARY KEY,
  record_id UUID NOT NULL REFERENCES records(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  input_mode TEXT NOT NULL CHECK (input_mode IN ('text', 'text_image', 'image')),
  image_mime_type TEXT,
  calories_kcal NUMERIC(10, 2) NOT NULL CHECK (calories_kcal >= 0),
  protein_g NUMERIC(10, 2) NOT NULL CHECK (protein_g >= 0),
  llm_comment TEXT NOT NULL,
  llm_source TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_food_consumptions_record_created_at
  ON food_consumptions (record_id, created_at DESC);

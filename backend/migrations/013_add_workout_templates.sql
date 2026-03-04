CREATE TABLE IF NOT EXISTS workout_templates (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS workout_templates_user_name_lower_unique
  ON workout_templates (user_id, lower(name));

CREATE INDEX IF NOT EXISTS workout_templates_user_updated_idx
  ON workout_templates (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS workout_template_exercises (
  id UUID PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
  exercise_item_id UUID NOT NULL REFERENCES exercise_items(id) ON DELETE RESTRICT,
  notes TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workout_template_exercises_template_sort_idx
  ON workout_template_exercises (template_id, sort_order, created_at ASC);

CREATE TABLE IF NOT EXISTS workout_template_sets (
  id UUID PRIMARY KEY,
  template_exercise_id UUID NOT NULL REFERENCES workout_template_exercises(id) ON DELETE CASCADE,
  reps INT NOT NULL CHECK (reps > 0),
  weight NUMERIC(6, 2) NOT NULL CHECK (weight >= 0),
  set_order INT NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workout_template_sets_exercise_order_idx
  ON workout_template_sets (template_exercise_id, set_order, created_at ASC);

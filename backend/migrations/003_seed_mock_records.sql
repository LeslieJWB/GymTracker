WITH generated_days AS (
  SELECT
    gs.day_offset,
    (CURRENT_DATE - make_interval(days => gs.day_offset))::date AS record_date
  FROM generate_series(0, 179) AS gs(day_offset)
),
seed_records AS (
  INSERT INTO records (id, user_id, record_date)
  SELECT
    (
      '30000000-0000-0000-0000-' ||
      lpad((generated_days.day_offset + 1)::text, 12, '0')
    )::uuid,
    '11111111-1111-1111-1111-111111111111'::uuid,
    generated_days.record_date
  FROM generated_days
  ON CONFLICT (user_id, record_date) DO NOTHING
  RETURNING id
)
SELECT COUNT(*) FROM seed_records;

WITH generated_days AS (
  SELECT
    gs.day_offset,
    (CURRENT_DATE - make_interval(days => gs.day_offset))::date AS record_date
  FROM generate_series(0, 179) AS gs(day_offset)
),
target_records AS (
  SELECT
    generated_days.day_offset,
    r.id AS record_id
  FROM generated_days
  JOIN records r
    ON r.user_id = '11111111-1111-1111-1111-111111111111'::uuid
   AND r.record_date = generated_days.record_date
),
seed_exercises AS (
  INSERT INTO exercises (id, record_id, exercise_item_id, notes, sort_order)
  SELECT
    (
      '31000000-0000-0000-0000-' ||
      lpad((target_records.day_offset + 1)::text, 12, '0')
    )::uuid,
    target_records.record_id,
    CASE
      WHEN target_records.day_offset % 2 = 0
        THEN '20000000-0000-0000-0000-000000000001'::uuid
      ELSE '20000000-0000-0000-0000-000000000003'::uuid
    END,
    CASE
      WHEN target_records.day_offset % 2 = 0
        THEN 'Seeded bench session'
      ELSE 'Seeded squat session'
    END,
    0
  FROM target_records
  ON CONFLICT (id) DO NOTHING
  RETURNING id
)
SELECT COUNT(*) FROM seed_exercises;

WITH generated_exercises AS (
  SELECT
    gs.day_offset,
    (
      '31000000-0000-0000-0000-' ||
      lpad((gs.day_offset + 1)::text, 12, '0')
    )::uuid AS exercise_id
  FROM generate_series(0, 179) AS gs(day_offset)
),
set_templates AS (
  SELECT 0 AS set_order, 8 AS reps
  UNION ALL
  SELECT 1, 6
  UNION ALL
  SELECT 2, 4
),
seed_sets AS (
  INSERT INTO exercise_sets (id, exercise_id, reps, weight, set_order)
  SELECT
    (
      '32000000-0000-0000-0000-' ||
      lpad(
        ((generated_exercises.day_offset * 10) + set_templates.set_order + 1)::text,
        12,
        '0'
      )
    )::uuid,
    generated_exercises.exercise_id,
    set_templates.reps,
    (50 + (generated_exercises.day_offset % 12) * 2)::numeric(6, 2),
    set_templates.set_order
  FROM generated_exercises
  JOIN exercises e ON e.id = generated_exercises.exercise_id
  CROSS JOIN set_templates
  ON CONFLICT (id) DO NOTHING
  RETURNING id
)
SELECT COUNT(*) FROM seed_sets;

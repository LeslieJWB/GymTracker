ALTER TABLE exercise_items
  ADD COLUMN IF NOT EXISTS category VARCHAR(60);

-- Remap legacy seed exercise_items to canonical free-exercise-db rows.
UPDATE exercises SET exercise_item_id = '6f202388-c38e-526a-aed6-d67aaab28286'
  WHERE exercise_item_id = '20000000-0000-0000-0000-000000000001';
UPDATE exercises SET exercise_item_id = '77d08b2f-47d9-581a-aab5-eb0c7d9ecc1b'
  WHERE exercise_item_id = '20000000-0000-0000-0000-000000000002';
UPDATE exercises SET exercise_item_id = '6effa02d-9fe7-5386-ab16-0487adef3422'
  WHERE exercise_item_id = '20000000-0000-0000-0000-000000000003';
UPDATE exercises SET exercise_item_id = 'd1efbb3a-ecf2-5c28-ada2-d57941a42cc3'
  WHERE exercise_item_id = '20000000-0000-0000-0000-000000000004';
UPDATE exercises SET exercise_item_id = 'eadbe5c4-b66a-5413-a0df-e1ef2ca05691'
  WHERE exercise_item_id = '20000000-0000-0000-0000-000000000005';
UPDATE exercises SET exercise_item_id = 'a5895a92-c36e-58db-a001-f43bee96a50c'
  WHERE exercise_item_id = '20000000-0000-0000-0000-000000000006';

UPDATE workout_template_exercises SET exercise_item_id = '6f202388-c38e-526a-aed6-d67aaab28286'
  WHERE exercise_item_id = '20000000-0000-0000-0000-000000000001';
UPDATE workout_template_exercises SET exercise_item_id = '77d08b2f-47d9-581a-aab5-eb0c7d9ecc1b'
  WHERE exercise_item_id = '20000000-0000-0000-0000-000000000002';
UPDATE workout_template_exercises SET exercise_item_id = '6effa02d-9fe7-5386-ab16-0487adef3422'
  WHERE exercise_item_id = '20000000-0000-0000-0000-000000000003';
UPDATE workout_template_exercises SET exercise_item_id = 'd1efbb3a-ecf2-5c28-ada2-d57941a42cc3'
  WHERE exercise_item_id = '20000000-0000-0000-0000-000000000004';
UPDATE workout_template_exercises SET exercise_item_id = 'eadbe5c4-b66a-5413-a0df-e1ef2ca05691'
  WHERE exercise_item_id = '20000000-0000-0000-0000-000000000005';
UPDATE workout_template_exercises SET exercise_item_id = 'a5895a92-c36e-58db-a001-f43bee96a50c'
  WHERE exercise_item_id = '20000000-0000-0000-0000-000000000006';

DELETE FROM exercise_items
WHERE id IN (
  '20000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000003',
  '20000000-0000-0000-0000-000000000004',
  '20000000-0000-0000-0000-000000000005',
  '20000000-0000-0000-0000-000000000006'
);

-- Remove dev mock user and seeded workout history.
DELETE FROM exercise_sets
WHERE exercise_id IN (
  SELECT e.id
  FROM exercises e
  JOIN records r ON r.id = e.record_id
  WHERE r.user_id = '11111111-1111-1111-1111-111111111111'
);

DELETE FROM exercises
WHERE record_id IN (
  SELECT id FROM records
  WHERE user_id = '11111111-1111-1111-1111-111111111111'
);

DELETE FROM food_consumptions
WHERE record_id IN (
  SELECT id FROM records
  WHERE user_id = '11111111-1111-1111-1111-111111111111'
);

DELETE FROM records
WHERE user_id = '11111111-1111-1111-1111-111111111111';

DELETE FROM body_weight_records
WHERE user_id = '11111111-1111-1111-1111-111111111111';

DELETE FROM users
WHERE id = '11111111-1111-1111-1111-111111111111';

INSERT INTO users (id, username, display_name)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'default_user',
  'Default User'
)
ON CONFLICT (username) DO NOTHING;

INSERT INTO exercise_items (id, name, muscle_group)
VALUES
  ('20000000-0000-0000-0000-000000000001', 'Bench Press', 'Chest'),
  ('20000000-0000-0000-0000-000000000002', 'Shoulder Press', 'Shoulders'),
  ('20000000-0000-0000-0000-000000000003', 'Squat', 'Legs'),
  ('20000000-0000-0000-0000-000000000004', 'Deadlift', 'Back'),
  ('20000000-0000-0000-0000-000000000005', 'Barbell Row', 'Back'),
  ('20000000-0000-0000-0000-000000000006', 'Pull-up', 'Back')
ON CONFLICT (name) DO NOTHING;


# GymTracker PostgreSQL + Mobile Flow Plan

Date: 2026-02-17  
Status: Draft for review (no implementation yet)

## Goal

Replace JSON file storage with PostgreSQL and align backend/mobile design with the new data model:

1. `users` table  
2. `records` table (one row per user per date when there is data)  
3. `exercises` table (multiple rows per record)  
4. `exercise_items` table (predefined exercise catalog)  
5. `exercise_sets` table (multiple sets per exercise, each set can have different reps/weight)

Also update mobile UX to support:

1. Home page with historical dates list  
2. Record detail page for a date (list exercises + add exercise)  
3. Exercise detail page for a selected exercise

---

## 1) Database Design (PostgreSQL)

### 1.1 Table: `users`

Purpose: app users, owner of records.

- `id` UUID primary key
- `username` VARCHAR(50), unique, not null
- `display_name` VARCHAR(100), nullable
- `created_at` TIMESTAMPTZ, default now()
- `updated_at` TIMESTAMPTZ, default now()

Notes:
- Keep `username` unique for login/profile identity.

### 1.2 Table: `records`

Purpose: one workout record for one user on one date.

- `id` UUID primary key
- `user_id` UUID not null, foreign key -> `users.id`
- `record_date` DATE not null
- `created_at` TIMESTAMPTZ, default now()
- `updated_at` TIMESTAMPTZ, default now()

Constraints:
- Unique composite key: (`user_id`, `record_date`)  
  This guarantees one record max per day per user, and allows no row for rest/no-log days.

Indexes:
- index on (`user_id`, `record_date` desc)

### 1.3 Table: `exercise_items`

Purpose: predefined exercise dictionary (bench press, shoulder press, etc.).

- `id` UUID primary key
- `name` VARCHAR(120) unique, not null
- `muscle_group` VARCHAR(60), nullable
- `created_at` TIMESTAMPTZ, default now()
- `updated_at` TIMESTAMPTZ, default now()

Indexes:
- unique index on lowercased `name` to prevent case-only duplicates

### 1.4 Table: `exercises`

Purpose: a concrete logged exercise under a record (can be many per record).

- `id` UUID primary key
- `record_id` UUID not null, foreign key -> `records.id`
- `exercise_item_id` UUID not null, foreign key -> `exercise_items.id`
- `notes` TEXT nullable
- `sort_order` INT not null default 0
- `created_at` TIMESTAMPTZ, default now()
- `updated_at` TIMESTAMPTZ, default now()

Indexes:
- index on (`record_id`, `sort_order`)
- index on `exercise_item_id`

Clarification:
- Your requested `ExerciseId` + `ExerciseItemId` mapping is represented by:
  - `exercises.id` = `ExerciseId`
  - `exercises.exercise_item_id` = `ExerciseItemId`

### 1.5 Table: `exercise_sets`

Purpose: concrete set rows for an exercise. Supports variable reps/weight per set.

- `id` UUID primary key
- `exercise_id` UUID not null, foreign key -> `exercises.id`
- `reps` INT not null check > 0
- `weight` NUMERIC(6,2) not null check >= 0
- `set_order` INT not null default 0
- `created_at` TIMESTAMPTZ, default now()
- `updated_at` TIMESTAMPTZ, default now()

Indexes:
- index on (`exercise_id`, `set_order`)

Foreign key behavior:
- `exercises.record_id` -> `records.id` with `ON DELETE CASCADE`
- `exercise_sets.exercise_id` -> `exercises.id` with `ON DELETE CASCADE`
- `exercises.exercise_item_id` -> `exercise_items.id` with `ON DELETE RESTRICT`
- `records.user_id` -> `users.id` with `ON DELETE RESTRICT`

### 1.6 Relationship Diagram

- `users` 1 -> many `records`
- `records` 1 -> many `exercises`
- `exercise_items` 1 -> many `exercises`
- `exercises` 1 -> many `exercise_sets`

---

## 2) Migration Plan

## 2.1 Migration 001: initial schema

Create:
- `users`
- `records`
- `exercise_items`
- `exercises`
- `exercise_sets`

Add:
- foreign keys
- unique constraints
- check constraints
- indexes
- explicit FK delete policies (cascade/restrict)

### 2.2 Migration 002: seed exercise items

Seed default `exercise_items`, for example:

- Bench Press
- Shoulder Press
- Squat
- Deadlift
- Barbell Row
- Pull-up

### 2.3 JSON storage deprecation

No data backfill is needed.

- Existing `backend/data/workouts.json` data will be discarded.
- Backend JSON read/write logic will be removed.
- PostgreSQL becomes the single source of truth for workout data.

---

## 3) Backend API Plan (v1, minimal change)

Base assumption: keep existing backend style, but switch storage layer from JSON to PostgreSQL.

Canonical date rule:
- `record_date` is always user-local calendar date.
- Client sends `YYYY-MM-DD` based on the user's local day.
- Server validates format and stores value in PostgreSQL `DATE` unchanged.

## 3.1 Endpoints

### Users
- `POST /users` -> create user
- `GET /users/:userId` -> get profile

### Records (date-level)
- `GET /records?userId=...&from=YYYY-MM-DD&to=YYYY-MM-DD`  
  Return list of dates/records for home page
- `GET /records/:recordId`  
  Return record metadata + exercises summary in one response  
  (exercise id, exercise item name, set count, last-updated)
- `GET /records/by-date?userId=...&date=YYYY-MM-DD`  
  Return that date's record or null

### Exercises
- `POST /records/:recordId/exercises`  
  Add exercise under record (creates exercise row + optional initial sets)
- `GET /exercises/:exerciseId`  
  Return exercise metadata + full `exercise_sets` list in one response
- `PATCH /exercises/:exerciseId`  
  Edit exercise metadata (notes, sort order)
- `DELETE /exercises/:exerciseId`  
  Remove exercise from record

### Exercise sets
- `POST /exercises/:exerciseId/sets`
  Add one set (`reps`, `weight`, optional `setOrder`)
- `PATCH /exercise-sets/:setId`
  Edit one set
- `DELETE /exercise-sets/:setId`
  Delete one set

### Exercise items
- `GET /exercise-items`  
  For add-exercise selector

### Record auto-create behavior
- If user adds an exercise on a date with no `records` row, backend creates `records` row first, then inserts exercise.
- Create flow uses a single DB transaction: create/find record -> create exercise -> create initial sets (if provided).
- If any step fails, transaction is rolled back so no partial rows remain.

### Idempotency strategy for create endpoints
- `POST /records/:recordId/exercises` and `POST /exercises/:exerciseId/sets` accept optional `Idempotency-Key` header.
- Backend stores (`user_id`, endpoint, idempotency_key) with TTL and returns original success response for retries.
- Prevents duplicate exercise/set creation on retry, reconnect, or repeated taps.

---

## 4) Mobile UI Plan

Current app is single-screen. Planned 3-screen flow:

MVP user handling:
- No login screen in this phase.
- Mobile app stores one active `userId` locally (seeded user from backend bootstrap).
- All record/exercise API calls include this active `userId`.
- This keeps UI simple now and allows later upgrade to multi-user auth.
- All create/update buttons use disabled/loading states during request flight to reduce duplicate submissions.

## 4.1 Screen A: Home (history list)

Purpose:
- Show record dates for selected user
- Navigate to a date's detail

UI:
- Header + date range filter
- "Go to Today" quick action button
- FlatList of record dates (newest first)
- Each row shows date + exercise count (optional)

Actions:
- Tap "Go to Today" -> navigate directly to today's record detail page
- Tap row -> Record Detail screen

Today quick action behavior:
- If today's record exists, open its detail page with exercise list.
- If today's record does not exist yet, open today's detail page in empty state with "Add Exercise" enabled.

## 4.2 Screen B: Record Detail (date-level)

Purpose:
- Show all exercises completed on selected date
- Add exercises to this date

UI:
- Top: date + user
- Middle: list of exercise rows
- Bottom: "Add Exercise" action

Actions:
- Tap exercise row -> Exercise Detail screen
- Tap "Add Exercise" -> open add form (modal or inline)

If no record exists:
- Show empty state: "No exercises logged"
- Keep "Add Exercise" enabled; first add triggers record creation
- If all exercises/sets are later deleted, keep the `records` row once created (deterministic behavior).

## 4.3 Screen C: Exercise Detail

Purpose:
- Show and edit one exercise entry and its sets

UI fields:
- Exercise item name
- Notes
- FlatList of sets (Set #, reps, weight)

Actions:
- Add set
- Edit set
- Delete set
- Save exercise notes/order changes
- Delete exercise

---

## 5) Validation Rules

- Date format: `YYYY-MM-DD`
- set `weight >= 0`
- set `reps > 0`
- `notes` optional
- Enforce one `records` row per (`user_id`, `record_date`)
- Exercise and set create/update endpoints support idempotency key handling

---

## 6) Suggested Implementation Order

1. Add PostgreSQL and ORM migration tooling in backend
2. Create schema migration + seed migration (including one default user)
3. Build repository/data access layer (replace JSON functions)
4. Adapt existing workout endpoints to record/exercise/set model
5. Add new endpoints for record list/detail, exercise detail, and set CRUD (+ user bootstrap endpoint)
6. Refactor mobile into 3 screens with navigation
7. Wire API calls with active `userId` and validate flows end-to-end (including set list on exercise detail)
8. Add transaction + idempotency handling for create flows
9. Remove JSON file and related code paths

---

## 7) Open Decisions for Your Review

1. User model for MVP:
   - Proposed: single seeded user first, then full multi-user/auth later.
2. Add exercise behavior:
   - Modal form vs inline form on record detail page?
3. Exercise detail:
   - Editable fields only, or include history/trend later?

---

## 8) Definition of Done for Milestone 1 Items

For `PROJECT_PROGRESS.md` tasks:

- "Define DB schema (workout session + exercise entry)" is complete when:
  - schema + constraints + relationships are approved and migrated
- "Create migrations" is complete when:
  - migration files exist, run successfully, and DB can be recreated from scratch


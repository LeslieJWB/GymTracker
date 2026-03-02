import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { pool, withTransaction } from "./db.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const uuidLikePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "../public");

app.use(cors());
app.use(express.json());
app.use("/assets", express.static(publicDir));

function toImageUrl(req: express.Request, imagePath: string | null): string | null {
  if (!imagePath) {
    return null;
  }
  const normalized = imagePath.startsWith("/") ? imagePath.slice(1) : imagePath;
  return `${req.protocol}://${req.get("host")}/assets/${normalized}`;
}

// Accept canonical 8-4-4-4-12 hex UUID text shape (matches Postgres UUID parsing).
const idSchema = z.string().regex(uuidLikePattern, "Invalid UUID");
const dateRangeSchema = z.object({
  userId: idSchema,
  from: z.string().regex(datePattern).optional(),
  to: z.string().regex(datePattern).optional()
});
const byDateSchema = z.object({
  userId: idSchema,
  date: z.string().regex(datePattern)
});
const recordThemeSchema = z
  .string()
  .trim()
  .max(30);
const patchRecordThemeByDateSchema = byDateSchema.extend({
  theme: recordThemeSchema.nullable()
});
const createExerciseSchema = z.object({
  userId: idSchema,
  exerciseItemId: idSchema,
  notes: z.string().max(1000).optional(),
  sortOrder: z.number().int().min(0).optional(),
  initialSets: z
    .array(
      z.object({
        reps: z.number().int().positive(),
        weight: z.number().nonnegative(),
        setOrder: z.number().int().min(0).optional(),
        notes: z.string().max(1000).optional()
      })
    )
    .optional()
});
const createExerciseByDateSchema = createExerciseSchema.extend({
  date: z.string().regex(datePattern)
});
const patchExerciseSchema = z.object({
  notes: z.string().max(1000).nullable().optional(),
  sortOrder: z.number().int().min(0).optional()
});
const createSetSchema = z.object({
  userId: idSchema,
  reps: z.number().int().positive(),
  weight: z.number().nonnegative(),
  setOrder: z.number().int().min(0).optional(),
  notes: z.string().max(1000).optional()
});
const patchSetSchema = z.object({
  reps: z.number().int().positive().optional(),
  weight: z.number().nonnegative().optional(),
  setOrder: z.number().int().min(0).optional(),
  notes: z.string().max(1000).nullable().optional()
});

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function idempotencyHeader(req: express.Request): string | null {
  const key = req.header("Idempotency-Key");
  if (!key) {
    return null;
  }
  const trimmed = key.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function getOrCreateRecord(
  userId: string,
  date: string
): Promise<{ id: string; recordDate: string }> {
  const result = await pool.query<{ id: string; record_date: string }>(
    `
      INSERT INTO records (id, user_id, record_date)
      VALUES ($1, $2, $3::date)
      ON CONFLICT (user_id, record_date)
      DO UPDATE SET updated_at = now()
      RETURNING id, record_date::text
    `,
    [randomUUID(), userId, date]
  );
  const row = result.rows[0];
  return { id: row.id, recordDate: row.record_date };
}

async function findIdempotentResponse(
  userId: string,
  endpoint: string,
  key: string
): Promise<{ status: number; body: unknown } | null> {
  const result = await pool.query<{
    response_status: number;
    response_body: unknown;
  }>(
    `
      SELECT response_status, response_body
      FROM idempotency_keys
      WHERE user_id = $1
        AND endpoint = $2
        AND idempotency_key = $3
      LIMIT 1
    `,
    [userId, endpoint, key]
  );
  if (result.rowCount === 0) {
    return null;
  }
  const row = result.rows[0];
  return { status: row.response_status, body: row.response_body };
}

async function saveIdempotentResponse(
  userId: string,
  endpoint: string,
  key: string,
  status: number,
  body: unknown
): Promise<void> {
  await pool.query(
    `
      INSERT INTO idempotency_keys
        (user_id, endpoint, idempotency_key, response_status, response_body)
      VALUES ($1, $2, $3, $4, $5::jsonb)
      ON CONFLICT (user_id, endpoint, idempotency_key)
      DO NOTHING
    `,
    [userId, endpoint, key, status, JSON.stringify(body)]
  );
}

function buildFallbackAdvice(targetDate: string, rows: string[]): string {
  if (rows.length === 0) {
    return `No previous records found before ${targetDate}. Start with a moderate full-body day and log each set for future personalized advice.`;
  }
  const recent = rows.slice(-8).join("; ");
  return `Based on your recent sessions (${recent}), target progressive overload with strict form, small load/rep increases, and controlled total volume.`;
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/exercise-items", async (req, res) => {
  try {
    const result = await pool.query<{
      id: string;
      name: string;
      muscle_group: string | null;
      image_path: string | null;
    }>(
      `
        SELECT id, name, muscle_group, image_path
        FROM exercise_items
        ORDER BY lower(name) ASC
      `
    );
    return res.json(
      result.rows.map((r) => ({
        id: r.id,
        name: r.name,
        muscleGroup: r.muscle_group,
        imageUrl: toImageUrl(req, r.image_path)
      }))
    );
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
});

app.get("/records", async (req, res) => {
  const parsed = dateRangeSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: "userId is required and dates must be YYYY-MM-DD when provided"
    });
  }

  const { userId } = parsed.data;
  const from = parsed.data.from ?? daysAgo(60);
  const to = parsed.data.to ?? todayDate();
  if (from > to) {
    return res.status(400).json({ error: "'from' cannot be after 'to'" });
  }

  try {
    const result = await pool.query<{
      record_id: string;
      record_date: string;
      theme: string | null;
      exercise_count: string;
      set_count: string;
    }>(
      `
        SELECT
          r.id AS record_id,
          r.record_date::text AS record_date,
          r.theme,
          COUNT(DISTINCT e.id)::text AS exercise_count,
          COUNT(es.id)::text AS set_count
        FROM records r
        LEFT JOIN exercises e ON e.record_id = r.id
        LEFT JOIN exercise_sets es ON es.exercise_id = e.id AND es.is_completed = TRUE
        WHERE r.user_id = $1
          AND r.record_date >= $2::date
          AND r.record_date <= $3::date
        GROUP BY r.id, r.record_date, r.theme
        ORDER BY r.record_date DESC
      `,
      [userId, from, to]
    );

    return res.json(
      result.rows.map((row) => ({
        recordId: row.record_id,
        date: row.record_date,
        theme: row.theme,
        exerciseCount: Number(row.exercise_count),
        setCount: Number(row.set_count)
      }))
    );
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
});

app.get("/records/by-date", async (req, res) => {
  const parsed = byDateSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "userId and date are required" });
  }

  const { userId, date } = parsed.data;
  try {
    const recordResult = await pool.query<{ id: string; record_date: string; theme: string | null }>(
      `
        SELECT id, record_date::text, theme
        FROM records
        WHERE user_id = $1 AND record_date = $2::date
        LIMIT 1
      `,
      [userId, date]
    );
    if (recordResult.rowCount === 0) {
      return res.json(null);
    }
    const recordId = recordResult.rows[0].id;
    const detail = await pool.query<{
      exercise_id: string;
      exercise_item_id: string;
      exercise_item_name: string;
      exercise_item_image_path: string | null;
      notes: string | null;
      sort_order: number;
      set_count: string;
      completed_volume: number;
      updated_at: string;
    }>(
      `
        SELECT
          e.id AS exercise_id,
          e.exercise_item_id,
          ei.name AS exercise_item_name,
          ei.image_path AS exercise_item_image_path,
          e.notes,
          e.sort_order,
          COUNT(es.id)::text AS set_count,
          COALESCE(SUM(CASE WHEN es.is_completed THEN es.reps * es.weight ELSE 0 END), 0)::double precision AS completed_volume,
          e.updated_at::text
        FROM exercises e
        JOIN exercise_items ei ON ei.id = e.exercise_item_id
        LEFT JOIN exercise_sets es ON es.exercise_id = e.id AND es.is_completed = TRUE
        WHERE e.record_id = $1
        GROUP BY e.id, e.exercise_item_id, ei.name, ei.image_path, e.notes, e.sort_order, e.updated_at
        ORDER BY e.sort_order ASC, e.created_at ASC
      `,
      [recordId]
    );

    return res.json({
      recordId,
      date,
      userId,
      theme: recordResult.rows[0].theme,
      exercises: detail.rows.map((row) => ({
        id: row.exercise_id,
        exerciseItemId: row.exercise_item_id,
        exerciseItemName: row.exercise_item_name,
        exerciseItemImageUrl: toImageUrl(req, row.exercise_item_image_path),
        notes: row.notes,
        sortOrder: row.sort_order,
        setCount: Number(row.set_count),
        completedVolume: Number(row.completed_volume),
        updatedAt: row.updated_at
      }))
    });
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
});

app.patch("/records/by-date/theme", async (req, res) => {
  const parsed = patchRecordThemeByDateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { userId, date, theme } = parsed.data;
  try {
    const result = await pool.query<{
      id: string;
      record_date: string;
      theme: string | null;
    }>(
      `
        INSERT INTO records (id, user_id, record_date, theme)
        VALUES ($1, $2, $3::date, $4)
        ON CONFLICT (user_id, record_date)
        DO UPDATE SET
          theme = $4,
          updated_at = now()
        RETURNING id, record_date::text, theme
      `,
      [randomUUID(), userId, date, theme]
    );

    const row = result.rows[0];
    return res.json({
      recordId: row.id,
      date: row.record_date,
      userId,
      theme: row.theme
    });
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
});

app.get("/records/:recordId", async (req, res) => {
  const recordId = req.params.recordId;
  if (!idSchema.safeParse(recordId).success) {
    return res.status(400).json({ error: "Invalid recordId" });
  }

  try {
    const result = await pool.query<{ user_id: string; record_date: string; theme: string | null }>(
      `
        SELECT user_id, record_date::text, theme
        FROM records
        WHERE id = $1
        LIMIT 1
      `,
      [recordId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Record not found" });
    }
    const base = result.rows[0];

    const detail = await pool.query<{
      exercise_id: string;
      exercise_item_id: string;
      exercise_item_name: string;
      exercise_item_image_path: string | null;
      notes: string | null;
      sort_order: number;
      set_count: string;
      completed_volume: number;
      updated_at: string;
    }>(
      `
        SELECT
          e.id AS exercise_id,
          e.exercise_item_id,
          ei.name AS exercise_item_name,
          ei.image_path AS exercise_item_image_path,
          e.notes,
          e.sort_order,
          COUNT(es.id)::text AS set_count,
          COALESCE(SUM(CASE WHEN es.is_completed THEN es.reps * es.weight ELSE 0 END), 0)::double precision AS completed_volume,
          e.updated_at::text
        FROM exercises e
        JOIN exercise_items ei ON ei.id = e.exercise_item_id
        LEFT JOIN exercise_sets es ON es.exercise_id = e.id AND es.is_completed = TRUE
        WHERE e.record_id = $1
        GROUP BY e.id, e.exercise_item_id, ei.name, ei.image_path, e.notes, e.sort_order, e.updated_at
        ORDER BY e.sort_order ASC, e.created_at ASC
      `,
      [recordId]
    );

    return res.json({
      recordId,
      userId: base.user_id,
      date: base.record_date,
      theme: base.theme,
      exercises: detail.rows.map((row) => ({
        id: row.exercise_id,
        exerciseItemId: row.exercise_item_id,
        exerciseItemName: row.exercise_item_name,
        exerciseItemImageUrl: toImageUrl(req, row.exercise_item_image_path),
        notes: row.notes,
        sortOrder: row.sort_order,
        setCount: Number(row.set_count),
        completedVolume: Number(row.completed_volume),
        updatedAt: row.updated_at
      }))
    });
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
});

app.post("/records/by-date/exercises", async (req, res) => {
  const parsed = createExerciseByDateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { userId, date, exerciseItemId, notes, sortOrder, initialSets } = parsed.data;
  const key = idempotencyHeader(req);
  const endpoint = "POST /records/by-date/exercises";
  if (key) {
    const existing = await findIdempotentResponse(userId, endpoint, key);
    if (existing) {
      return res.status(existing.status).json(existing.body);
    }
  }

  try {
    const payload = await withTransaction(async (client) => {
      const recordResult = await client.query<{ id: string; record_date: string }>(
        `
          INSERT INTO records (id, user_id, record_date)
          VALUES ($1, $2, $3::date)
          ON CONFLICT (user_id, record_date)
          DO UPDATE SET updated_at = now()
          RETURNING id, record_date::text
        `,
        [randomUUID(), userId, date]
      );
      const recordId = recordResult.rows[0].id;
      const exerciseId = randomUUID();
      await client.query(
        `
          INSERT INTO exercises (id, record_id, exercise_item_id, notes, sort_order)
          VALUES ($1, $2, $3, $4, $5)
        `,
        [exerciseId, recordId, exerciseItemId, notes ?? null, sortOrder ?? 0]
      );

      const createdSets: Array<{
        id: string;
        reps: number;
        weight: number;
        setOrder: number;
        notes: string | null;
      }> = [];
      for (const [index, setItem] of (initialSets ?? []).entries()) {
        const setId = randomUUID();
        const finalOrder = setItem.setOrder ?? index;
        await client.query(
          `
            INSERT INTO exercise_sets (id, exercise_id, reps, weight, set_order, notes)
            VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [setId, exerciseId, setItem.reps, setItem.weight, finalOrder, setItem.notes ?? null]
        );
        createdSets.push({
          id: setId,
          reps: setItem.reps,
          weight: setItem.weight,
          setOrder: finalOrder,
          notes: setItem.notes ?? null
        });
      }

      return {
        recordId,
        date,
        exercise: {
          id: exerciseId,
          exerciseItemId,
          notes: notes ?? null,
          sortOrder: sortOrder ?? 0,
          sets: createdSets
        }
      };
    });

    if (key) {
      await saveIdempotentResponse(userId, endpoint, key, 201, payload);
    }

    return res.status(201).json(payload);
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
});

app.post("/records/:recordId/exercises", async (req, res) => {
  const recordId = req.params.recordId;
  if (!idSchema.safeParse(recordId).success) {
    return res.status(400).json({ error: "Invalid recordId" });
  }
  const parsed = createExerciseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { userId, exerciseItemId, notes, sortOrder, initialSets } = parsed.data;
  const endpoint = "POST /records/:recordId/exercises";
  const key = idempotencyHeader(req);
  if (key) {
    const existing = await findIdempotentResponse(userId, endpoint, key);
    if (existing) {
      return res.status(existing.status).json(existing.body);
    }
  }

  try {
    const recordCheck = await pool.query<{ id: string }>(
      `
        SELECT id
        FROM records
        WHERE id = $1 AND user_id = $2
        LIMIT 1
      `,
      [recordId, userId]
    );
    if (recordCheck.rowCount === 0) {
      return res.status(404).json({ error: "Record not found for user" });
    }

    const payload = await withTransaction(async (client) => {
      const exerciseId = randomUUID();
      await client.query(
        `
          INSERT INTO exercises (id, record_id, exercise_item_id, notes, sort_order)
          VALUES ($1, $2, $3, $4, $5)
        `,
        [exerciseId, recordId, exerciseItemId, notes ?? null, sortOrder ?? 0]
      );

      const createdSets: Array<{
        id: string;
        reps: number;
        weight: number;
        setOrder: number;
        notes: string | null;
      }> = [];
      for (const [index, setItem] of (initialSets ?? []).entries()) {
        const setId = randomUUID();
        const finalOrder = setItem.setOrder ?? index;
        await client.query(
          `
            INSERT INTO exercise_sets (id, exercise_id, reps, weight, set_order, notes)
            VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [setId, exerciseId, setItem.reps, setItem.weight, finalOrder, setItem.notes ?? null]
        );
        createdSets.push({
          id: setId,
          reps: setItem.reps,
          weight: setItem.weight,
          setOrder: finalOrder,
          notes: setItem.notes ?? null
        });
      }

      return {
        recordId,
        exercise: {
          id: exerciseId,
          exerciseItemId,
          notes: notes ?? null,
          sortOrder: sortOrder ?? 0,
          sets: createdSets
        }
      };
    });

    if (key) {
      await saveIdempotentResponse(userId, endpoint, key, 201, payload);
    }

    return res.status(201).json(payload);
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
});

app.get("/exercises/:exerciseId", async (req, res) => {
  const exerciseId = req.params.exerciseId;
  if (!idSchema.safeParse(exerciseId).success) {
    return res.status(400).json({ error: "Invalid exerciseId" });
  }

  try {
    const exerciseResult = await pool.query<{
      id: string;
      record_id: string;
      exercise_item_id: string;
      exercise_item_name: string;
      exercise_item_image_path: string | null;
      notes: string | null;
      sort_order: number;
      updated_at: string;
    }>(
      `
        SELECT
          e.id,
          e.record_id,
          e.exercise_item_id,
          ei.name AS exercise_item_name,
          ei.image_path AS exercise_item_image_path,
          e.notes,
          e.sort_order,
          e.updated_at::text
        FROM exercises e
        JOIN exercise_items ei ON ei.id = e.exercise_item_id
        WHERE e.id = $1
        LIMIT 1
      `,
      [exerciseId]
    );
    if (exerciseResult.rowCount === 0) {
      return res.status(404).json({ error: "Exercise not found" });
    }
    const exercise = exerciseResult.rows[0];

    const setsResult = await pool.query<{
      id: string;
      reps: number;
      weight: string;
      set_order: number;
      notes: string | null;
    }>(
      `
        SELECT id, reps, weight::text, set_order, notes
        FROM exercise_sets
        WHERE exercise_id = $1
        ORDER BY set_order ASC, created_at ASC
      `,
      [exerciseId]
    );

    return res.json({
      id: exercise.id,
      recordId: exercise.record_id,
      exerciseItemId: exercise.exercise_item_id,
      exerciseItemName: exercise.exercise_item_name,
      exerciseItemImageUrl: toImageUrl(req, exercise.exercise_item_image_path),
      notes: exercise.notes,
      sortOrder: exercise.sort_order,
      updatedAt: exercise.updated_at,
      sets: setsResult.rows.map((s) => ({
        id: s.id,
        reps: s.reps,
        weight: Number(s.weight),
        setOrder: s.set_order,
        notes: s.notes
      }))
    });
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
});

app.patch("/exercises/:exerciseId", async (req, res) => {
  const exerciseId = req.params.exerciseId;
  if (!idSchema.safeParse(exerciseId).success) {
    return res.status(400).json({ error: "Invalid exerciseId" });
  }
  const parsed = patchExerciseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { notes, sortOrder } = parsed.data;
  const hasNotes = Object.prototype.hasOwnProperty.call(parsed.data, "notes");
  const hasSortOrder = Object.prototype.hasOwnProperty.call(parsed.data, "sortOrder");
  try {
    const result = await pool.query<{
      id: string;
      notes: string | null;
      sort_order: number;
      updated_at: string;
    }>(
      `
        UPDATE exercises
        SET
          notes = CASE WHEN $2::boolean THEN $3 ELSE notes END,
          sort_order = CASE WHEN $4::boolean THEN $5 ELSE sort_order END,
          updated_at = now()
        WHERE id = $1
        RETURNING id, notes, sort_order, updated_at::text
      `,
      [exerciseId, hasNotes, notes ?? null, hasSortOrder, sortOrder ?? null]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Exercise not found" });
    }
    const row = result.rows[0];
    return res.json({
      id: row.id,
      notes: row.notes,
      sortOrder: row.sort_order,
      updatedAt: row.updated_at
    });
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
});

app.delete("/exercises/:exerciseId", async (req, res) => {
  const exerciseId = req.params.exerciseId;
  if (!idSchema.safeParse(exerciseId).success) {
    return res.status(400).json({ error: "Invalid exerciseId" });
  }
  try {
    const result = await pool.query(
      "DELETE FROM exercises WHERE id = $1 RETURNING id",
      [exerciseId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Exercise not found" });
    }
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
});

app.post("/exercises/:exerciseId/sets", async (req, res) => {
  const exerciseId = req.params.exerciseId;
  if (!idSchema.safeParse(exerciseId).success) {
    return res.status(400).json({ error: "Invalid exerciseId" });
  }
  const parsed = createSetSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { userId, reps, weight, setOrder, notes } = parsed.data;
  const endpoint = "POST /exercises/:exerciseId/sets";
  const key = idempotencyHeader(req);
  if (key) {
    const existing = await findIdempotentResponse(userId, endpoint, key);
    if (existing) {
      return res.status(existing.status).json(existing.body);
    }
  }

  try {
    const ownership = await pool.query(
      `
        SELECT e.id
        FROM exercises e
        JOIN records r ON r.id = e.record_id
        WHERE e.id = $1 AND r.user_id = $2
        LIMIT 1
      `,
      [exerciseId, userId]
    );
    if (ownership.rowCount === 0) {
      return res.status(404).json({ error: "Exercise not found for user" });
    }

    const id = randomUUID();
    const result = await pool.query<{
      id: string;
      reps: number;
      weight: string;
      set_order: number;
      notes: string | null;
    }>(
      `
        INSERT INTO exercise_sets (id, exercise_id, reps, weight, set_order, notes)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, reps, weight::text, set_order, notes
      `,
      [id, exerciseId, reps, weight, setOrder ?? 0, notes ?? null]
    );
    const row = result.rows[0];
    const payload = {
      id: row.id,
      reps: row.reps,
      weight: Number(row.weight),
      setOrder: row.set_order,
      notes: row.notes
    };

    if (key) {
      await saveIdempotentResponse(userId, endpoint, key, 201, payload);
    }

    return res.status(201).json(payload);
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
});

app.patch("/exercise-sets/:setId", async (req, res) => {
  const setId = req.params.setId;
  if (!idSchema.safeParse(setId).success) {
    return res.status(400).json({ error: "Invalid setId" });
  }
  const parsed = patchSetSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { reps, weight, setOrder, notes } = parsed.data;
  const hasReps = Object.prototype.hasOwnProperty.call(parsed.data, "reps");
  const hasWeight = Object.prototype.hasOwnProperty.call(parsed.data, "weight");
  const hasSetOrder = Object.prototype.hasOwnProperty.call(parsed.data, "setOrder");
  const hasNotes = Object.prototype.hasOwnProperty.call(parsed.data, "notes");

  try {
    const result = await pool.query<{
      id: string;
      reps: number;
      weight: string;
      set_order: number;
      notes: string | null;
      updated_at: string;
    }>(
      `
        UPDATE exercise_sets
        SET
          reps = CASE WHEN $2::boolean THEN $3 ELSE reps END,
          weight = CASE WHEN $4::boolean THEN $5 ELSE weight END,
          set_order = CASE WHEN $6::boolean THEN $7 ELSE set_order END,
          notes = CASE WHEN $8::boolean THEN $9 ELSE notes END,
          updated_at = now()
        WHERE id = $1
        RETURNING id, reps, weight::text, set_order, notes, updated_at::text
      `,
      [
        setId,
        hasReps,
        reps ?? null,
        hasWeight,
        weight ?? null,
        hasSetOrder,
        setOrder ?? null,
        hasNotes,
        notes ?? null
      ]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Set not found" });
    }
    const row = result.rows[0];
    return res.json({
      id: row.id,
      reps: row.reps,
      weight: Number(row.weight),
      setOrder: row.set_order,
      notes: row.notes,
      updatedAt: row.updated_at
    });
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
});

app.delete("/exercise-sets/:setId", async (req, res) => {
  const setId = req.params.setId;
  if (!idSchema.safeParse(setId).success) {
    return res.status(400).json({ error: "Invalid setId" });
  }
  try {
    const result = await pool.query(
      "DELETE FROM exercise_sets WHERE id = $1 RETURNING id",
      [setId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Set not found" });
    }
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
});

app.listen(port, () => {
  console.log(`GymTracker backend listening on http://localhost:${port}`);
});

import { randomUUID } from "node:crypto";
import { Router } from "express";
import { pool, withTransaction } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { upsertUserFromAuth } from "../shared/authUsers.js";
import { daysAgo, todayDate } from "../shared/dates.js";
import {
  findIdempotentResponse,
  idempotencyHeader,
  saveIdempotentResponse
} from "../shared/idempotency.js";
import {
  byDateNoUserSchema,
  createExerciseByDateSchema,
  createExerciseSchema,
  dateRangeNoUserSchema,
  idSchema,
  patchRecordThemeByDateSchema
} from "../shared/validation.js";

export const recordsRouter = Router();
recordsRouter.use(requireAuth);

recordsRouter.get("/records", async (req, res) => {
  if (!req.auth) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const parsed = dateRangeNoUserSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: "dates must be YYYY-MM-DD when provided"
    });
  }

  const from = parsed.data.from ?? daysAgo(60);
  const to = parsed.data.to ?? todayDate();

  if (from > to) {
    return res.status(400).json({ error: "'from' cannot be after 'to'" });
  }

  try {
    const appUser = await upsertUserFromAuth(req.auth);
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
      [appUser.id, from, to]
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

recordsRouter.get("/records/by-date", async (req, res) => {
  if (!req.auth) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const parsed = byDateNoUserSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "date is required" });
  }

  const { date } = parsed.data;
  try {
    const appUser = await upsertUserFromAuth(req.auth);
    const recordResult = await pool.query<{
      id: string;
      record_date: string;
      theme: string | null;
      check_in_initialized: boolean;
      daily_calorie_target_kcal: string | null;
      daily_protein_target_g: string | null;
      daily_target_source: string | null;
      daily_target_comment: string | null;
    }>(
      `
        SELECT
          id,
          record_date::text,
          theme,
          check_in_initialized,
          daily_calorie_target_kcal::text,
          daily_protein_target_g::text,
          daily_target_source,
          daily_target_comment
        FROM records
        WHERE user_id = $1 AND record_date = $2::date
        LIMIT 1
      `,
      [appUser.id, date]
    );
    if (recordResult.rowCount === 0) {
      return res.json(null);
    }
    const recordId = recordResult.rows[0].id;
    const detail = await pool.query<{
      exercise_id: string;
      exercise_item_id: string;
      exercise_item_name: string;
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
          e.notes,
          e.sort_order,
          COUNT(es.id)::text AS set_count,
          COALESCE(SUM(CASE WHEN es.is_completed THEN es.reps * es.weight ELSE 0 END), 0)::double precision AS completed_volume,
          e.updated_at::text
        FROM exercises e
        JOIN exercise_items ei ON ei.id = e.exercise_item_id
        LEFT JOIN exercise_sets es ON es.exercise_id = e.id AND es.is_completed = TRUE
        WHERE e.record_id = $1
        GROUP BY e.id, e.exercise_item_id, ei.name, e.notes, e.sort_order, e.updated_at
        ORDER BY e.sort_order ASC, e.created_at ASC
      `,
      [recordId]
    );

    return res.json({
      recordId,
      date,
      userId: appUser.id,
      theme: recordResult.rows[0].theme,
      checkInInitialized: recordResult.rows[0].check_in_initialized,
      dailyCalorieTargetKcal: recordResult.rows[0].daily_calorie_target_kcal
        ? Number(recordResult.rows[0].daily_calorie_target_kcal)
        : null,
      dailyProteinTargetG: recordResult.rows[0].daily_protein_target_g
        ? Number(recordResult.rows[0].daily_protein_target_g)
        : null,
      dailyTargetSource: recordResult.rows[0].daily_target_source,
      dailyTargetComment: recordResult.rows[0].daily_target_comment,
      exercises: detail.rows.map((row) => ({
        id: row.exercise_id,
        exerciseItemId: row.exercise_item_id,
        exerciseItemName: row.exercise_item_name,
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

recordsRouter.get("/records/:recordId", async (req, res) => {
  if (!req.auth) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const recordId = req.params.recordId;
  if (!idSchema.safeParse(recordId).success) {
    return res.status(400).json({ error: "Invalid recordId" });
  }

  try {
    const appUser = await upsertUserFromAuth(req.auth);
    const result = await pool.query<{
      record_date: string;
      theme: string | null;
      check_in_initialized: boolean;
      daily_calorie_target_kcal: string | null;
      daily_protein_target_g: string | null;
      daily_target_source: string | null;
      daily_target_comment: string | null;
    }>(
      `
        SELECT
          record_date::text,
          theme,
          check_in_initialized,
          daily_calorie_target_kcal::text,
          daily_protein_target_g::text,
          daily_target_source,
          daily_target_comment
        FROM records
        WHERE id = $1
          AND user_id = $2
        LIMIT 1
      `,
      [recordId, appUser.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Record not found" });
    }
    const base = result.rows[0];

    const detail = await pool.query<{
      exercise_id: string;
      exercise_item_id: string;
      exercise_item_name: string;
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
          e.notes,
          e.sort_order,
          COUNT(es.id)::text AS set_count,
          COALESCE(SUM(CASE WHEN es.is_completed THEN es.reps * es.weight ELSE 0 END), 0)::double precision AS completed_volume,
          e.updated_at::text
        FROM exercises e
        JOIN exercise_items ei ON ei.id = e.exercise_item_id
        LEFT JOIN exercise_sets es ON es.exercise_id = e.id AND es.is_completed = TRUE
        WHERE e.record_id = $1
        GROUP BY e.id, e.exercise_item_id, ei.name, e.notes, e.sort_order, e.updated_at
        ORDER BY e.sort_order ASC, e.created_at ASC
      `,
      [recordId]
    );

    return res.json({
      recordId,
      userId: appUser.id,
      date: base.record_date,
      theme: base.theme,
      checkInInitialized: base.check_in_initialized,
      dailyCalorieTargetKcal: base.daily_calorie_target_kcal ? Number(base.daily_calorie_target_kcal) : null,
      dailyProteinTargetG: base.daily_protein_target_g ? Number(base.daily_protein_target_g) : null,
      dailyTargetSource: base.daily_target_source,
      dailyTargetComment: base.daily_target_comment,
      exercises: detail.rows.map((row) => ({
        id: row.exercise_id,
        exerciseItemId: row.exercise_item_id,
        exerciseItemName: row.exercise_item_name,
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

recordsRouter.patch("/records/by-date/theme", async (req, res) => {
  if (!req.auth) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const parsed = patchRecordThemeByDateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { date, theme } = parsed.data;
  try {
    const appUser = await upsertUserFromAuth(req.auth);
    const result = await pool.query<{
      id: string;
      record_date: string;
      theme: string | null;
      check_in_initialized: boolean;
    }>(
      `
        INSERT INTO records (
          id,
          user_id,
          record_date,
          theme,
          check_in_initialized
        )
        VALUES ($1, $2, $3::date, $4, true)
        ON CONFLICT (user_id, record_date)
        DO UPDATE SET
          theme = $4,
          check_in_initialized = true,
          updated_at = now()
        RETURNING
          id,
          record_date::text,
          theme,
          check_in_initialized
      `,
      [randomUUID(), appUser.id, date, theme]
    );

    const row = result.rows[0];
    return res.json({
      recordId: row.id,
      date: row.record_date,
      userId: appUser.id,
      theme: row.theme,
      checkInInitialized: row.check_in_initialized
    });
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
});

recordsRouter.post("/records/by-date/exercises", async (req, res) => {
  if (!req.auth) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const parsed = createExerciseByDateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { date, exerciseItemId, notes, sortOrder, initialSets } = parsed.data;
  const appUser = await upsertUserFromAuth(req.auth);
  const key = idempotencyHeader(req);
  const endpoint = "POST /records/by-date/exercises";
  if (key) {
    const existing = await findIdempotentResponse(appUser.id, endpoint, key);
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
        [randomUUID(), appUser.id, date]
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
        isCompleted: boolean;
      }> = [];
      for (const [index, setItem] of (initialSets ?? []).entries()) {
        const setId = randomUUID();
        const finalOrder = setItem.setOrder ?? index;
        await client.query(
          `
            INSERT INTO exercise_sets (id, exercise_id, reps, weight, set_order, notes, is_completed)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `,
          [setId, exerciseId, setItem.reps, setItem.weight, finalOrder, setItem.notes ?? null, setItem.isCompleted ?? false]
        );
        createdSets.push({
          id: setId,
          reps: setItem.reps,
          weight: setItem.weight,
          setOrder: finalOrder,
          notes: setItem.notes ?? null,
          isCompleted: setItem.isCompleted ?? false
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
      await saveIdempotentResponse(appUser.id, endpoint, key, 201, payload);
    }

    return res.status(201).json(payload);
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
});

recordsRouter.post("/records/:recordId/exercises", async (req, res) => {
  if (!req.auth) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const recordId = req.params.recordId;
  if (!idSchema.safeParse(recordId).success) {
    return res.status(400).json({ error: "Invalid recordId" });
  }
  const parsed = createExerciseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { exerciseItemId, notes, sortOrder, initialSets } = parsed.data;
  const appUser = await upsertUserFromAuth(req.auth);
  const endpoint = "POST /records/:recordId/exercises";
  const key = idempotencyHeader(req);
  if (key) {
    const existing = await findIdempotentResponse(appUser.id, endpoint, key);
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
      [recordId, appUser.id]
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
        isCompleted: boolean;
      }> = [];
      for (const [index, setItem] of (initialSets ?? []).entries()) {
        const setId = randomUUID();
        const finalOrder = setItem.setOrder ?? index;
        await client.query(
          `
            INSERT INTO exercise_sets (id, exercise_id, reps, weight, set_order, notes, is_completed)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `,
          [setId, exerciseId, setItem.reps, setItem.weight, finalOrder, setItem.notes ?? null, setItem.isCompleted ?? false]
        );
        createdSets.push({
          id: setId,
          reps: setItem.reps,
          weight: setItem.weight,
          setOrder: finalOrder,
          notes: setItem.notes ?? null,
          isCompleted: setItem.isCompleted ?? false
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
      await saveIdempotentResponse(appUser.id, endpoint, key, 201, payload);
    }

    return res.status(201).json(payload);
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
});

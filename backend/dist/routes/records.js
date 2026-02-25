import { randomUUID } from "node:crypto";
import { Router } from "express";
import { pool, withTransaction } from "../db.js";
import { daysAgo, todayDate } from "../shared/dates.js";
import { findIdempotentResponse, idempotencyHeader, saveIdempotentResponse } from "../shared/idempotency.js";
import { byDateSchema, createExerciseByDateSchema, createExerciseSchema, dateRangeSchema, idSchema, patchRecordThemeByDateSchema } from "../shared/validation.js";
export const recordsRouter = Router();
function logAgentEvent(hypothesisId, location, message, data) {
    fetch("http://127.0.0.1:7242/ingest/2dcdadeb-a66d-4c0e-a93d-8cc544bdbbcb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            runId: "initial",
            hypothesisId,
            location,
            message,
            data,
            timestamp: Date.now()
        })
    }).catch(() => { });
}
recordsRouter.get("/records", async (req, res) => {
    // #region agent log
    logAgentEvent("H4", "backend/src/index.ts:227", "Records endpoint received query", {
        query: req.query
    });
    // #endregion
    const parsed = dateRangeSchema.safeParse(req.query);
    if (!parsed.success) {
        // #region agent log
        logAgentEvent("H5", "backend/src/index.ts:231", "Records query validation failed", {
            query: req.query,
            issues: parsed.error.issues.map((issue) => ({
                path: issue.path.join("."),
                code: issue.code,
                message: issue.message
            }))
        });
        // #endregion
        return res.status(400).json({
            error: "userId is required and dates must be YYYY-MM-DD when provided"
        });
    }
    const { userId } = parsed.data;
    const from = parsed.data.from ?? daysAgo(60);
    const to = parsed.data.to ?? todayDate();
    // #region agent log
    logAgentEvent("H1", "backend/src/index.ts:255", "Records query validation succeeded", {
        userId,
        from,
        to
    });
    // #endregion
    if (from > to) {
        return res.status(400).json({ error: "'from' cannot be after 'to'" });
    }
    try {
        const result = await pool.query(`
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
      `, [userId, from, to]);
        return res.json(result.rows.map((row) => ({
            recordId: row.record_id,
            date: row.record_date,
            theme: row.theme,
            exerciseCount: Number(row.exercise_count),
            setCount: Number(row.set_count)
        })));
    }
    catch (error) {
        return res.status(500).json({ error: String(error) });
    }
});
recordsRouter.get("/records/by-date", async (req, res) => {
    const parsed = byDateSchema.safeParse(req.query);
    if (!parsed.success) {
        return res.status(400).json({ error: "userId and date are required" });
    }
    const { userId, date } = parsed.data;
    try {
        const recordResult = await pool.query(`
        SELECT id, record_date::text, theme
        FROM records
        WHERE user_id = $1 AND record_date = $2::date
        LIMIT 1
      `, [userId, date]);
        if (recordResult.rowCount === 0) {
            return res.json(null);
        }
        const recordId = recordResult.rows[0].id;
        const detail = await pool.query(`
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
      `, [recordId]);
        return res.json({
            recordId,
            date,
            userId,
            theme: recordResult.rows[0].theme,
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
    }
    catch (error) {
        return res.status(500).json({ error: String(error) });
    }
});
recordsRouter.get("/records/:recordId", async (req, res) => {
    const recordId = req.params.recordId;
    if (!idSchema.safeParse(recordId).success) {
        return res.status(400).json({ error: "Invalid recordId" });
    }
    try {
        const result = await pool.query(`
        SELECT user_id, record_date::text, theme
        FROM records
        WHERE id = $1
        LIMIT 1
      `, [recordId]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Record not found" });
        }
        const base = result.rows[0];
        const detail = await pool.query(`
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
      `, [recordId]);
        return res.json({
            recordId,
            userId: base.user_id,
            date: base.record_date,
            theme: base.theme,
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
    }
    catch (error) {
        return res.status(500).json({ error: String(error) });
    }
});
recordsRouter.patch("/records/by-date/theme", async (req, res) => {
    const parsed = patchRecordThemeByDateSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    const { userId, date, theme } = parsed.data;
    try {
        const result = await pool.query(`
        INSERT INTO records (id, user_id, record_date, theme)
        VALUES ($1, $2, $3::date, $4)
        ON CONFLICT (user_id, record_date)
        DO UPDATE SET
          theme = $4,
          updated_at = now()
        RETURNING id, record_date::text, theme
      `, [randomUUID(), userId, date, theme]);
        const row = result.rows[0];
        return res.json({
            recordId: row.id,
            date: row.record_date,
            userId,
            theme: row.theme
        });
    }
    catch (error) {
        return res.status(500).json({ error: String(error) });
    }
});
recordsRouter.post("/records/by-date/exercises", async (req, res) => {
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
            const recordResult = await client.query(`
          INSERT INTO records (id, user_id, record_date)
          VALUES ($1, $2, $3::date)
          ON CONFLICT (user_id, record_date)
          DO UPDATE SET updated_at = now()
          RETURNING id, record_date::text
        `, [randomUUID(), userId, date]);
            const recordId = recordResult.rows[0].id;
            const exerciseId = randomUUID();
            await client.query(`
          INSERT INTO exercises (id, record_id, exercise_item_id, notes, sort_order)
          VALUES ($1, $2, $3, $4, $5)
        `, [exerciseId, recordId, exerciseItemId, notes ?? null, sortOrder ?? 0]);
            const createdSets = [];
            for (const [index, setItem] of (initialSets ?? []).entries()) {
                const setId = randomUUID();
                const finalOrder = setItem.setOrder ?? index;
                await client.query(`
            INSERT INTO exercise_sets (id, exercise_id, reps, weight, set_order, notes, is_completed)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [setId, exerciseId, setItem.reps, setItem.weight, finalOrder, setItem.notes ?? null, setItem.isCompleted ?? false]);
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
            await saveIdempotentResponse(userId, endpoint, key, 201, payload);
        }
        return res.status(201).json(payload);
    }
    catch (error) {
        return res.status(500).json({ error: String(error) });
    }
});
recordsRouter.post("/records/:recordId/exercises", async (req, res) => {
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
        const recordCheck = await pool.query(`
        SELECT id
        FROM records
        WHERE id = $1 AND user_id = $2
        LIMIT 1
      `, [recordId, userId]);
        if (recordCheck.rowCount === 0) {
            return res.status(404).json({ error: "Record not found for user" });
        }
        const payload = await withTransaction(async (client) => {
            const exerciseId = randomUUID();
            await client.query(`
          INSERT INTO exercises (id, record_id, exercise_item_id, notes, sort_order)
          VALUES ($1, $2, $3, $4, $5)
        `, [exerciseId, recordId, exerciseItemId, notes ?? null, sortOrder ?? 0]);
            const createdSets = [];
            for (const [index, setItem] of (initialSets ?? []).entries()) {
                const setId = randomUUID();
                const finalOrder = setItem.setOrder ?? index;
                await client.query(`
            INSERT INTO exercise_sets (id, exercise_id, reps, weight, set_order, notes, is_completed)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [setId, exerciseId, setItem.reps, setItem.weight, finalOrder, setItem.notes ?? null, setItem.isCompleted ?? false]);
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
            await saveIdempotentResponse(userId, endpoint, key, 201, payload);
        }
        return res.status(201).json(payload);
    }
    catch (error) {
        return res.status(500).json({ error: String(error) });
    }
});

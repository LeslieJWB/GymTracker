import { randomUUID } from "node:crypto";
import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { upsertUserFromAuth } from "../shared/authUsers.js";
import { findIdempotentResponse, idempotencyHeader, saveIdempotentResponse } from "../shared/idempotency.js";
import { createSetSchema, idSchema, patchExerciseSchema, patchSetSchema } from "../shared/validation.js";
export const exercisesRouter = Router();
exercisesRouter.use(requireAuth);
exercisesRouter.get("/exercises/:exerciseId", async (req, res) => {
    if (!req.auth) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const exerciseId = req.params.exerciseId;
    if (!idSchema.safeParse(exerciseId).success) {
        return res.status(400).json({ error: "Invalid exerciseId" });
    }
    try {
        const appUser = await upsertUserFromAuth(req.auth);
        const exerciseResult = await pool.query(`
        SELECT
          e.id,
          e.record_id,
          e.exercise_item_id,
          ei.name AS exercise_item_name,
          e.notes,
          e.sort_order,
          e.updated_at::text
        FROM exercises e
        JOIN exercise_items ei ON ei.id = e.exercise_item_id
        JOIN records r ON r.id = e.record_id
        WHERE e.id = $1
          AND r.user_id = $2
        LIMIT 1
      `, [exerciseId, appUser.id]);
        if (exerciseResult.rowCount === 0) {
            return res.status(404).json({ error: "Exercise not found" });
        }
        const exercise = exerciseResult.rows[0];
        const setsResult = await pool.query(`
        SELECT id, reps, weight::text, set_order, notes, is_completed
        FROM exercise_sets
        WHERE exercise_id = $1
        ORDER BY set_order ASC, created_at ASC
      `, [exerciseId]);
        return res.json({
            id: exercise.id,
            recordId: exercise.record_id,
            exerciseItemId: exercise.exercise_item_id,
            exerciseItemName: exercise.exercise_item_name,
            notes: exercise.notes,
            sortOrder: exercise.sort_order,
            updatedAt: exercise.updated_at,
            sets: setsResult.rows.map((setRow) => ({
                id: setRow.id,
                reps: setRow.reps,
                weight: Number(setRow.weight),
                setOrder: setRow.set_order,
                notes: setRow.notes,
                isCompleted: setRow.is_completed
            }))
        });
    }
    catch (error) {
        return res.status(500).json({ error: String(error) });
    }
});
exercisesRouter.patch("/exercises/:exerciseId", async (req, res) => {
    if (!req.auth) {
        return res.status(401).json({ error: "Unauthorized" });
    }
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
        const appUser = await upsertUserFromAuth(req.auth);
        const result = await pool.query(`
        UPDATE exercises e
        SET
          notes = CASE WHEN $2::boolean THEN $3 ELSE notes END,
          sort_order = CASE WHEN $4::boolean THEN $5 ELSE sort_order END,
          updated_at = now()
        FROM records r
        WHERE e.id = $1
          AND r.id = e.record_id
          AND r.user_id = $6
        RETURNING e.id, e.notes, e.sort_order, e.updated_at::text
      `, [exerciseId, hasNotes, notes ?? null, hasSortOrder, sortOrder ?? null, appUser.id]);
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
    }
    catch (error) {
        return res.status(500).json({ error: String(error) });
    }
});
exercisesRouter.delete("/exercises/:exerciseId", async (req, res) => {
    if (!req.auth) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const exerciseId = req.params.exerciseId;
    if (!idSchema.safeParse(exerciseId).success) {
        return res.status(400).json({ error: "Invalid exerciseId" });
    }
    try {
        const appUser = await upsertUserFromAuth(req.auth);
        const result = await pool.query(`
        DELETE FROM exercises e
        USING records r
        WHERE e.id = $1
          AND r.id = e.record_id
          AND r.user_id = $2
        RETURNING e.id
      `, [exerciseId, appUser.id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Exercise not found" });
        }
        return res.status(204).send();
    }
    catch (error) {
        return res.status(500).json({ error: String(error) });
    }
});
exercisesRouter.post("/exercises/:exerciseId/sets", async (req, res) => {
    if (!req.auth) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const exerciseId = req.params.exerciseId;
    if (!idSchema.safeParse(exerciseId).success) {
        return res.status(400).json({ error: "Invalid exerciseId" });
    }
    const parsed = createSetSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    const { reps, weight, setOrder, notes, isCompleted } = parsed.data;
    const appUser = await upsertUserFromAuth(req.auth);
    const endpoint = "POST /exercises/:exerciseId/sets";
    const key = idempotencyHeader(req);
    if (key) {
        const existing = await findIdempotentResponse(appUser.id, endpoint, key);
        if (existing) {
            return res.status(existing.status).json(existing.body);
        }
    }
    try {
        const ownership = await pool.query(`
        SELECT e.id
        FROM exercises e
        JOIN records r ON r.id = e.record_id
        WHERE e.id = $1 AND r.user_id = $2
        LIMIT 1
      `, [exerciseId, appUser.id]);
        if (ownership.rowCount === 0) {
            return res.status(404).json({ error: "Exercise not found for user" });
        }
        const id = randomUUID();
        const result = await pool.query(`
        INSERT INTO exercise_sets (id, exercise_id, reps, weight, set_order, notes, is_completed)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, reps, weight::text, set_order, notes, is_completed
      `, [id, exerciseId, reps, weight, setOrder ?? 0, notes ?? null, isCompleted ?? false]);
        const row = result.rows[0];
        const payload = {
            id: row.id,
            reps: row.reps,
            weight: Number(row.weight),
            setOrder: row.set_order,
            notes: row.notes,
            isCompleted: row.is_completed
        };
        if (key) {
            await saveIdempotentResponse(appUser.id, endpoint, key, 201, payload);
        }
        return res.status(201).json(payload);
    }
    catch (error) {
        return res.status(500).json({ error: String(error) });
    }
});
exercisesRouter.patch("/exercise-sets/:setId", async (req, res) => {
    if (!req.auth) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const setId = req.params.setId;
    if (!idSchema.safeParse(setId).success) {
        return res.status(400).json({ error: "Invalid setId" });
    }
    const parsed = patchSetSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    const { reps, weight, setOrder, notes, isCompleted } = parsed.data;
    const hasReps = Object.prototype.hasOwnProperty.call(parsed.data, "reps");
    const hasWeight = Object.prototype.hasOwnProperty.call(parsed.data, "weight");
    const hasSetOrder = Object.prototype.hasOwnProperty.call(parsed.data, "setOrder");
    const hasNotes = Object.prototype.hasOwnProperty.call(parsed.data, "notes");
    const hasIsCompleted = Object.prototype.hasOwnProperty.call(parsed.data, "isCompleted");
    try {
        const appUser = await upsertUserFromAuth(req.auth);
        const result = await pool.query(`
        UPDATE exercise_sets es
        SET
          reps = CASE WHEN $2::boolean THEN $3 ELSE reps END,
          weight = CASE WHEN $4::boolean THEN $5 ELSE weight END,
          set_order = CASE WHEN $6::boolean THEN $7 ELSE set_order END,
          notes = CASE WHEN $8::boolean THEN $9 ELSE notes END,
          is_completed = CASE WHEN $10::boolean THEN $11 ELSE is_completed END,
          updated_at = now()
        FROM exercises e
        JOIN records r ON r.id = e.record_id
        WHERE es.id = $1
          AND e.id = es.exercise_id
          AND r.user_id = $12
        RETURNING es.id, es.reps, es.weight::text, es.set_order, es.notes, es.is_completed, es.updated_at::text
      `, [
            setId,
            hasReps,
            reps ?? null,
            hasWeight,
            weight ?? null,
            hasSetOrder,
            setOrder ?? null,
            hasNotes,
            notes ?? null,
            hasIsCompleted,
            isCompleted ?? null,
            appUser.id
        ]);
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
            isCompleted: row.is_completed,
            updatedAt: row.updated_at
        });
    }
    catch (error) {
        return res.status(500).json({ error: String(error) });
    }
});
exercisesRouter.delete("/exercise-sets/:setId", async (req, res) => {
    if (!req.auth) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const setId = req.params.setId;
    if (!idSchema.safeParse(setId).success) {
        return res.status(400).json({ error: "Invalid setId" });
    }
    try {
        const appUser = await upsertUserFromAuth(req.auth);
        const result = await pool.query(`
        DELETE FROM exercise_sets es
        USING exercises e, records r
        WHERE es.id = $1
          AND e.id = es.exercise_id
          AND r.id = e.record_id
          AND r.user_id = $2
        RETURNING es.id
      `, [setId, appUser.id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Set not found" });
        }
        return res.status(204).send();
    }
    catch (error) {
        return res.status(500).json({ error: String(error) });
    }
});

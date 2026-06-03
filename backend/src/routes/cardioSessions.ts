import { randomUUID } from "node:crypto";
import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { upsertUserFromAuth } from "../shared/authUsers.js";
import { isCardioCategory } from "../shared/exerciseCategories.js";
import {
  findIdempotentResponse,
  idempotencyHeader,
  saveIdempotentResponse
} from "../shared/idempotency.js";
import {
  createCardioSessionSchema,
  idSchema,
  patchCardioSessionSchema
} from "../shared/validation.js";

export const cardioSessionsRouter = Router();
cardioSessionsRouter.use(requireAuth);

async function getCardioExerciseContext(
  exerciseId: string,
  userId: string
): Promise<{ category: string | null } | null> {
  const result = await pool.query<{ id: string; category: string | null }>(
    `
      SELECT e.id, ei.category
      FROM exercises e
      JOIN exercise_items ei ON ei.id = e.exercise_item_id
      JOIN records r ON r.id = e.record_id
      WHERE e.id = $1
        AND r.user_id = $2
      LIMIT 1
    `,
    [exerciseId, userId]
  );
  return result.rows[0] ?? null;
}

cardioSessionsRouter.post("/exercises/:exerciseId/cardio-sessions", async (req, res) => {
  if (!req.auth) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const exerciseId = req.params.exerciseId;
  if (!idSchema.safeParse(exerciseId).success) {
    return res.status(400).json({ error: "Invalid exerciseId" });
  }
  const parsed = createCardioSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { durationSeconds, distanceKm, sessionOrder, notes, isCompleted } = parsed.data;
  const appUser = await upsertUserFromAuth(req.auth);
  const endpoint = "POST /exercises/:exerciseId/cardio-sessions";
  const key = idempotencyHeader(req);
  if (key) {
    const existing = await findIdempotentResponse(appUser.id, endpoint, key);
    if (existing) {
      return res.status(existing.status).json(existing.body);
    }
  }

  try {
    const context = await getCardioExerciseContext(exerciseId, appUser.id);
    if (!context) {
      return res.status(404).json({ error: "Exercise not found for user" });
    }
    if (!isCardioCategory(context.category)) {
      return res.status(400).json({ error: "Cardio sessions can only be added to cardio exercises" });
    }

    const id = randomUUID();
    const result = await pool.query<{
      id: string;
      duration_seconds: number;
      distance_km: string | null;
      session_order: number;
      notes: string | null;
      is_completed: boolean;
    }>(
      `
        INSERT INTO cardio_sessions (
          id,
          exercise_id,
          duration_seconds,
          distance_km,
          session_order,
          notes,
          is_completed
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, duration_seconds, distance_km::text, session_order, notes, is_completed
      `,
      [
        id,
        exerciseId,
        durationSeconds,
        distanceKm ?? null,
        sessionOrder ?? 0,
        notes ?? null,
        isCompleted ?? false
      ]
    );
    const row = result.rows[0];
    const payload = {
      id: row.id,
      durationSeconds: row.duration_seconds,
      distanceKm: row.distance_km !== null ? Number(row.distance_km) : null,
      sessionOrder: row.session_order,
      notes: row.notes,
      isCompleted: row.is_completed
    };

    if (key) {
      await saveIdempotentResponse(appUser.id, endpoint, key, 201, payload);
    }

    return res.status(201).json(payload);
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
});

cardioSessionsRouter.patch("/cardio-sessions/:sessionId", async (req, res) => {
  if (!req.auth) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const sessionId = req.params.sessionId;
  if (!idSchema.safeParse(sessionId).success) {
    return res.status(400).json({ error: "Invalid sessionId" });
  }
  const parsed = patchCardioSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { durationSeconds, distanceKm, sessionOrder, notes, isCompleted } = parsed.data;
  const hasDurationSeconds = Object.prototype.hasOwnProperty.call(parsed.data, "durationSeconds");
  const hasDistanceKm = Object.prototype.hasOwnProperty.call(parsed.data, "distanceKm");
  const hasSessionOrder = Object.prototype.hasOwnProperty.call(parsed.data, "sessionOrder");
  const hasNotes = Object.prototype.hasOwnProperty.call(parsed.data, "notes");
  const hasIsCompleted = Object.prototype.hasOwnProperty.call(parsed.data, "isCompleted");

  try {
    const appUser = await upsertUserFromAuth(req.auth);
    const result = await pool.query<{
      id: string;
      duration_seconds: number;
      distance_km: string | null;
      session_order: number;
      notes: string | null;
      is_completed: boolean;
      updated_at: string;
    }>(
      `
        UPDATE cardio_sessions cs
        SET
          duration_seconds = CASE WHEN $2::boolean THEN $3 ELSE cs.duration_seconds END,
          distance_km = CASE WHEN $4::boolean THEN $5 ELSE cs.distance_km END,
          session_order = CASE WHEN $6::boolean THEN $7 ELSE cs.session_order END,
          notes = CASE WHEN $8::boolean THEN $9 ELSE cs.notes END,
          is_completed = CASE WHEN $10::boolean THEN $11 ELSE cs.is_completed END,
          updated_at = now()
        FROM exercises e
        JOIN records r ON r.id = e.record_id
        WHERE cs.id = $1
          AND e.id = cs.exercise_id
          AND r.user_id = $12
        RETURNING
          cs.id,
          cs.duration_seconds,
          cs.distance_km::text,
          cs.session_order,
          cs.notes,
          cs.is_completed,
          cs.updated_at::text
      `,
      [
        sessionId,
        hasDurationSeconds,
        durationSeconds ?? null,
        hasDistanceKm,
        distanceKm ?? null,
        hasSessionOrder,
        sessionOrder ?? null,
        hasNotes,
        notes ?? null,
        hasIsCompleted,
        isCompleted ?? null,
        appUser.id
      ]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Cardio session not found" });
    }
    const row = result.rows[0];
    return res.json({
      id: row.id,
      durationSeconds: row.duration_seconds,
      distanceKm: row.distance_km !== null ? Number(row.distance_km) : null,
      sessionOrder: row.session_order,
      notes: row.notes,
      isCompleted: row.is_completed,
      updatedAt: row.updated_at
    });
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
});

cardioSessionsRouter.delete("/cardio-sessions/:sessionId", async (req, res) => {
  if (!req.auth) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const sessionId = req.params.sessionId;
  if (!idSchema.safeParse(sessionId).success) {
    return res.status(400).json({ error: "Invalid sessionId" });
  }
  try {
    const appUser = await upsertUserFromAuth(req.auth);
    const result = await pool.query(
      `
        DELETE FROM cardio_sessions cs
        USING exercises e, records r
        WHERE cs.id = $1
          AND e.id = cs.exercise_id
          AND r.id = e.record_id
          AND r.user_id = $2
        RETURNING cs.id
      `,
      [sessionId, appUser.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Cardio session not found" });
    }
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
});

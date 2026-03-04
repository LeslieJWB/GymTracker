import { randomUUID } from "node:crypto";
import { Router } from "express";
import { pool, withTransaction } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { upsertUserFromAuth } from "../shared/authUsers.js";
import { createWorkoutTemplateSchema, idSchema, listTemplatesSchema } from "../shared/validation.js";
export const templatesRouter = Router();
templatesRouter.use(requireAuth);
function isTemplateNameConflict(error) {
    if (!error || typeof error !== "object") {
        return false;
    }
    const pgError = error;
    return pgError.code === "23505" && pgError.constraint === "workout_templates_user_name_lower_unique";
}
templatesRouter.get("/templates", async (req, res) => {
    if (!req.auth) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const parsed = listTemplatesSchema.safeParse(req.query);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    try {
        const appUser = await upsertUserFromAuth(req.auth);
        const normalizedSearch = parsed.data.search?.trim().toLowerCase() ?? "";
        const hasSearch = normalizedSearch.length > 0;
        const templatesResult = await pool.query(`
        SELECT
          wt.id,
          wt.name,
          COUNT(DISTINCT wte.id)::text AS exercise_count,
          COUNT(wts.id)::text AS set_count,
          wt.updated_at::text
        FROM workout_templates wt
        LEFT JOIN workout_template_exercises wte ON wte.template_id = wt.id
        LEFT JOIN workout_template_sets wts ON wts.template_exercise_id = wte.id
        WHERE wt.user_id = $1
          AND ($2::boolean = false OR lower(wt.name) LIKE '%' || $3 || '%')
        GROUP BY wt.id, wt.name, wt.updated_at
        ORDER BY wt.updated_at DESC, wt.created_at DESC
      `, [appUser.id, hasSearch, normalizedSearch]);
        return res.json(templatesResult.rows.map((row) => ({
            id: row.id,
            name: row.name,
            exerciseCount: Number(row.exercise_count),
            setCount: Number(row.set_count),
            updatedAt: row.updated_at
        })));
    }
    catch (error) {
        return res.status(500).json({ error: String(error) });
    }
});
templatesRouter.get("/templates/:templateId", async (req, res) => {
    if (!req.auth) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const templateId = req.params.templateId;
    if (!idSchema.safeParse(templateId).success) {
        return res.status(400).json({ error: "Invalid templateId" });
    }
    try {
        const appUser = await upsertUserFromAuth(req.auth);
        const templateResult = await pool.query(`
        SELECT id, name, created_at::text, updated_at::text
        FROM workout_templates
        WHERE id = $1
          AND user_id = $2
        LIMIT 1
      `, [templateId, appUser.id]);
        if (templateResult.rowCount === 0) {
            return res.status(404).json({ error: "Template not found" });
        }
        const exercisesResult = await pool.query(`
        SELECT
          wte.id,
          wte.exercise_item_id,
          ei.name AS exercise_item_name,
          wte.notes,
          wte.sort_order
        FROM workout_template_exercises wte
        JOIN exercise_items ei ON ei.id = wte.exercise_item_id
        WHERE wte.template_id = $1
        ORDER BY wte.sort_order ASC, wte.created_at ASC
      `, [templateId]);
        const setsResult = await pool.query(`
        SELECT
          wts.template_exercise_id,
          wts.id,
          wts.reps,
          wts.weight::text,
          wts.set_order,
          wts.notes
        FROM workout_template_sets wts
        JOIN workout_template_exercises wte ON wte.id = wts.template_exercise_id
        WHERE wte.template_id = $1
        ORDER BY wts.set_order ASC, wts.created_at ASC
      `, [templateId]);
        const setsByTemplateExerciseId = new Map();
        for (const row of setsResult.rows) {
            const current = setsByTemplateExerciseId.get(row.template_exercise_id) ?? [];
            current.push({
                id: row.id,
                reps: row.reps,
                weight: Number(row.weight),
                setOrder: row.set_order,
                notes: row.notes
            });
            setsByTemplateExerciseId.set(row.template_exercise_id, current);
        }
        const template = templateResult.rows[0];
        return res.json({
            id: template.id,
            name: template.name,
            createdAt: template.created_at,
            updatedAt: template.updated_at,
            exercises: exercisesResult.rows.map((row) => ({
                id: row.id,
                exerciseItemId: row.exercise_item_id,
                exerciseItemName: row.exercise_item_name,
                notes: row.notes,
                sortOrder: row.sort_order,
                sets: setsByTemplateExerciseId.get(row.id) ?? []
            }))
        });
    }
    catch (error) {
        return res.status(500).json({ error: String(error) });
    }
});
templatesRouter.post("/templates", async (req, res) => {
    if (!req.auth) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const parsed = createWorkoutTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    const { name, exercises } = parsed.data;
    try {
        const appUser = await upsertUserFromAuth(req.auth);
        const payload = await withTransaction(async (client) => {
            const templateId = randomUUID();
            await client.query(`
          INSERT INTO workout_templates (id, user_id, name)
          VALUES ($1, $2, $3)
        `, [templateId, appUser.id, name]);
            const createdExercises = [];
            for (const [exerciseIndex, exercise] of exercises.entries()) {
                const templateExerciseId = randomUUID();
                const finalSortOrder = exercise.sortOrder ?? exerciseIndex;
                await client.query(`
            INSERT INTO workout_template_exercises (id, template_id, exercise_item_id, notes, sort_order)
            VALUES ($1, $2, $3, $4, $5)
          `, [templateExerciseId, templateId, exercise.exerciseItemId, exercise.notes ?? null, finalSortOrder]);
                const createdSets = [];
                for (const [setIndex, setItem] of (exercise.sets ?? []).entries()) {
                    const templateSetId = randomUUID();
                    const finalSetOrder = setItem.setOrder ?? setIndex;
                    await client.query(`
              INSERT INTO workout_template_sets (id, template_exercise_id, reps, weight, set_order, notes)
              VALUES ($1, $2, $3, $4, $5, $6)
            `, [templateSetId, templateExerciseId, setItem.reps, setItem.weight, finalSetOrder, setItem.notes ?? null]);
                    createdSets.push({
                        id: templateSetId,
                        reps: setItem.reps,
                        weight: setItem.weight,
                        setOrder: finalSetOrder,
                        notes: setItem.notes ?? null
                    });
                }
                createdExercises.push({
                    id: templateExerciseId,
                    exerciseItemId: exercise.exerciseItemId,
                    notes: exercise.notes ?? null,
                    sortOrder: finalSortOrder,
                    sets: createdSets
                });
            }
            return {
                id: templateId,
                name,
                exercises: createdExercises
            };
        });
        return res.status(201).json(payload);
    }
    catch (error) {
        if (isTemplateNameConflict(error)) {
            return res.status(409).json({
                error: "Template name already exists. Please use a different name.",
                code: "TEMPLATE_NAME_CONFLICT"
            });
        }
        return res.status(500).json({ error: String(error) });
    }
});

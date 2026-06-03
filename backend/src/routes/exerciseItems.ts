import { Router } from "express";
import { pool } from "../db.js";
import { toExerciseImageUrl } from "../shared/exerciseImageUrl.js";

export const exerciseItemsRouter = Router();

exerciseItemsRouter.get("/exercise-items", async (_req, res) => {
  try {
    const result = await pool.query<{
      id: string;
      name: string;
      muscle_group: string | null;
      image_path: string | null;
      category: string | null;
    }>(
      `
        SELECT id, name, muscle_group, image_path, category
        FROM exercise_items
        ORDER BY lower(name) ASC
      `
    );
    return res.json(
      result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        muscleGroup: row.muscle_group,
        imageUrl: toExerciseImageUrl(row.image_path),
        category: row.category
      }))
    );
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
});

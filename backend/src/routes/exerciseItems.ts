import { Router } from "express";
import { pool } from "../db.js";

export const exerciseItemsRouter = Router();

const SOURCE_IMAGE_BASE_URL =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises";

function toExerciseImageUrl(imagePath: string | null): string | null {
  if (!imagePath) {
    return null;
  }
  if (/^https?:\/\//i.test(imagePath)) {
    return imagePath;
  }
  const normalized = imagePath
    .trim()
    .replace(/^\/+/, "")
    .replace(/^exercises\//i, "");
  return normalized ? `${SOURCE_IMAGE_BASE_URL}/${normalized}` : null;
}

exerciseItemsRouter.get("/exercise-items", async (_req, res) => {
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
      result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        muscleGroup: row.muscle_group,
        imageUrl: toExerciseImageUrl(row.image_path)
      }))
    );
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
});

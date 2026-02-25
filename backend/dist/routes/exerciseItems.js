import { Router } from "express";
import { pool } from "../db.js";
export const exerciseItemsRouter = Router();
exerciseItemsRouter.get("/exercise-items", async (req, res) => {
    try {
        const result = await pool.query(`
        SELECT id, name, muscle_group, image_path
        FROM exercise_items
        ORDER BY lower(name) ASC
      `);
        return res.json(result.rows.map((row) => ({
            id: row.id,
            name: row.name,
            muscleGroup: row.muscle_group,
            imageUrl: row.image_path
                ? `${req.protocol}://${req.get("host")}/assets/${row.image_path.replace(/^\//, "")}`
                : null
        })));
    }
    catch (error) {
        return res.status(500).json({ error: String(error) });
    }
});

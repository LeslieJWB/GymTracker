import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { upsertUserFromAuth } from "../shared/authUsers.js";
import { daysAgo, todayDate } from "../shared/dates.js";
import {
  aggregateExerciseHistory,
  aggregateNutritionHistory,
  type Granularity
} from "../shared/statisticsAggregation.js";
import { dateRangeWithGranularitySchema, exerciseHistorySchema } from "../shared/validation.js";

export const statisticsRouter = Router();
statisticsRouter.use(requireAuth);

statisticsRouter.get("/statistics/nutrition-history", async (req, res) => {
  if (!req.auth) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const parsed = dateRangeWithGranularitySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: "dates must be YYYY-MM-DD when provided"
    });
  }
  const from = parsed.data.from ?? daysAgo(365);
  const to = parsed.data.to ?? todayDate();
  const granularity = (parsed.data.granularity ?? "day") as Granularity;
  if (from > to) {
    return res.status(400).json({ error: "'from' cannot be after 'to'" });
  }

  try {
    const appUser = await upsertUserFromAuth(req.auth);
    const result = await pool.query<{
      record_date: string;
      total_calories_kcal: string;
      total_protein_g: string;
      total_fat_g: string;
    }>(
      `
        SELECT
          r.record_date::text,
          COALESCE(SUM(fc.calories_kcal), 0)::text AS total_calories_kcal,
          COALESCE(SUM(fc.protein_g), 0)::text AS total_protein_g,
          COALESCE(SUM(fc.fat_g), 0)::text AS total_fat_g
        FROM records r
        LEFT JOIN food_consumptions fc ON fc.record_id = r.id
        WHERE r.user_id = $1
          AND r.record_date >= $2::date
          AND r.record_date <= $3::date
        GROUP BY r.record_date
        ORDER BY r.record_date ASC
      `,
      [appUser.id, from, to]
    );

    const daily = result.rows.map((row) => ({
      date: row.record_date,
      totalCaloriesKcal: Number(row.total_calories_kcal),
      totalProteinG: Number(row.total_protein_g),
      totalFatG: Number(row.total_fat_g)
    }));
    return res.json({
      records: aggregateNutritionHistory(daily, granularity)
    });
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
});

statisticsRouter.get("/statistics/exercise-history", async (req, res) => {
  if (!req.auth) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const parsed = exerciseHistorySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: "exerciseItemId is required and dates must be YYYY-MM-DD when provided"
    });
  }
  const from = parsed.data.from ?? daysAgo(365);
  const to = parsed.data.to ?? todayDate();
  const granularity = (parsed.data.granularity ?? "day") as Granularity;
  if (from > to) {
    return res.status(400).json({ error: "'from' cannot be after 'to'" });
  }

  try {
    const appUser = await upsertUserFromAuth(req.auth);
    const result = await pool.query<{
      record_date: string;
      daily_volume: number;
      top_set_weight: string;
      top_set_volume: number;
    }>(
      `
        SELECT
          r.record_date::text,
          COALESCE(SUM(es.reps * es.weight), 0)::double precision AS daily_volume,
          COALESCE(MAX(es.weight), 0)::text AS top_set_weight,
          COALESCE(MAX(es.reps * es.weight), 0)::double precision AS top_set_volume
        FROM records r
        JOIN exercises e ON e.record_id = r.id
        LEFT JOIN exercise_sets es ON es.exercise_id = e.id AND es.is_completed = TRUE
        WHERE r.user_id = $1
          AND e.exercise_item_id = $2
          AND r.record_date >= $3::date
          AND r.record_date <= $4::date
        GROUP BY r.record_date
        ORDER BY r.record_date ASC
      `,
      [appUser.id, parsed.data.exerciseItemId, from, to]
    );

    const daily = result.rows.map((row) => ({
      date: row.record_date,
      dailyVolume: Number(row.daily_volume),
      topSetWeight: Number(row.top_set_weight),
      topSetVolume: Number(row.top_set_volume)
    }));
    return res.json({
      records: aggregateExerciseHistory(daily, granularity)
    });
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
});

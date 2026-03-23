import { randomUUID } from "node:crypto";
import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { upsertUserFromAuth } from "../shared/authUsers.js";
import { daysAgo, todayDate } from "../shared/dates.js";
import { aggregateBodyWeightHistory } from "../shared/statisticsAggregation.js";
import { bodyWeightByDateSchema, byDateNoUserSchema, dateRangeWithGranularitySchema } from "../shared/validation.js";
export const bodyWeightRouter = Router();
bodyWeightRouter.use(requireAuth);
bodyWeightRouter.get("/body-weight/by-date", async (req, res) => {
    if (!req.auth) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const parsed = byDateNoUserSchema.safeParse(req.query);
    if (!parsed.success) {
        return res.status(400).json({ error: "date is required" });
    }
    try {
        const appUser = await upsertUserFromAuth(req.auth);
        const result = await pool.query(`
        SELECT weight_kg::text, body_fat_percentage::text
        FROM body_weight_records
        WHERE user_id = $1 AND record_date = $2::date
        LIMIT 1
      `, [appUser.id, parsed.data.date]);
        return res.json({
            date: parsed.data.date,
            weightKg: result.rowCount ? Number(result.rows[0].weight_kg) : null,
            bodyFatPercentage: result.rowCount && result.rows[0].body_fat_percentage !== null
                ? Number(result.rows[0].body_fat_percentage)
                : null
        });
    }
    catch (error) {
        return res.status(500).json({ error: String(error) });
    }
});
bodyWeightRouter.put("/body-weight/by-date", async (req, res) => {
    if (!req.auth) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const parsed = bodyWeightByDateSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    try {
        const appUser = await upsertUserFromAuth(req.auth);
        const hasBodyFatPercentage = Object.prototype.hasOwnProperty.call(parsed.data, "bodyFatPercentage");
        const result = await pool.query(`
        INSERT INTO body_weight_records (id, user_id, record_date, weight_kg, body_fat_percentage)
        VALUES ($1, $2, $3::date, $4, CASE WHEN $5::boolean THEN $6::numeric(4,1) ELSE NULL END)
        ON CONFLICT (user_id, record_date)
        DO UPDATE SET
          weight_kg = EXCLUDED.weight_kg,
          body_fat_percentage = CASE
            WHEN $5::boolean THEN EXCLUDED.body_fat_percentage
            ELSE body_weight_records.body_fat_percentage
          END,
          updated_at = now()
        RETURNING id, record_date::text, weight_kg::text, body_fat_percentage::text, updated_at::text
      `, [
            randomUUID(),
            appUser.id,
            parsed.data.date,
            parsed.data.weightKg,
            hasBodyFatPercentage,
            parsed.data.bodyFatPercentage ?? null
        ]);
        const row = result.rows[0];
        return res.json({
            id: row.id,
            date: row.record_date,
            weightKg: Number(row.weight_kg),
            bodyFatPercentage: row.body_fat_percentage !== null ? Number(row.body_fat_percentage) : null,
            updatedAt: row.updated_at
        });
    }
    catch (error) {
        return res.status(500).json({ error: String(error) });
    }
});
bodyWeightRouter.delete("/body-weight/by-date", async (req, res) => {
    if (!req.auth) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const parsed = byDateNoUserSchema.safeParse(req.query);
    if (!parsed.success) {
        return res.status(400).json({ error: "date is required" });
    }
    try {
        const appUser = await upsertUserFromAuth(req.auth);
        const result = await pool.query(`DELETE FROM body_weight_records WHERE user_id = $1 AND record_date = $2::date`, [appUser.id, parsed.data.date]);
        return res.json({ date: parsed.data.date, deleted: (result.rowCount ?? 0) > 0 });
    }
    catch (error) {
        return res.status(500).json({ error: String(error) });
    }
});
bodyWeightRouter.get("/body-weight/history", async (req, res) => {
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
    const granularity = (parsed.data.granularity ?? "day");
    if (from > to) {
        return res.status(400).json({ error: "'from' cannot be after 'to'" });
    }
    try {
        const appUser = await upsertUserFromAuth(req.auth);
        const result = await pool.query(`
        SELECT record_date::text, weight_kg::text, body_fat_percentage::text
        FROM body_weight_records
        WHERE user_id = $1
          AND record_date >= $2::date
          AND record_date <= $3::date
        ORDER BY record_date ASC
      `, [appUser.id, from, to]);
        const daily = result.rows.map((row) => ({
            date: row.record_date,
            weightKg: Number(row.weight_kg),
            bodyFatPercentage: row.body_fat_percentage !== null ? Number(row.body_fat_percentage) : null
        }));
        return res.json({
            records: aggregateBodyWeightHistory(daily, granularity)
        });
    }
    catch (error) {
        return res.status(500).json({ error: String(error) });
    }
});

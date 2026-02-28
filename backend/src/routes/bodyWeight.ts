import { randomUUID } from "node:crypto";
import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { upsertUserFromAuth } from "../shared/authUsers.js";
import { daysAgo, todayDate } from "../shared/dates.js";
import {
  bodyWeightByDateSchema,
  byDateNoUserSchema,
  dateRangeNoUserSchema
} from "../shared/validation.js";

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
    const result = await pool.query<{ weight_kg: string }>(
      `
        SELECT weight_kg::text
        FROM body_weight_records
        WHERE user_id = $1 AND record_date = $2::date
        LIMIT 1
      `,
      [appUser.id, parsed.data.date]
    );

    return res.json({
      date: parsed.data.date,
      weightKg: result.rowCount ? Number(result.rows[0].weight_kg) : null
    });
  } catch (error) {
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
    const result = await pool.query<{
      id: string;
      record_date: string;
      weight_kg: string;
      updated_at: string;
    }>(
      `
        INSERT INTO body_weight_records (id, user_id, record_date, weight_kg)
        VALUES ($1, $2, $3::date, $4)
        ON CONFLICT (user_id, record_date)
        DO UPDATE SET
          weight_kg = EXCLUDED.weight_kg,
          updated_at = now()
        RETURNING id, record_date::text, weight_kg::text, updated_at::text
      `,
      [randomUUID(), appUser.id, parsed.data.date, parsed.data.weightKg]
    );

    const row = result.rows[0];
    return res.json({
      id: row.id,
      date: row.record_date,
      weightKg: Number(row.weight_kg),
      updatedAt: row.updated_at
    });
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
});

bodyWeightRouter.get("/body-weight/history", async (req, res) => {
  if (!req.auth) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const parsed = dateRangeNoUserSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: "dates must be YYYY-MM-DD when provided"
    });
  }
  const from = parsed.data.from ?? daysAgo(365);
  const to = parsed.data.to ?? todayDate();
  if (from > to) {
    return res.status(400).json({ error: "'from' cannot be after 'to'" });
  }

  try {
    const appUser = await upsertUserFromAuth(req.auth);
    const result = await pool.query<{
      record_date: string;
      weight_kg: string;
    }>(
      `
        SELECT record_date::text, weight_kg::text
        FROM body_weight_records
        WHERE user_id = $1
          AND record_date >= $2::date
          AND record_date <= $3::date
        ORDER BY record_date ASC
      `,
      [appUser.id, from, to]
    );

    return res.json({
      records: result.rows.map((row) => ({
        date: row.record_date,
        weightKg: Number(row.weight_kg)
      }))
    });
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
});

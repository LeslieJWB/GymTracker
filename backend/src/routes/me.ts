import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { upsertUserFromAuth } from "../shared/authUsers.js";

const profileSchema = z.object({
  heightCm: z.number().min(50).max(280).nullable().optional(),
  gender: z.string().trim().min(1).max(30).nullable().optional(),
  defaultBodyWeightKg: z.number().min(20).max(400).nullable().optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  globalLlmPrompt: z.string().trim().max(3000).nullable().optional()
});

export const meRouter = Router();

meRouter.use(requireAuth);

meRouter.get("/me", async (req, res) => {
  if (!req.auth) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const user = await upsertUserFromAuth(req.auth);
    return res.json(user);
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
});

meRouter.get("/me/profile", async (req, res) => {
  if (!req.auth) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const user = await upsertUserFromAuth(req.auth);
    const result = await pool.query<{
      height_cm: string | null;
      gender: string | null;
      default_body_weight_kg: string | null;
      date_of_birth: string | null;
      global_llm_prompt: string | null;
    }>(
      `
        SELECT
          height_cm::text,
          gender,
          default_body_weight_kg::text,
          date_of_birth::text,
          global_llm_prompt
        FROM users
        WHERE id = $1
        LIMIT 1
      `,
      [user.id]
    );
    const row = result.rows[0];
    return res.json({
      ...user,
      heightCm: row?.height_cm ? Number(row.height_cm) : null,
      gender: row?.gender ?? null,
      defaultBodyWeightKg: row?.default_body_weight_kg ? Number(row.default_body_weight_kg) : null,
      dateOfBirth: row?.date_of_birth ?? null,
      globalLlmPrompt: row?.global_llm_prompt ?? null
    });
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
});

meRouter.put("/me/profile", async (req, res) => {
  if (!req.auth) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  try {
    const user = await upsertUserFromAuth(req.auth);
    const data = parsed.data;
    const hasHeightCm = Object.prototype.hasOwnProperty.call(data, "heightCm");
    const hasGender = Object.prototype.hasOwnProperty.call(data, "gender");
    const hasDefaultBodyWeightKg = Object.prototype.hasOwnProperty.call(data, "defaultBodyWeightKg");
    const hasDateOfBirth = Object.prototype.hasOwnProperty.call(data, "dateOfBirth");
    const hasGlobalLlmPrompt = Object.prototype.hasOwnProperty.call(data, "globalLlmPrompt");

    const result = await pool.query<{
      height_cm: string | null;
      gender: string | null;
      default_body_weight_kg: string | null;
      date_of_birth: string | null;
      global_llm_prompt: string | null;
    }>(
      `
        UPDATE users
        SET
          height_cm = CASE WHEN $2::boolean THEN $3 ELSE height_cm END,
          gender = CASE WHEN $4::boolean THEN $5 ELSE gender END,
          default_body_weight_kg = CASE WHEN $6::boolean THEN $7 ELSE default_body_weight_kg END,
          date_of_birth = CASE WHEN $8::boolean THEN $9::date ELSE date_of_birth END,
          global_llm_prompt = CASE WHEN $10::boolean THEN $11 ELSE global_llm_prompt END,
          updated_at = now()
        WHERE id = $1
        RETURNING
          height_cm::text,
          gender,
          default_body_weight_kg::text,
          date_of_birth::text,
          global_llm_prompt
      `,
      [
        user.id,
        hasHeightCm,
        data.heightCm ?? null,
        hasGender,
        data.gender?.trim() || null,
        hasDefaultBodyWeightKg,
        data.defaultBodyWeightKg ?? null,
        hasDateOfBirth,
        data.dateOfBirth ?? null,
        hasGlobalLlmPrompt,
        data.globalLlmPrompt?.trim() || null
      ]
    );
    const row = result.rows[0];
    return res.json({
      ...user,
      heightCm: row.height_cm ? Number(row.height_cm) : null,
      gender: row.gender,
      defaultBodyWeightKg: row.default_body_weight_kg ? Number(row.default_body_weight_kg) : null,
      dateOfBirth: row.date_of_birth,
      globalLlmPrompt: row.global_llm_prompt
    });
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
});


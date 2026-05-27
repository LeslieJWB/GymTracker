import { Router } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { upsertUserFromAuth } from "../shared/authUsers.js";
import { getLlmQuotaStatus } from "../shared/llmQuota.js";
import { syncSubscriberFromRevenueCat } from "../shared/revenueCatSync.js";

const subscriptionSyncSchema = z.object({
  isActive: z.boolean(),
  expiresAt: z.string().nullable().optional(),
  productIdentifier: z.string().trim().min(1).nullable().optional()
});

const profileSchema = z.object({
  heightCm: z.number().min(50).max(280).nullable().optional(),
  gender: z.string().trim().min(1).max(30).nullable().optional(),
  defaultBodyWeightKg: z.number().min(20).max(400).nullable().optional(),
  defaultBodyFatPercentage: z.number().min(3).max(60).nullable().optional(),
  dailyCalorieTargetKcal: z.number().min(800).max(6000).nullable().optional(),
  dailyProteinTargetG: z.number().min(30).max(400).nullable().optional(),
  dailyFatTargetG: z.number().min(20).max(200).nullable().optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  globalLlmPrompt: z.string().trim().max(3000).nullable().optional(),
  profileInitialized: z.boolean().optional()
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

meRouter.post("/me/subscription/sync", async (req, res) => {
  if (!req.auth) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const hasClientReport =
    req.body &&
    typeof req.body === "object" &&
    Object.prototype.hasOwnProperty.call(req.body, "isActive");
  const parsed = hasClientReport ? subscriptionSyncSchema.safeParse(req.body) : null;
  if (hasClientReport && parsed && !parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const clientReport = parsed?.success
    ? {
        isActive: parsed.data.isActive,
        expiresAt: parsed.data.expiresAt ?? null,
        productIdentifier: parsed.data.productIdentifier ?? null
      }
    : undefined;

  try {
    const user = await upsertUserFromAuth(req.auth);
    const sync = await syncSubscriberFromRevenueCat(req.auth.supabaseUserId, clientReport);
    if (!sync.synced) {
      return res.status(503).json({
        error: "subscription_sync_unavailable",
        message:
          "Set REVENUECAT_SECRET_API_KEY on the server, or send subscription state from the app in development."
      });
    }

    const status = await getLlmQuotaStatus({
      userId: user.id,
      supabaseUserId: req.auth.supabaseUserId
    });

    return res.json({
      subscriptionActive: sync.isActive,
      syncSource: sync.source,
      ...status
    });
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
});

meRouter.get("/me/llm-quota", async (req, res) => {
  if (!req.auth) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const user = await upsertUserFromAuth(req.auth);
    const status = await getLlmQuotaStatus({
      userId: user.id,
      supabaseUserId: req.auth.supabaseUserId
    });
    return res.json(status);
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
      default_body_fat_percentage: string | null;
      daily_calorie_target_kcal: string | null;
      daily_protein_target_g: string | null;
      daily_fat_target_g: string | null;
      date_of_birth: string | null;
      global_llm_prompt: string | null;
      profile_initialized: boolean;
    }>(
      `
        SELECT
          height_cm::text,
          gender,
          default_body_weight_kg::text,
          default_body_fat_percentage::text,
          daily_calorie_target_kcal::text,
          daily_protein_target_g::text,
          daily_fat_target_g::text,
          date_of_birth::text,
          global_llm_prompt,
          profile_initialized
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
      defaultBodyFatPercentage: row?.default_body_fat_percentage ? Number(row.default_body_fat_percentage) : null,
      dailyCalorieTargetKcal: row?.daily_calorie_target_kcal ? Number(row.daily_calorie_target_kcal) : null,
      dailyProteinTargetG: row?.daily_protein_target_g ? Number(row.daily_protein_target_g) : null,
      dailyFatTargetG: row?.daily_fat_target_g ? Number(row.daily_fat_target_g) : null,
      dateOfBirth: row?.date_of_birth ?? null,
      globalLlmPrompt: row?.global_llm_prompt ?? null,
      profileInitialized: row?.profile_initialized ?? false
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
    const hasDefaultBodyFatPercentage = Object.prototype.hasOwnProperty.call(data, "defaultBodyFatPercentage");
    const hasDailyCalorieTargetKcal = Object.prototype.hasOwnProperty.call(data, "dailyCalorieTargetKcal");
    const hasDailyProteinTargetG = Object.prototype.hasOwnProperty.call(data, "dailyProteinTargetG");
    const hasDailyFatTargetG = Object.prototype.hasOwnProperty.call(data, "dailyFatTargetG");
    const hasDateOfBirth = Object.prototype.hasOwnProperty.call(data, "dateOfBirth");
    const hasGlobalLlmPrompt = Object.prototype.hasOwnProperty.call(data, "globalLlmPrompt");
    const wantsInitialize = data.profileInitialized === true;
    const currentResult = await pool.query<{
      height_cm: string | null;
      gender: string | null;
      default_body_weight_kg: string | null;
      default_body_fat_percentage: string | null;
      date_of_birth: string | null;
    }>(
      `
        SELECT
          height_cm::text,
          gender,
          default_body_weight_kg::text,
          default_body_fat_percentage::text,
          date_of_birth::text
        FROM users
        WHERE id = $1
        LIMIT 1
      `,
      [user.id]
    );
    const currentRow = currentResult.rows[0];
    const nextHeightCm = hasHeightCm ? data.heightCm ?? null : currentRow?.height_cm ? Number(currentRow.height_cm) : null;
    const nextGender = hasGender ? data.gender?.trim() || null : currentRow?.gender ?? null;
    const nextDefaultBodyWeightKg = hasDefaultBodyWeightKg
      ? data.defaultBodyWeightKg ?? null
      : currentRow?.default_body_weight_kg
        ? Number(currentRow.default_body_weight_kg)
        : null;
    const nextDefaultBodyFatPercentage = hasDefaultBodyFatPercentage
      ? data.defaultBodyFatPercentage ?? null
      : currentRow?.default_body_fat_percentage
        ? Number(currentRow.default_body_fat_percentage)
        : null;
    const nextDateOfBirth = hasDateOfBirth ? data.dateOfBirth ?? null : currentRow?.date_of_birth ?? null;
    const canInitialize =
      wantsInitialize &&
      nextHeightCm !== null &&
      nextDefaultBodyWeightKg !== null &&
      nextDateOfBirth !== null &&
      Boolean(nextGender && nextGender.trim().length > 0);

    const result = await pool.query<{
      height_cm: string | null;
      gender: string | null;
      default_body_weight_kg: string | null;
      default_body_fat_percentage: string | null;
      daily_calorie_target_kcal: string | null;
      daily_protein_target_g: string | null;
      daily_fat_target_g: string | null;
      date_of_birth: string | null;
      global_llm_prompt: string | null;
      profile_initialized: boolean;
    }>(
      `
        UPDATE users
        SET
          height_cm = CASE WHEN $2::boolean THEN $3 ELSE height_cm END,
          gender = CASE WHEN $4::boolean THEN $5 ELSE gender END,
          default_body_weight_kg = CASE WHEN $6::boolean THEN $7 ELSE default_body_weight_kg END,
          default_body_fat_percentage = CASE WHEN $8::boolean THEN $9::numeric(4,1) ELSE default_body_fat_percentage END,
          daily_calorie_target_kcal = CASE WHEN $10::boolean THEN $11 ELSE daily_calorie_target_kcal END,
          daily_protein_target_g = CASE WHEN $12::boolean THEN $13 ELSE daily_protein_target_g END,
          daily_fat_target_g = CASE WHEN $14::boolean THEN $15 ELSE daily_fat_target_g END,
          date_of_birth = CASE WHEN $16::boolean THEN $17::date ELSE date_of_birth END,
          global_llm_prompt = CASE WHEN $18::boolean THEN $19 ELSE global_llm_prompt END,
          profile_initialized = CASE
            WHEN profile_initialized THEN true
            WHEN $20::boolean THEN true
            ELSE false
          END,
          updated_at = now()
        WHERE id = $1
        RETURNING
          height_cm::text,
          gender,
          default_body_weight_kg::text,
          default_body_fat_percentage::text,
          daily_calorie_target_kcal::text,
          daily_protein_target_g::text,
          daily_fat_target_g::text,
          date_of_birth::text,
          global_llm_prompt,
          profile_initialized
      `,
      [
        user.id,
        hasHeightCm,
        data.heightCm ?? null,
        hasGender,
        data.gender?.trim() || null,
        hasDefaultBodyWeightKg,
        data.defaultBodyWeightKg ?? null,
        hasDefaultBodyFatPercentage,
        data.defaultBodyFatPercentage ?? null,
        hasDailyCalorieTargetKcal,
        data.dailyCalorieTargetKcal ?? null,
        hasDailyProteinTargetG,
        data.dailyProteinTargetG ?? null,
        hasDailyFatTargetG,
        data.dailyFatTargetG ?? null,
        hasDateOfBirth,
        data.dateOfBirth ?? null,
        hasGlobalLlmPrompt,
        data.globalLlmPrompt?.trim() || null,
        canInitialize
      ]
    );
    const row = result.rows[0];
    if (hasDailyCalorieTargetKcal || hasDailyProteinTargetG || hasDailyFatTargetG) {
      const hasAnyOverride =
        row.daily_calorie_target_kcal !== null ||
        row.daily_protein_target_g !== null ||
        row.daily_fat_target_g !== null;
      await pool.query(
        `
          INSERT INTO records (
            id,
            user_id,
            record_date,
            daily_calorie_target_kcal,
            daily_protein_target_g,
            daily_fat_target_g,
            daily_target_source,
            daily_target_comment
          )
          VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7)
          ON CONFLICT (user_id, record_date)
          DO UPDATE SET
            daily_calorie_target_kcal = $3,
            daily_protein_target_g = $4,
            daily_fat_target_g = $5,
            daily_target_source = $6,
            daily_target_comment = $7,
            updated_at = now()
        `,
        [
          randomUUID(),
          user.id,
          row.daily_calorie_target_kcal,
          row.daily_protein_target_g,
          row.daily_fat_target_g,
          hasAnyOverride ? "override" : null,
          hasAnyOverride ? "Using your custom daily nutrition targets from profile settings." : null
        ]
      );
    }
    return res.json({
      ...user,
      heightCm: row.height_cm ? Number(row.height_cm) : null,
      gender: row.gender,
      defaultBodyWeightKg: row.default_body_weight_kg ? Number(row.default_body_weight_kg) : null,
      defaultBodyFatPercentage: row.default_body_fat_percentage ? Number(row.default_body_fat_percentage) : null,
      dailyCalorieTargetKcal: row.daily_calorie_target_kcal ? Number(row.daily_calorie_target_kcal) : null,
      dailyProteinTargetG: row.daily_protein_target_g ? Number(row.daily_protein_target_g) : null,
      dailyFatTargetG: row.daily_fat_target_g ? Number(row.daily_fat_target_g) : null,
      dateOfBirth: row.date_of_birth,
      globalLlmPrompt: row.global_llm_prompt,
      profileInitialized: row.profile_initialized
    });
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
});


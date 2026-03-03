import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { generateLlmText, llmProvider } from "../config.js";
import { pool, withTransaction } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { getPromptProfile, upsertUserFromAuth, type PromptProfile } from "../shared/authUsers.js";
import {
  findIdempotentResponse,
  idempotencyHeader,
  saveIdempotentResponse
} from "../shared/idempotency.js";
import { buildStructuredPrompt } from "../shared/llmPrompt.js";
import {
  idSchema
} from "../shared/validation.js";

type FoodAnalysis = {
  description: string;
  caloriesKcal: number;
  proteinG: number;
  comment: string;
  source: "kimi" | "gemini" | "fallback";
};

const foodAnalysisSchema = z.object({
  description: z.string().trim().min(1).max(2000),
  caloriesKcal: z.number().nonnegative(),
  proteinG: z.number().nonnegative(),
  comment: z.string().trim().min(1).max(2000)
});

export const foodRouter = Router();
foodRouter.use(requireAuth);

const byDateInputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

const createFoodConsumptionInputSchema = byDateInputSchema
  .extend({
    text: z.string().trim().min(1).max(2000).optional(),
    image: z
      .object({
        mimeType: z.string().regex(/^image\/[A-Za-z0-9.+-]+$/, "Invalid image mime type"),
        dataBase64: z.string().min(16).max(4_000_000)
      })
      .optional()
  })
  .superRefine((value, ctx) => {
    if (!value.text && !value.image) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Either text or image is required",
        path: ["text"]
      });
    }
  });

function toSafeNumber(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Number(value.toFixed(2));
}

function cleanText(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function parseFoodAnalysis(raw: string): FoodAnalysis | null {
  try {
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    const validated = foodAnalysisSchema.safeParse(parsed);
    if (!validated.success) {
      return null;
    }
    return {
      description: validated.data.description.slice(0, 2000),
      caloriesKcal: toSafeNumber(validated.data.caloriesKcal),
      proteinG: toSafeNumber(validated.data.proteinG),
      comment: validated.data.comment.slice(0, 2000),
      source: llmProvider?.name ?? "fallback"
    };
  } catch {
    return null;
  }
}

async function analyzeFoodConsumption(
  text: string | null,
  image: { mimeType: string; dataBase64: string } | undefined,
  promptProfile: PromptProfile
): Promise<FoodAnalysis> {
  const fallbackDescription =
    text?.trim() ||
    (image ? "Food entry described from the provided photo." : "Food entry description unavailable.");
  const fallback: FoodAnalysis = {
    description: fallbackDescription.slice(0, 2000),
    caloriesKcal: 0,
    proteinG: 0,
    comment:
      "AI nutrition analysis is not available right now. Calories and protein are set to 0 until analysis succeeds.",
    source: "fallback"
  };

  if (!llmProvider) {
    return fallback;
  }

  const prompt = buildStructuredPrompt({
    profile: promptProfile,
    customPrompt: promptProfile.globalLlmPrompt,
    requestContext: `You are a nutrition assistant.
Analyze the provided food intake text and/or image.
Return ONLY JSON with this exact shape:
{"description":"<one concise sentence describing the intake>","caloriesKcal":<number>,"proteinG":<number>,"comment":"<one short practical nutrition comment>"}
Rules:
- If text is missing, infer description from image.
- If image is missing, infer from text.
- If both exist, combine both sources.
- caloriesKcal and proteinG must be non-negative numbers.
- Keep the comment concise and actionable.`
  });

  try {
    const raw = await generateLlmText({
      prompt,
      userText: text ?? "(none provided)",
      image
    });
    if (!raw) {
      return fallback;
    }
    const parsed = parseFoodAnalysis(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

foodRouter.get("/records/by-date/food", async (req, res) => {
  if (!req.auth) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const parsed = byDateInputSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "date is required" });
  }
  const { date } = parsed.data;

  try {
    const appUser = await upsertUserFromAuth(req.auth);
    const recordResult = await pool.query<{ id: string }>(
      `
        SELECT id
        FROM records
        WHERE user_id = $1 AND record_date = $2::date
        LIMIT 1
      `,
      [appUser.id, date]
    );

    if (recordResult.rowCount === 0) {
      return res.json({
        entries: [],
        totalCaloriesKcal: 0,
        totalProteinG: 0
      });
    }

    const recordId = recordResult.rows[0].id;
    const entriesResult = await pool.query<{
      id: string;
      description: string;
      input_mode: "text" | "text_image" | "image";
      calories_kcal: string;
      protein_g: string;
      llm_comment: string;
      llm_source: string;
      created_at: string;
      updated_at: string;
    }>(
      `
        SELECT
          id,
          description,
          input_mode,
          calories_kcal::text,
          protein_g::text,
          llm_comment,
          llm_source,
          created_at::text,
          updated_at::text
        FROM food_consumptions
        WHERE record_id = $1
        ORDER BY created_at DESC
      `,
      [recordId]
    );

    const totalsResult = await pool.query<{ total_calories_kcal: string; total_protein_g: string }>(
      `
        SELECT
          COALESCE(SUM(calories_kcal), 0)::text AS total_calories_kcal,
          COALESCE(SUM(protein_g), 0)::text AS total_protein_g
        FROM food_consumptions
        WHERE record_id = $1
      `,
      [recordId]
    );

    return res.json({
      entries: entriesResult.rows.map((row) => ({
        id: row.id,
        description: row.description,
        inputMode: row.input_mode,
        caloriesKcal: Number(row.calories_kcal),
        proteinG: Number(row.protein_g),
        comment: row.llm_comment,
        llmSource: row.llm_source,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      })),
      totalCaloriesKcal: Number(totalsResult.rows[0].total_calories_kcal),
      totalProteinG: Number(totalsResult.rows[0].total_protein_g)
    });
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
});

foodRouter.post("/records/by-date/food", async (req, res) => {
  if (!req.auth) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const parsed = createFoodConsumptionInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { date, text, image } = parsed.data;
  const appUser = await upsertUserFromAuth(req.auth);
  const promptProfile = await getPromptProfile(appUser.id, date);
  const endpoint = "POST /records/by-date/food";
  const key = idempotencyHeader(req);
  if (key) {
    const existing = await findIdempotentResponse(appUser.id, endpoint, key);
    if (existing) {
      return res.status(existing.status).json(existing.body);
    }
  }

  try {
    const analysis = await analyzeFoodConsumption(cleanText(text), image, promptProfile);
    const inputMode: "text" | "text_image" | "image" =
      text && image ? "text_image" : image ? "image" : "text";

    const payload = await withTransaction(async (client) => {
      const recordResult = await client.query<{ id: string }>(
        `
          INSERT INTO records (id, user_id, record_date)
          VALUES ($1, $2, $3::date)
          ON CONFLICT (user_id, record_date)
          DO UPDATE SET updated_at = now()
          RETURNING id
        `,
        [randomUUID(), appUser.id, date]
      );
      const recordId = recordResult.rows[0].id;
      const foodId = randomUUID();
      const inserted = await client.query<{
        id: string;
        description: string;
        input_mode: "text" | "text_image" | "image";
        calories_kcal: string;
        protein_g: string;
        llm_comment: string;
        llm_source: string;
        created_at: string;
        updated_at: string;
      }>(
        `
          INSERT INTO food_consumptions (
            id,
            record_id,
            description,
            input_mode,
            image_mime_type,
            calories_kcal,
            protein_g,
            llm_comment,
            llm_source
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING
            id,
            description,
            input_mode,
            calories_kcal::text,
            protein_g::text,
            llm_comment,
            llm_source,
            created_at::text,
            updated_at::text
        `,
        [
          foodId,
          recordId,
          analysis.description,
          inputMode,
          image?.mimeType ?? null,
          analysis.caloriesKcal,
          analysis.proteinG,
          analysis.comment,
          analysis.source
        ]
      );

      const totals = await client.query<{ total_calories_kcal: string; total_protein_g: string }>(
        `
          SELECT
            COALESCE(SUM(calories_kcal), 0)::text AS total_calories_kcal,
            COALESCE(SUM(protein_g), 0)::text AS total_protein_g
          FROM food_consumptions
          WHERE record_id = $1
        `,
        [recordId]
      );

      const row = inserted.rows[0];
      return {
        recordId,
        entry: {
          id: row.id,
          description: row.description,
          inputMode: row.input_mode,
          caloriesKcal: Number(row.calories_kcal),
          proteinG: Number(row.protein_g),
          comment: row.llm_comment,
          llmSource: row.llm_source,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        },
        totalCaloriesKcal: Number(totals.rows[0].total_calories_kcal),
        totalProteinG: Number(totals.rows[0].total_protein_g)
      };
    });

    if (key) {
      await saveIdempotentResponse(appUser.id, endpoint, key, 201, payload);
    }

    return res.status(201).json(payload);
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
});

foodRouter.delete("/food-consumptions/:foodConsumptionId", async (req, res) => {
  if (!req.auth) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const foodConsumptionId = req.params.foodConsumptionId;
  if (!idSchema.safeParse(foodConsumptionId).success) {
    return res.status(400).json({ error: "Invalid foodConsumptionId" });
  }

  try {
    const appUser = await upsertUserFromAuth(req.auth);
    const result = await pool.query<{ record_id: string }>(
      `
        DELETE FROM food_consumptions fc
        USING records r
        WHERE fc.id = $1
          AND r.id = fc.record_id
          AND r.user_id = $2
        RETURNING fc.record_id
      `,
      [foodConsumptionId, appUser.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Food consumption not found for user" });
    }

    const totals = await pool.query<{ total_calories_kcal: string; total_protein_g: string }>(
      `
        SELECT
          COALESCE(SUM(calories_kcal), 0)::text AS total_calories_kcal,
          COALESCE(SUM(protein_g), 0)::text AS total_protein_g
        FROM food_consumptions
        WHERE record_id = $1
      `,
      [result.rows[0].record_id]
    );

    return res.json({
      totalCaloriesKcal: Number(totals.rows[0].total_calories_kcal),
      totalProteinG: Number(totals.rows[0].total_protein_g)
    });
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
});

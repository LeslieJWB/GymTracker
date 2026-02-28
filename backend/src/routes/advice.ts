import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { gemini } from "../config.js";
import { requireAuth } from "../middleware/auth.js";
import { getPromptProfile, upsertUserFromAuth } from "../shared/authUsers.js";
import { buildStructuredPrompt } from "../shared/llmPrompt.js";
import { datePattern, idSchema } from "../shared/validation.js";

const EXERCISE_PLAN_SESSIONS_LIMIT = 10;
const DAILY_SUMMARY_PAST_EXERCISE_LIMIT = 3;
const DAILY_SUMMARY_PAST_DIET_LIMIT = 5;
const DAILY_SUMMARY_PAST_WEIGHT_LIMIT = 10;
const EXERCISE_FEEDBACK_HISTORY_LIMIT = 10;

export const adviceRouter = Router();

const exercisePlanSchema = z.object({
  exerciseItemId: idSchema,
  exerciseName: z.string().min(1).max(200),
  date: z.string().regex(datePattern)
});

const dailySummarySchema = z.object({
  date: z.string().regex(datePattern)
});

const exerciseFeedbackSchema = z.object({
  exerciseId: idSchema,
  exerciseItemId: idSchema,
  exerciseName: z.string().min(1).max(200),
  date: z.string().regex(datePattern)
});

adviceRouter.use(requireAuth);

type CompletedSetRow = {
  exercise_id: string;
  exercise_item_id: string;
  exercise_name: string;
  exercise_notes: string | null;
  reps: number;
  weight: string;
  set_order: number;
  set_notes: string | null;
};

function normalizeAdviceNote(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }
  return normalized.slice(0, 220);
}

function groupedExerciseSetLines(rows: CompletedSetRow[]): string[] {
  const linesByExercise = new Map<string, string[]>();
  for (const row of rows) {
    if (!linesByExercise.has(row.exercise_id)) {
      linesByExercise.set(row.exercise_id, []);
    }
    const notesSuffix = row.set_notes ? ` (set note: ${normalizeAdviceNote(row.set_notes)})` : "";
    linesByExercise
      .get(row.exercise_id)!
      .push(`set ${row.set_order + 1}: ${row.reps} reps @ ${row.weight} kg${notesSuffix}`);
  }

  const lines: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.exercise_id)) {
      continue;
    }
    seen.add(row.exercise_id);
    const exerciseNotes = normalizeAdviceNote(row.exercise_notes) ?? "none";
    const setLines = linesByExercise.get(row.exercise_id)?.join(", ") ?? "no completed sets";
    lines.push(`${row.exercise_name} | exercise note: ${exerciseNotes} | ${setLines}`);
  }
  return lines;
}

function formatNowContext(): string {
  const now = new Date();
  const hour = now.getHours();
  const partOfDay =
    hour < 5
      ? "late night"
      : hour < 12
        ? "morning"
        : hour < 17
          ? "afternoon"
          : hour < 21
            ? "evening"
            : "night";
  return `${now.toISOString()} (${partOfDay})`;
}

function themeContextBlock(theme: string | null): string {
  if (!theme) {
    return "Today's theme: not set";
  }
  return `Today's theme: ${theme}`;
}

async function getTodayTheme(userId: string, date: string): Promise<string | null> {
  const result = await pool.query<{ theme: string | null }>(
    `
      SELECT theme
      FROM records
      WHERE user_id = $1
        AND record_date = $2::date
      LIMIT 1
    `,
    [userId, date]
  );
  const theme = result.rows[0]?.theme?.trim();
  return theme && theme.length > 0 ? theme.slice(0, 80) : null;
}

function parseReview(raw: string): string | null {
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
  if (!cleaned) {
    return null;
  }
  try {
    const parsed = JSON.parse(cleaned) as { review?: unknown };
    if (typeof parsed.review === "string" && parsed.review.trim().length > 0) {
      return parsed.review.trim().slice(0, 4000);
    }
  } catch {
    // Best effort fallback to plain text.
  }
  return cleaned.slice(0, 4000);
}

adviceRouter.post("/advice/exercise-plan", async (req, res) => {
  if (!req.auth) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const parsed = exercisePlanSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { exerciseItemId, exerciseName, date } = parsed.data;

  const fallback = (advice: string) =>
    res.json({ source: "fallback" as const, sets: [] as { reps: number; weight: number }[], advice });

  try {
    const appUser = await upsertUserFromAuth(req.auth);
    const promptProfile = await getPromptProfile(appUser.id, date);
    const todayTheme = await getTodayTheme(appUser.id, date);
    const themeContext = themeContextBlock(todayTheme);
    const rows = await pool.query<{
      record_date: string;
      reps: number;
      weight: string;
      set_order: number;
      exercise_notes: string | null;
      set_notes: string | null;
    }>(
      `
      SELECT r.record_date::text, es.reps, es.weight::text, es.set_order, e.notes AS exercise_notes, es.notes AS set_notes
      FROM records r
      JOIN exercises e ON e.record_id = r.id AND e.exercise_item_id = $2
      JOIN exercise_sets es ON es.exercise_id = e.id
      WHERE r.user_id = $1
        AND r.record_date < $3::date
        AND es.is_completed = TRUE
      ORDER BY r.record_date DESC, es.set_order ASC
      `,
      [appUser.id, exerciseItemId, date]
    );

    const normalizeNote = (value: string | null): string | null => {
      if (!value) {
        return null;
      }
      const normalized = value.replace(/\s+/g, " ").trim();
      if (!normalized) {
        return null;
      }
      return normalized.slice(0, 220);
    };

    const byDate = new Map<string, { exerciseNotes: string | null; sets: { reps: number; weight: string; notes: string | null }[] }>();
    for (const row of rows.rows) {
      if (!byDate.has(row.record_date)) {
        if (byDate.size >= EXERCISE_PLAN_SESSIONS_LIMIT) continue;
        byDate.set(row.record_date, { exerciseNotes: normalizeNote(row.exercise_notes), sets: [] });
      }
      const session = byDate.get(row.record_date)!;
      if (!session.exerciseNotes) {
        session.exerciseNotes = normalizeNote(row.exercise_notes);
      }
      session.sets.push({ reps: row.reps, weight: row.weight, notes: normalizeNote(row.set_notes) });
    }

    const historyLines: string[] = [];
    for (const [d, session] of byDate) {
      const setParts = session.sets
        .map((s, index) => {
          const notesSuffix = s.notes ? ` (set note: ${s.notes})` : "";
          return `set ${index + 1}: ${s.reps} reps @ ${s.weight} kg${notesSuffix}`;
        })
        .join(", ");
      const exerciseNotesPart = session.exerciseNotes ? `exercise note: ${session.exerciseNotes}` : "exercise note: none";
      historyLines.push(`${d} | ${exerciseNotesPart} | ${setParts}`);
    }
    const historyText = historyLines.length > 0 ? historyLines.join("\n") : "No prior logs for this exercise.";

    if (!gemini) {
      return fallback(
        "AI advice is not configured. Add GEMINI_API_KEY to your environment. Based on your history, aim for progressive overload with good form."
      );
    }

    const prompt = buildStructuredPrompt({
      profile: promptProfile,
      customPrompt: promptProfile.globalLlmPrompt,
      requestContext: `You are a strength training coach. Generate a concrete workout plan for today.
Exercise: ${exerciseName}
Today's date: ${date}
${themeContext}
Priority rule: Treat today's theme as the user's intent for this day and align set recommendations and advice with it.
The user's past sessions for this exercise (date | exercise-level note | per-set logs with set-level notes):
${historyText}

Respond with ONLY a single JSON object, no other text. Use this exact shape:
{"sets":[{"reps":<number>,"weight":<number>},{"reps":<number>,"weight":<number>},...],"advice":"<short paragraph of advice>"}
- "sets": array of suggested sets for today (reps: positive integer, weight: number, e.g. 60 or 60.5). Recommend 3-5 sets typically.
- "advice": one short paragraph of coaching advice.
Keep recommendations safe and based on the user's history. Weight in kg.`
    });

    const response = await gemini.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt
    });

    const raw = (response as { text?: string }).text?.trim();
    if (!raw) {
      return fallback("Could not generate a plan. Try again or add more history for this exercise.");
    }

    let data: { sets: { reps: number; weight: number }[]; advice: string };
    try {
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
      data = JSON.parse(cleaned);
    } catch {
      return fallback("Could not parse AI response. Try again.");
    }

    if (!Array.isArray(data.sets) || typeof data.advice !== "string") {
      return fallback("Invalid AI response format. Try again.");
    }

    const sets = data.sets
      .filter((s: unknown) => s && typeof s === "object" && typeof (s as { reps?: unknown }).reps === "number" && typeof (s as { weight?: unknown }).weight === "number")
      .map((s: { reps: number; weight: number }) => ({
        reps: Math.max(1, Math.round((s as { reps: number }).reps)),
        weight: Math.max(0, Number(((s as { weight: number }).weight).toFixed(2)))
      }));

    return res.json({
      source: "gemini" as const,
      sets,
      advice: String(data.advice).slice(0, 2000)
    });
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
});

adviceRouter.post("/advice/daily-summary", async (req, res) => {
  if (!req.auth) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const parsed = dailySummarySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { date } = parsed.data;

  const fallback = (review: string) =>
    res.json({
      source: "fallback" as const,
      review
    });

  try {
    const appUser = await upsertUserFromAuth(req.auth);
    const promptProfile = await getPromptProfile(appUser.id, date);
    const todayTheme = await getTodayTheme(appUser.id, date);
    const themeContext = themeContextBlock(todayTheme);

    const todayCompletedResult = await pool.query<CompletedSetRow>(
      `
        SELECT
          e.id AS exercise_id,
          e.exercise_item_id,
          ei.name AS exercise_name,
          e.notes AS exercise_notes,
          es.reps,
          es.weight::text,
          es.set_order,
          es.notes AS set_notes
        FROM records r
        JOIN exercises e ON e.record_id = r.id
        JOIN exercise_items ei ON ei.id = e.exercise_item_id
        JOIN exercise_sets es ON es.exercise_id = e.id
        WHERE r.user_id = $1
          AND r.record_date = $2::date
          AND es.is_completed = TRUE
        ORDER BY e.sort_order ASC, es.set_order ASC
      `,
      [appUser.id, date]
    );

    const todayExerciseLines = groupedExerciseSetLines(todayCompletedResult.rows);
    const exerciseItemIds = Array.from(new Set(todayCompletedResult.rows.map((row) => row.exercise_item_id)));

    const pastExerciseByItem = new Map<string, string[]>();
    if (exerciseItemIds.length > 0) {
      const pastExerciseRows = await pool.query<{
        exercise_item_id: string;
        exercise_name: string;
        record_date: string;
        exercise_notes: string | null;
        reps: number;
        weight: string;
        set_order: number;
        set_notes: string | null;
      }>(
        `
          SELECT
            e.exercise_item_id,
            ei.name AS exercise_name,
            r.record_date::text,
            e.notes AS exercise_notes,
            es.reps,
            es.weight::text,
            es.set_order,
            es.notes AS set_notes
          FROM records r
          JOIN exercises e ON e.record_id = r.id
          JOIN exercise_items ei ON ei.id = e.exercise_item_id
          JOIN exercise_sets es ON es.exercise_id = e.id
          WHERE r.user_id = $1
            AND e.exercise_item_id = ANY($2::uuid[])
            AND r.record_date < $3::date
            AND es.is_completed = TRUE
          ORDER BY e.exercise_item_id, r.record_date DESC, es.set_order ASC
        `,
        [appUser.id, exerciseItemIds, date]
      );

      const byItem = new Map<
        string,
        Map<string, { exerciseName: string; exerciseNotes: string | null; sets: string[] }>
      >();
      for (const row of pastExerciseRows.rows) {
        if (!byItem.has(row.exercise_item_id)) {
          byItem.set(row.exercise_item_id, new Map());
        }
        const perDate = byItem.get(row.exercise_item_id)!;
        if (!perDate.has(row.record_date)) {
          if (perDate.size >= DAILY_SUMMARY_PAST_EXERCISE_LIMIT) {
            continue;
          }
          perDate.set(row.record_date, {
            exerciseName: row.exercise_name,
            exerciseNotes: normalizeAdviceNote(row.exercise_notes),
            sets: []
          });
        }
        const session = perDate.get(row.record_date)!;
        const notesSuffix = row.set_notes ? ` (set note: ${normalizeAdviceNote(row.set_notes)})` : "";
        session.sets.push(`set ${row.set_order + 1}: ${row.reps} reps @ ${row.weight} kg${notesSuffix}`);
      }

      for (const [exerciseItemId, perDate] of byItem) {
        const lines: string[] = [];
        for (const [recordDate, session] of perDate) {
          lines.push(
            `${recordDate} | exercise note: ${session.exerciseNotes ?? "none"} | ${session.sets.join(", ")}`
          );
        }
        pastExerciseByItem.set(exerciseItemId, lines);
      }
    }

    const todayFoodEntriesResult = await pool.query<{
      description: string;
      calories_kcal: string;
      protein_g: string;
      llm_comment: string;
      created_at: string;
    }>(
      `
        SELECT
          fc.description,
          fc.calories_kcal::text,
          fc.protein_g::text,
          fc.llm_comment,
          fc.created_at::text
        FROM records r
        JOIN food_consumptions fc ON fc.record_id = r.id
        WHERE r.user_id = $1
          AND r.record_date = $2::date
        ORDER BY fc.created_at ASC
      `,
      [appUser.id, date]
    );

    const todayFoodTotalsResult = await pool.query<{
      total_calories_kcal: string;
      total_protein_g: string;
    }>(
      `
        SELECT
          COALESCE(SUM(fc.calories_kcal), 0)::text AS total_calories_kcal,
          COALESCE(SUM(fc.protein_g), 0)::text AS total_protein_g
        FROM records r
        JOIN food_consumptions fc ON fc.record_id = r.id
        WHERE r.user_id = $1
          AND r.record_date = $2::date
      `,
      [appUser.id, date]
    );

    const pastNutritionResult = await pool.query<{
      record_date: string;
      total_calories_kcal: string;
      total_protein_g: string;
    }>(
      `
        SELECT
          r.record_date::text,
          COALESCE(SUM(fc.calories_kcal), 0)::text AS total_calories_kcal,
          COALESCE(SUM(fc.protein_g), 0)::text AS total_protein_g
        FROM records r
        JOIN food_consumptions fc ON fc.record_id = r.id
        WHERE r.user_id = $1
          AND r.record_date < $2::date
        GROUP BY r.record_date
        ORDER BY r.record_date DESC
        LIMIT $3
      `,
      [appUser.id, date, DAILY_SUMMARY_PAST_DIET_LIMIT]
    );

    const todayWeightResult = await pool.query<{ weight_kg: string }>(
      `
        SELECT weight_kg::text
        FROM body_weight_records
        WHERE user_id = $1
          AND record_date = $2::date
        LIMIT 1
      `,
      [appUser.id, date]
    );

    const pastWeightResult = await pool.query<{
      record_date: string;
      weight_kg: string;
    }>(
      `
        SELECT record_date::text, weight_kg::text
        FROM body_weight_records
        WHERE user_id = $1
          AND record_date < $2::date
        ORDER BY record_date DESC
        LIMIT $3
      `,
      [appUser.id, date, DAILY_SUMMARY_PAST_WEIGHT_LIMIT]
    );

    const todayExerciseText =
      todayExerciseLines.length > 0
        ? todayExerciseLines.join("\n")
        : "No completed exercises logged yet for today.";

    const pastExerciseText =
      exerciseItemIds.length > 0
        ? exerciseItemIds
            .map((exerciseItemId) => {
              const lines = pastExerciseByItem.get(exerciseItemId);
              const exerciseName =
                todayCompletedResult.rows.find((row) => row.exercise_item_id === exerciseItemId)?.exercise_name ??
                "Exercise";
              return `${exerciseName}:\n${lines && lines.length > 0 ? lines.join("\n") : "No prior completed records."}`;
            })
            .join("\n\n")
        : "No exercise history context (no completed exercise for today).";

    const todayFoodRows = todayFoodEntriesResult.rows;
    const todayFoodDetailsText =
      todayFoodRows.length > 0
        ? todayFoodRows
            .map(
              (row) =>
                `${row.created_at} | ${row.description} | ${Number(row.calories_kcal)} kcal | ${Number(
                  row.protein_g
                )} g protein | note: ${row.llm_comment}`
            )
            .join("\n")
        : "No food entries logged yet for today.";
    const todayFoodTotals = todayFoodTotalsResult.rows[0] ?? {
      total_calories_kcal: "0",
      total_protein_g: "0"
    };
    const pastNutritionText =
      pastNutritionResult.rows.length > 0
        ? pastNutritionResult.rows
            .map(
              (row) =>
                `${row.record_date} | ${Number(row.total_calories_kcal)} kcal | ${Number(row.total_protein_g)} g protein`
            )
            .join("\n")
        : "No prior nutrition records.";

    const todayWeightText = todayWeightResult.rowCount
      ? `${date} | ${Number(todayWeightResult.rows[0].weight_kg)} kg`
      : `${date} | not recorded`;
    const pastWeightText =
      pastWeightResult.rows.length > 0
        ? pastWeightResult.rows
            .map((row) => `${row.record_date} | ${Number(row.weight_kg)} kg`)
            .join("\n")
        : "No prior body weight records.";

    if (!gemini) {
      return fallback(
        "AI review is not configured right now. Keep tracking your completed sets, food, and body weight so the next review can compare trends."
      );
    }

    const prompt = buildStructuredPrompt({
      profile: promptProfile,
      customPrompt: promptProfile.globalLlmPrompt,
      requestContext: `You are a fitness coach and nutrition reviewer. Provide a concise review for today's performance with emphasis on incremental progress.
Today date: ${date}
${themeContext}
Current request timestamp and daypart: ${formatNowContext()}
Important: Today's logs may be incomplete at this time, so mention missing/partial logging when relevant.
Priority rule: Treat today's theme as authoritative day intent and calibrate the review tone and recommendations accordingly.

Today's completed exercises details:
${todayExerciseText}

Past 3 completed records for each exercise from today (with dates):
${pastExerciseText}

Today's diet detail:
${todayFoodDetailsText}
Today's diet totals: ${Number(todayFoodTotals.total_calories_kcal)} kcal, ${Number(todayFoodTotals.total_protein_g)} g protein

Past ${DAILY_SUMMARY_PAST_DIET_LIMIT} daily calorie/protein records (with dates):
${pastNutritionText}

Today's body weight:
${todayWeightText}

Past ${DAILY_SUMMARY_PAST_WEIGHT_LIMIT} recorded body weights (with dates):
${pastWeightText}

Respond with ONLY a single JSON object:
{"review":"<short, concrete review with strengths, gaps, and next actions>"}`
    });

    const response = await gemini.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt
    });
    const raw = (response as { text?: string }).text?.trim();
    if (!raw) {
      return fallback("Could not generate AI summary. Try again after logging more completed sets or food.");
    }

    const review = parseReview(raw);
    if (!review) {
      return fallback("Could not parse AI summary. Try again.");
    }

    return res.json({
      source: "gemini" as const,
      review
    });
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
});

adviceRouter.post("/advice/exercise-feedback", async (req, res) => {
  if (!req.auth) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const parsed = exerciseFeedbackSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { exerciseId, exerciseItemId, exerciseName, date } = parsed.data;

  const fallback = (review: string) =>
    res.json({
      source: "fallback" as const,
      review
    });

  try {
    const appUser = await upsertUserFromAuth(req.auth);
    const promptProfile = await getPromptProfile(appUser.id, date);
    const todayTheme = await getTodayTheme(appUser.id, date);
    const themeContext = themeContextBlock(todayTheme);

    const todaySetRows = await pool.query<{
      exercise_notes: string | null;
      reps: number;
      weight: string;
      set_order: number;
      set_notes: string | null;
    }>(
      `
        SELECT
          e.notes AS exercise_notes,
          es.reps,
          es.weight::text,
          es.set_order,
          es.notes AS set_notes
        FROM exercises e
        JOIN records r ON r.id = e.record_id
        JOIN exercise_sets es ON es.exercise_id = e.id
        WHERE e.id = $1
          AND e.exercise_item_id = $2
          AND r.user_id = $3
          AND r.record_date = $4::date
          AND es.is_completed = TRUE
        ORDER BY es.set_order ASC
      `,
      [exerciseId, exerciseItemId, appUser.id, date]
    );

    const pastRows = await pool.query<{
      record_date: string;
      exercise_notes: string | null;
      reps: number;
      weight: string;
      set_order: number;
      set_notes: string | null;
    }>(
      `
        SELECT
          r.record_date::text,
          e.notes AS exercise_notes,
          es.reps,
          es.weight::text,
          es.set_order,
          es.notes AS set_notes
        FROM records r
        JOIN exercises e ON e.record_id = r.id
        JOIN exercise_sets es ON es.exercise_id = e.id
        WHERE r.user_id = $1
          AND e.exercise_item_id = $2
          AND r.record_date < $3::date
          AND es.is_completed = TRUE
        ORDER BY r.record_date DESC, es.set_order ASC
      `,
      [appUser.id, exerciseItemId, date]
    );

    const todaySetsText =
      todaySetRows.rows.length > 0
        ? todaySetRows.rows
            .map((row) => {
              const notesSuffix = row.set_notes ? ` (set note: ${normalizeAdviceNote(row.set_notes)})` : "";
              return `set ${row.set_order + 1}: ${row.reps} reps @ ${row.weight} kg${notesSuffix}`;
            })
            .join(", ")
        : "No completed sets logged for this exercise today.";
    const todayExerciseNotes = normalizeAdviceNote(todaySetRows.rows[0]?.exercise_notes ?? null) ?? "none";

    const pastByDate = new Map<string, { exerciseNotes: string | null; sets: string[] }>();
    for (const row of pastRows.rows) {
      if (!pastByDate.has(row.record_date)) {
        if (pastByDate.size >= EXERCISE_FEEDBACK_HISTORY_LIMIT) {
          continue;
        }
        pastByDate.set(row.record_date, {
          exerciseNotes: normalizeAdviceNote(row.exercise_notes),
          sets: []
        });
      }
      const notesSuffix = row.set_notes ? ` (set note: ${normalizeAdviceNote(row.set_notes)})` : "";
      pastByDate
        .get(row.record_date)!
        .sets.push(`set ${row.set_order + 1}: ${row.reps} reps @ ${row.weight} kg${notesSuffix}`);
    }

    const pastText =
      pastByDate.size > 0
        ? Array.from(pastByDate.entries())
            .map(
              ([recordDate, session]) =>
                `${recordDate} | exercise note: ${session.exerciseNotes ?? "none"} | ${session.sets.join(", ")}`
            )
            .join("\n")
        : "No prior completed records for this exercise.";

    if (!gemini) {
      return fallback(
        "AI feedback is not configured right now. Keep progressing set quality and load over time, and log notes to improve review quality."
      );
    }

    const prompt = buildStructuredPrompt({
      profile: promptProfile,
      customPrompt: promptProfile.globalLlmPrompt,
      requestContext: `You are a strength coach reviewing today's completed session for one exercise.
Exercise: ${exerciseName}
Today date: ${date}
${themeContext}
Current request timestamp and daypart: ${formatNowContext()}
Important: The user may still be mid-workout, so mention if data appears incomplete.
Priority rule: Treat today's theme as authoritative day intent and align feedback direction with it.

Today's completed sets:
${todaySetsText}
Today's exercise note: ${todayExerciseNotes}

Past ${EXERCISE_FEEDBACK_HISTORY_LIMIT} completed records for this exercise (with dates):
${pastText}

Respond with ONLY JSON:
{"review":"<concise feedback on incremental progress, form/load management, and next-step suggestion>"}`
    });

    const response = await gemini.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt
    });
    const raw = (response as { text?: string }).text?.trim();
    if (!raw) {
      return fallback("Could not generate exercise feedback. Try again after completing more sets.");
    }
    const review = parseReview(raw);
    if (!review) {
      return fallback("Could not parse exercise feedback. Try again.");
    }

    return res.json({
      source: "gemini" as const,
      review
    });
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
});

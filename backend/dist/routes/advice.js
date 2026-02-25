import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { gemini } from "../config.js";
import { requireAuth } from "../middleware/auth.js";
import { getPromptProfile, upsertUserFromAuth } from "../shared/authUsers.js";
import { buildStructuredPrompt } from "../shared/llmPrompt.js";
import { datePattern, idSchema } from "../shared/validation.js";
const EXERCISE_PLAN_SESSIONS_LIMIT = 10;
export const adviceRouter = Router();
const exercisePlanSchema = z.object({
    exerciseItemId: idSchema,
    exerciseName: z.string().min(1).max(200),
    date: z.string().regex(datePattern)
});
adviceRouter.use(requireAuth);
adviceRouter.post("/advice/exercise-plan", async (req, res) => {
    if (!req.auth) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const parsed = exercisePlanSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    const { exerciseItemId, exerciseName, date } = parsed.data;
    const fallback = (advice) => res.json({ source: "fallback", sets: [], advice });
    try {
        const appUser = await upsertUserFromAuth(req.auth);
        const promptProfile = await getPromptProfile(appUser.id);
        const rows = await pool.query(`
      SELECT r.record_date::text, es.reps, es.weight::text, es.set_order, e.notes AS exercise_notes, es.notes AS set_notes
      FROM records r
      JOIN exercises e ON e.record_id = r.id AND e.exercise_item_id = $2
      JOIN exercise_sets es ON es.exercise_id = e.id
      WHERE r.user_id = $1
        AND r.record_date < $3::date
        AND es.is_completed = TRUE
      ORDER BY r.record_date DESC, es.set_order ASC
      `, [appUser.id, exerciseItemId, date]);
        const normalizeNote = (value) => {
            if (!value) {
                return null;
            }
            const normalized = value.replace(/\s+/g, " ").trim();
            if (!normalized) {
                return null;
            }
            return normalized.slice(0, 220);
        };
        const byDate = new Map();
        for (const row of rows.rows) {
            if (!byDate.has(row.record_date)) {
                if (byDate.size >= EXERCISE_PLAN_SESSIONS_LIMIT)
                    continue;
                byDate.set(row.record_date, { exerciseNotes: normalizeNote(row.exercise_notes), sets: [] });
            }
            const session = byDate.get(row.record_date);
            if (!session.exerciseNotes) {
                session.exerciseNotes = normalizeNote(row.exercise_notes);
            }
            session.sets.push({ reps: row.reps, weight: row.weight, notes: normalizeNote(row.set_notes) });
        }
        const historyLines = [];
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
            return fallback("AI advice is not configured. Add GEMINI_API_KEY to your environment. Based on your history, aim for progressive overload with good form.");
        }
        const prompt = buildStructuredPrompt({
            profile: promptProfile,
            customPrompt: promptProfile.globalLlmPrompt,
            requestContext: `You are a strength training coach. Generate a concrete workout plan for today.
Exercise: ${exerciseName}
Today's date: ${date}
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
        const raw = response.text?.trim();
        if (!raw) {
            return fallback("Could not generate a plan. Try again or add more history for this exercise.");
        }
        let data;
        try {
            const cleaned = raw.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
            data = JSON.parse(cleaned);
        }
        catch {
            return fallback("Could not parse AI response. Try again.");
        }
        if (!Array.isArray(data.sets) || typeof data.advice !== "string") {
            return fallback("Invalid AI response format. Try again.");
        }
        const sets = data.sets
            .filter((s) => s && typeof s === "object" && typeof s.reps === "number" && typeof s.weight === "number")
            .map((s) => ({
            reps: Math.max(1, Math.round(s.reps)),
            weight: Math.max(0, Number((s.weight).toFixed(2)))
        }));
        return res.json({
            source: "gemini",
            sets,
            advice: String(data.advice).slice(0, 2000)
        });
    }
    catch (error) {
        return res.status(500).json({ error: String(error) });
    }
});

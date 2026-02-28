import { z } from "zod";
export const datePattern = /^\d{4}-\d{2}-\d{2}$/;
export const uuidLikePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Accept canonical 8-4-4-4-12 hex UUID text shape (matches Postgres UUID parsing).
export const idSchema = z.string().regex(uuidLikePattern, "Invalid UUID");
export const dateRangeSchema = z.object({
    userId: idSchema,
    from: z.string().regex(datePattern).optional(),
    to: z.string().regex(datePattern).optional()
});
export const byDateSchema = z.object({
    userId: idSchema,
    date: z.string().regex(datePattern)
});
export const byDateNoUserSchema = z.object({
    date: z.string().regex(datePattern)
});
export const bodyWeightByDateSchema = byDateNoUserSchema.extend({
    weightKg: z.number().min(20).max(400)
});
export const dateRangeNoUserSchema = z.object({
    from: z.string().regex(datePattern).optional(),
    to: z.string().regex(datePattern).optional()
});
export const exerciseHistorySchema = dateRangeNoUserSchema.extend({
    exerciseItemId: idSchema
});
const recordThemeSchema = z
    .string()
    .trim()
    .max(30)
    .regex(/^[A-Za-z0-9 _-]+$/, "Theme can only include letters, numbers, spaces, - and _");
export const patchRecordThemeByDateSchema = byDateSchema.extend({
    theme: recordThemeSchema.nullable()
});
export const createExerciseSchema = z.object({
    userId: idSchema,
    exerciseItemId: idSchema,
    notes: z.string().max(1000).optional(),
    sortOrder: z.number().int().min(0).optional(),
    initialSets: z
        .array(z.object({
        reps: z.number().int().positive(),
        weight: z.number().nonnegative(),
        setOrder: z.number().int().min(0).optional(),
        notes: z.string().max(1000).optional(),
        isCompleted: z.boolean().optional()
    }))
        .optional()
});
export const createExerciseByDateSchema = createExerciseSchema.extend({
    date: z.string().regex(datePattern)
});
export const patchExerciseSchema = z.object({
    notes: z.string().max(1000).nullable().optional(),
    sortOrder: z.number().int().min(0).optional()
});
export const createSetSchema = z.object({
    userId: idSchema,
    reps: z.number().int().positive(),
    weight: z.number().nonnegative(),
    setOrder: z.number().int().min(0).optional(),
    notes: z.string().max(1000).optional(),
    isCompleted: z.boolean().optional()
});
export const patchSetSchema = z.object({
    reps: z.number().int().positive().optional(),
    weight: z.number().nonnegative().optional(),
    setOrder: z.number().int().min(0).optional(),
    notes: z.string().max(1000).nullable().optional(),
    isCompleted: z.boolean().optional()
});
const base64Pattern = /^[A-Za-z0-9+/=]+$/;
const imageMimeTypePattern = /^image\/[A-Za-z0-9.+-]+$/;
export const createFoodConsumptionByDateSchema = byDateSchema
    .extend({
    text: z.string().trim().min(1).max(2000).optional(),
    image: z
        .object({
        mimeType: z.string().regex(imageMimeTypePattern, "Invalid image mime type"),
        dataBase64: z
            .string()
            .min(16)
            .max(4_000_000)
            .regex(base64Pattern, "Image must be base64-encoded")
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
export const deleteFoodConsumptionSchema = z.object({
    userId: idSchema
});

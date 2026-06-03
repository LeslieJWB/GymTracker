import dotenv from "dotenv";
import { createLlmProvider } from "./shared/llmProvider.js";
dotenv.config();
export const nodeEnv = process.env.NODE_ENV ?? "development";
export const port = Number(process.env.PORT || 4000);
export const supabaseUrl = process.env.SUPABASE_URL ?? "";
export const supabaseJwtAudience = process.env.SUPABASE_JWT_AUDIENCE ?? "authenticated";
export const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
export const trustProxy = process.env.TRUST_PROXY === "true";
export const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
export const freeLlmCallsPerDay = Math.max(0, Number(process.env.FREE_LLM_CALLS_PER_DAY || 5));
export const subscriberLlmCallsPerDay = Math.max(0, Number(process.env.SUBSCRIBER_LLM_CALLS_PER_DAY || 30));
export const unlimitedLlmSupabaseUserIds = new Set((process.env.LLM_UNLIMITED_SUPABASE_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean));
export const revenueCatWebhookAuthToken = process.env.REVENUECAT_WEBHOOK_AUTH_TOKEN ?? "";
export const revenueCatSecretApiKey = process.env.REVENUECAT_SECRET_API_KEY ?? "";
export const revenueCatEntitlementId = process.env.REVENUECAT_ENTITLEMENT_ID ?? "pro";
const selectedProviderRaw = (process.env.LLM_PROVIDER ?? "kimi").trim().toLowerCase();
export const llmProviderName = selectedProviderRaw === "gemini"
    ? "gemini"
    : selectedProviderRaw === "vertex" || selectedProviderRaw === "vertext"
        ? "vertex"
        : "kimi";
export const kimiModel = process.env.KIMI_MODEL ?? "kimi-k2.5";
export const kimiBaseUrl = process.env.KIMI_BASE_URL ?? "https://api.moonshot.ai/v1";
export const geminiModel = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
export const geminiBaseUrl = process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta/openai";
export const vertexModel = process.env.VERTEX_MODEL ?? "gemini-2.5-flash-lite";
export const vertexBaseUrl = process.env.VERTEX_BASE_URL ?? "https://aiplatform.googleapis.com/v1/publishers/google/models";
function parseVertexThinkingBudget(rawLevel) {
    const normalized = (rawLevel ?? "low").trim().toLowerCase();
    if (!normalized) {
        return 256;
    }
    if (/^\d+$/.test(normalized)) {
        return Math.max(0, Number.parseInt(normalized, 10));
    }
    if (normalized === "off" || normalized === "none" || normalized === "disabled") {
        return 0;
    }
    if (normalized === "low") {
        return 256;
    }
    if (normalized === "medium") {
        return 1024;
    }
    if (normalized === "high") {
        return 2048;
    }
    return 256;
}
export const vertexThinkingBudget = parseVertexThinkingBudget(process.env.VERTEX_THINKING_LEVEL);
export const llmProvider = createLlmProvider({
    selectedProvider: llmProviderName,
    kimi: {
        apiKey: process.env.KIMI_API_KEY,
        baseUrl: kimiBaseUrl,
        model: kimiModel
    },
    gemini: {
        apiKey: process.env.GEMINI_API_KEY,
        baseUrl: geminiBaseUrl,
        model: geminiModel
    },
    vertex: {
        apiKey: process.env.VERTEX_API_KEY,
        baseUrl: vertexBaseUrl,
        model: vertexModel,
        thinkingBudget: vertexThinkingBudget
    }
});
export const llmConfigHint = llmProviderName === "gemini"
    ? "Set GEMINI_API_KEY in your environment."
    : llmProviderName === "vertex"
        ? "Set VERTEX_API_KEY in your environment."
        : "Set KIMI_API_KEY in your environment.";
export async function generateLlmText(params) {
    if (!llmProvider) {
        return null;
    }
    return llmProvider.generateText(params);
}

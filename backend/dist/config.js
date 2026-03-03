import dotenv from "dotenv";
import { createLlmProvider } from "./shared/llmProvider.js";
dotenv.config();
export const nodeEnv = process.env.NODE_ENV ?? "development";
export const port = Number(process.env.PORT || 4000);
export const supabaseUrl = process.env.SUPABASE_URL ?? "";
export const supabaseJwtAudience = process.env.SUPABASE_JWT_AUDIENCE ?? "authenticated";
export const trustProxy = process.env.TRUST_PROXY === "true";
export const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
const selectedProviderRaw = (process.env.LLM_PROVIDER ?? "kimi").trim().toLowerCase();
export const llmProviderName = selectedProviderRaw === "gemini" ? "gemini" : "kimi";
export const kimiModel = process.env.KIMI_MODEL ?? "kimi-k2.5";
export const kimiBaseUrl = process.env.KIMI_BASE_URL ?? "https://api.moonshot.ai/v1";
export const geminiModel = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
export const geminiBaseUrl = process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta/openai";
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
    }
});
export const llmConfigHint = llmProviderName === "gemini"
    ? "Set GEMINI_API_KEY in your environment."
    : "Set KIMI_API_KEY in your environment.";
export async function generateLlmText(params) {
    if (!llmProvider) {
        return null;
    }
    return llmProvider.generateText(params);
}

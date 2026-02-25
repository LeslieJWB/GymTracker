import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
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
export const gemini = process.env.GEMINI_API_KEY ?
    new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    : null;

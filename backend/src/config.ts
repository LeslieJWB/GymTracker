import dotenv from "dotenv";
import OpenAI from "openai";
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

export const kimiModel = process.env.KIMI_MODEL ?? "kimi-k2.5";
export const kimiBaseUrl = process.env.KIMI_BASE_URL ?? "https://api.moonshot.ai/v1";

export const kimi =
  process.env.KIMI_API_KEY ?
    new OpenAI({
      apiKey: process.env.KIMI_API_KEY,
      baseURL: kimiBaseUrl
    })
  : null;

type KimiImageInput = {
  mimeType: string;
  dataBase64: string;
};

export async function generateKimiText(params: {
  prompt: string;
  userText?: string | null;
  image?: KimiImageInput;
}): Promise<string | null> {
  if (!kimi) {
    return null;
  }

  const textParts = [params.prompt.trim()];
  if (params.userText !== undefined) {
    textParts.push(`User text: ${params.userText ?? "(none provided)"}`);
  }
  const textBlock = textParts.join("\n\n");

  const content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [{ type: "text", text: textBlock }];

  if (params.image) {
    content.push({
      type: "image_url",
      image_url: {
        url: `data:${params.image.mimeType};base64,${params.image.dataBase64}`
      }
    });
  }

  const response = await kimi.chat.completions.create({
    model: kimiModel,
    messages: [{ role: "user", content }]
  });

  const raw = response.choices[0]?.message?.content;
  return typeof raw === "string" ? raw.trim() : null;
}

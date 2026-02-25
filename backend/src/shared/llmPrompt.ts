import type { PromptProfile } from "./authUsers.js";

type StructuredPromptInput = {
  profile: PromptProfile;
  customPrompt: string | null;
  requestContext: string;
};

function profileValue(value: string | number | null): string {
  if (value === null || value === undefined || value === "") {
    return "unknown";
  }
  return String(value);
}

export function buildStructuredPrompt({ profile, customPrompt, requestContext }: StructuredPromptInput): string {
  return [
    "PART_1_SYSTEM_PROMPT_USER_PROFILE",
    `- age: ${profileValue(profile.age)}`,
    `- default_body_weight_kg: ${profileValue(profile.defaultBodyWeightKg)}`,
    `- height_cm: ${profileValue(profile.heightCm)}`,
    `- gender: ${profileValue(profile.gender)}`,
    "",
    "PART_2_CUSTOM_USER_PROMPT",
    customPrompt && customPrompt.trim().length > 0 ? customPrompt.trim() : "(none provided)",
    "",
    "PART_3_SPECIFIC_REQUEST_CONTEXT",
    requestContext.trim()
  ].join("\n");
}


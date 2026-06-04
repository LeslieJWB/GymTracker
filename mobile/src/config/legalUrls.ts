const APPLE_STANDARD_EULA_URL = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";

function normalizePublicUrl(raw: string | undefined, fallback: string): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) {
    return fallback;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed.replace(/\/$/, "")}`;
}

function normalizeBackendBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, "");
  if (!trimmed) {
    return "http://localhost:4000";
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

const backendBaseUrl = normalizeBackendBaseUrl(process.env.EXPO_PUBLIC_BACKEND_URL ?? "http://localhost:4000");

export const PRIVACY_POLICY_URL = normalizePublicUrl(
  process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL,
  `${backendBaseUrl}/legal/privacy`
);

export const TERMS_OF_USE_URL = normalizePublicUrl(
  process.env.EXPO_PUBLIC_TERMS_OF_USE_URL,
  APPLE_STANDARD_EULA_URL
);

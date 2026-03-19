export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function sanitizeIntegerInput(value: string): string {
  return value.replace(/\D+/g, "");
}

export function sanitizeWeightInput(value: string): string {
  const normalized = value.replace(",", ".").replace(/[^0-9.]/g, "");
  const [whole, ...decimals] = normalized.split(".");
  if (decimals.length === 0) {
    return whole;
  }
  return `${whole}.${decimals.join("")}`;
}

export function sanitizeBodyFatInput(value: string): string {
  return sanitizeWeightInput(value);
}

export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

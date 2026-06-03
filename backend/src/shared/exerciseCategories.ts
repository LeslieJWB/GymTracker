export const CARDIO_CATEGORY = "cardio";

export const STRENGTH_CATEGORIES = [
  "strength",
  "powerlifting",
  "olympic weightlifting",
  "strongman",
  "plyometrics"
] as const;

export type StrengthCategory = (typeof STRENGTH_CATEGORIES)[number];

export function isStrengthCategory(category: string | null | undefined): boolean {
  if (!category) {
    return false;
  }
  return (STRENGTH_CATEGORIES as readonly string[]).includes(category);
}

export function isCardioCategory(category: string | null | undefined): boolean {
  return category === CARDIO_CATEGORY;
}

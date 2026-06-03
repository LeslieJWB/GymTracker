export const CARDIO_CATEGORY = "cardio";

export const STRENGTH_CATEGORIES = [
  "strength",
  "powerlifting",
  "olympic weightlifting",
  "strongman",
  "plyometrics"
] as const;

export type LoggingMode = "strength" | "cardio";

export function isStrengthCategory(category: string | null | undefined): boolean {
  if (!category) {
    return false;
  }
  return (STRENGTH_CATEGORIES as readonly string[]).includes(category);
}

export function isCardioCategory(category: string | null | undefined): boolean {
  return category === CARDIO_CATEGORY;
}

export function hasExerciseMetrics(category: string | null | undefined): boolean {
  return isStrengthCategory(category) || isCardioCategory(category);
}

export function categoryMatchesLoggingMode(
  category: string | null | undefined,
  loggingMode: LoggingMode
): boolean {
  if (loggingMode === "cardio") {
    return isCardioCategory(category);
  }
  return isStrengthCategory(category);
}

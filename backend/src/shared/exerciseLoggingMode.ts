import {
  CARDIO_CATEGORY,
  isCardioCategory,
  isStrengthCategory,
  STRENGTH_CATEGORIES
} from "./exerciseCategories.js";

export type LoggingMode = "strength" | "cardio";

export function categoryMatchesLoggingMode(
  category: string | null,
  loggingMode: LoggingMode
): boolean {
  if (loggingMode === "cardio") {
    return isCardioCategory(category);
  }
  return isStrengthCategory(category);
}

export function loggingModeErrorMessage(loggingMode: LoggingMode): string {
  if (loggingMode === "cardio") {
    return `Exercise must be in the ${CARDIO_CATEGORY} category`;
  }
  return `Exercise must be in a strength category (${STRENGTH_CATEGORIES.join(", ")})`;
}

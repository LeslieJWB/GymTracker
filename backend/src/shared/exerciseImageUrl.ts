const SOURCE_IMAGE_BASE_URL =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises";

export function toExerciseImageUrl(imagePath: string | null): string | null {
  if (!imagePath) {
    return null;
  }
  if (/^https?:\/\//i.test(imagePath)) {
    return imagePath;
  }
  const normalized = imagePath
    .trim()
    .replace(/^\/+/, "")
    .replace(/^exercises\//i, "");
  return normalized ? `${SOURCE_IMAGE_BASE_URL}/${normalized}` : null;
}

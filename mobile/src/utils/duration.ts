export function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export function formatDurationLabel(seconds: number): string {
  const safeSeconds = Math.max(0, Math.round(seconds));
  if (safeSeconds < 3600) {
    return `${Math.round(safeSeconds / 60)} min`;
  }
  const hours = Math.floor(safeSeconds / 3600);
  const mins = Math.round((safeSeconds % 3600) / 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function parseDurationInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.includes(":")) {
    const [minsPart, secsPart = "0"] = trimmed.split(":");
    const mins = Number(minsPart.replace(",", "."));
    const secs = Number(secsPart.replace(",", "."));
    if (!Number.isFinite(mins) || !Number.isFinite(secs) || mins < 0 || secs < 0 || secs >= 60) {
      return null;
    }
    const total = Math.round(mins * 60 + secs);
    return total > 0 ? total : null;
  }
  const mins = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(mins) || mins <= 0) {
    return null;
  }
  return Math.round(mins * 60);
}

export function sanitizeDurationInput(text: string): string {
  return text.replace(/[^\d:]/g, "").slice(0, 8);
}

export function sanitizeDistanceInput(text: string): string {
  const cleaned = text.replace(/[^\d.,]/g, "").replace(",", ".");
  const parts = cleaned.split(".");
  if (parts.length <= 1) {
    return parts[0] ?? "";
  }
  return `${parts[0]}.${parts.slice(1).join("").slice(0, 3)}`;
}

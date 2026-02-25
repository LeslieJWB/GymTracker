export function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

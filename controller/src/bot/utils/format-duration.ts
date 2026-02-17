import { normalizeDate } from "./normalize-date.js";

export function formatDuration(startDate: string, endDate: string): string {
  const start = new Date(normalizeDate(startDate));
  const end = new Date(normalizeDate(endDate));

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return "";
  }

  const durationMs = end.getTime() - start.getTime();

  if (durationMs < 0) return "";

  const seconds = Math.floor(durationMs / 1000);

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes < 60) {
    return remainingSeconds > 0
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes > 0
    ? `${hours}h ${remainingMinutes}m`
    : `${hours}h`;
}

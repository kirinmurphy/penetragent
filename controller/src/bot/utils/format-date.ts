import { normalizeDate } from "./normalize-date.js";

export function formatHumanDate(isoDateString: string): string {
  const dateStr = normalizeDate(isoDateString);

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return "";
  }

  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const dateYear = date.getUTCFullYear();

  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const month = monthNames[date.getUTCMonth()];
  const day = date.getUTCDate();
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const time = `${hours}:${minutes}`;

  if (dateYear === currentYear) {
    return `${month} ${day} ${time}`;
  } else {
    return `${month} ${day}, ${dateYear} ${time}`;
  }
}

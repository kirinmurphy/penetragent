export function normalizeDate(dateStr: string): string {
  if (dateStr.includes(" ") && !dateStr.includes("T")) {
    return dateStr.replace(" ", "T") + "Z";
  }

  if (dateStr.includes("T") && !dateStr.endsWith("Z") && !dateStr.includes("+") && !/[-]\d{2}:\d{2}$/.test(dateStr)) {
    return dateStr + "Z";
  }

  return dateStr;
}

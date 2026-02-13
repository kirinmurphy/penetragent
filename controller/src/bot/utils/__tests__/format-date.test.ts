import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatHumanDate } from "../format-date.js";

const cases: { name: string; input: string; expected: string }[] = [
  { name: "current year omits year", input: "2026-02-12T13:49:30Z", expected: "Feb 12 13:49" },
  { name: "different year includes year", input: "2025-12-31T23:59:00Z", expected: "Dec 31, 2025 23:59" },
  { name: "future year includes year", input: "2027-01-01T00:00:00Z", expected: "Jan 1, 2027 00:00" },
  { name: "leading zeros in time", input: "2026-03-05T08:05:00Z", expected: "Mar 5 08:05" },
  { name: "without Z suffix treats as UTC", input: "2026-02-12T13:49:30", expected: "Feb 12 13:49" },
  { name: "SQL datetime format", input: "2026-02-12 13:49:30", expected: "Feb 12 13:49" },
  { name: "New Year's Eve (current year)", input: "2026-12-31T23:59:00Z", expected: "Dec 31 23:59" },
  { name: "previous year New Year's Day", input: "2025-01-01T00:00:00Z", expected: "Jan 1, 2025 00:00" },
  { name: "Jan", input: "2026-01-15T12:00:00Z", expected: "Jan 15 12:00" },
  { name: "Feb", input: "2026-02-15T12:00:00Z", expected: "Feb 15 12:00" },
  { name: "Mar", input: "2026-03-15T12:00:00Z", expected: "Mar 15 12:00" },
  { name: "Apr", input: "2026-04-15T12:00:00Z", expected: "Apr 15 12:00" },
  { name: "May", input: "2026-05-15T12:00:00Z", expected: "May 15 12:00" },
  { name: "Jun", input: "2026-06-15T12:00:00Z", expected: "Jun 15 12:00" },
  { name: "Jul", input: "2026-07-15T12:00:00Z", expected: "Jul 15 12:00" },
  { name: "Aug", input: "2026-08-15T12:00:00Z", expected: "Aug 15 12:00" },
  { name: "Sep", input: "2026-09-15T12:00:00Z", expected: "Sep 15 12:00" },
  { name: "Oct", input: "2026-10-15T12:00:00Z", expected: "Oct 15 12:00" },
  { name: "Nov", input: "2026-11-15T12:00:00Z", expected: "Nov 15 12:00" },
  { name: "Dec", input: "2026-12-15T12:00:00Z", expected: "Dec 15 12:00" },
];

describe("formatHumanDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-12T15:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  for (const { name, input, expected } of cases) {
    it(name, () => {
      expect(formatHumanDate(input)).toBe(expected);
    });
  }
});

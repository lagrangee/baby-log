import { describe, expect, test } from "vitest";
import {
  localInputValueInTimezone,
  formatElapsedTime,
  formatRelativeTime,
  todayDateInputValueInTimezone,
  toIsoFromLocalInputInTimezone
} from "../../src/client/utils/time";

describe("client timezone-aware datetime helpers", () => {
  test("formats UTC instants as datetime-local values in app timezone", () => {
    expect(localInputValueInTimezone("2026-04-24T00:30:00Z", "Asia/Shanghai")).toBe("2026-04-24T08:30");
    expect(localInputValueInTimezone("2026-04-24T00:30:00Z", "America/Los_Angeles")).toBe("2026-04-23T17:30");
  });

  test("parses datetime-local values as app timezone, not browser timezone", () => {
    expect(toIsoFromLocalInputInTimezone("2026-04-24T08:30", "Asia/Shanghai")).toBe("2026-04-24T00:30:00Z");
    expect(toIsoFromLocalInputInTimezone("2026-04-23T17:30", "America/Los_Angeles")).toBe("2026-04-24T00:30:00Z");
  });

  test("returns a date input value for the app timezone", () => {
    expect(todayDateInputValueInTimezone("Asia/Shanghai")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("formats relative time for recency display", () => {
    const now = new Date("2026-04-26T04:00:00Z");
    expect(formatRelativeTime("2026-04-26T03:35:00Z", "Asia/Shanghai", now)).toBe("25 min ago");
    expect(formatRelativeTime("2026-04-26T02:00:00Z", "Asia/Shanghai", now)).toBe("2 hr ago");
    expect(formatRelativeTime("2026-04-25T12:00:00Z", "Asia/Shanghai", now)).toMatch(/^Yesterday/);
  });

  test("formats elapsed time without decimal hours", () => {
    expect(formatElapsedTime(42)).toBe("42 min");
    expect(formatElapsedTime(102)).toBe("1 hr 42 min");
    expect(formatElapsedTime(120)).toBe("2 hr");
  });
});

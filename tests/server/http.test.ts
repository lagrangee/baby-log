import { describe, expect, test } from "vitest";
import { jsonResponse, noContent } from "../../src/server/http";
import { nullableDate, timezoneOr } from "../../src/server/routes";

describe("HTTP response helpers", () => {
  test("JSON responses default to no-store", async () => {
    const response = jsonResponse({ ok: true });

    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  test("204 responses default to no-store", () => {
    const response = noContent();

    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  test("callers can intentionally override cache-control", () => {
    const emptyResponse = noContent({ "cache-control": "private, max-age=60" });
    const json = jsonResponse({ ok: true }, { headers: { "cache-control": "private, max-age=30" } });

    expect(emptyResponse.headers.get("cache-control")).toBe("private, max-age=60");
    expect(json.headers.get("cache-control")).toBe("private, max-age=30");
  });

  test("timezone input is validated before profile updates", () => {
    expect(timezoneOr(undefined, "Asia/Shanghai")).toBeUndefined();
    expect(timezoneOr("", "Asia/Shanghai")).toBe("Asia/Shanghai");
    expect(timezoneOr("UTC", "Asia/Shanghai")).toBe("UTC");
    expect(() => timezoneOr("Asia/Shangha", "Asia/Shanghai")).toThrow("Invalid timezone");
  });

  test("date-only input rejects impossible calendar dates", () => {
    expect(nullableDate(undefined)).toBeUndefined();
    expect(nullableDate(null)).toBeNull();
    expect(nullableDate("")).toBeNull();
    expect(nullableDate("2026-02-28")).toBe("2026-02-28");
    expect(nullableDate("2024-02-29")).toBe("2024-02-29");
    expect(() => nullableDate("2026-02-29")).toThrow("Date must be YYYY-MM-DD");
    expect(() => nullableDate("2026-02-31")).toThrow("Date must be YYYY-MM-DD");
    expect(() => nullableDate("2026-99-99")).toThrow("Date must be YYYY-MM-DD");
    expect(() => nullableDate("not-a-date")).toThrow("Date must be YYYY-MM-DD");
  });
});

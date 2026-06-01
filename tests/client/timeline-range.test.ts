import { describe, expect, test } from "vitest";
import { buildRangeQuery, presetFromParams, summaryQuery } from "../../src/client/utils/timeline-range";

describe("timeline custom range helpers", () => {
  test("presetFromParams keeps explicit custom preset", () => {
    expect(presetFromParams(new URLSearchParams("?preset=custom"))).toBe("custom");
  });

  test("presetFromParams treats custom dates as custom mode even without preset", () => {
    expect(presetFromParams(new URLSearchParams("?start_date=2026-04-25&end_date=2026-04-30"))).toBe("custom");
  });

  test("buildRangeQuery includes custom preset and both custom dates", () => {
    const query = new URLSearchParams(buildRangeQuery("custom", "2026-04-25", "2026-04-30", []));
    expect(query.get("preset")).toBe("custom");
    expect(query.get("start_date")).toBe("2026-04-25");
    expect(query.get("end_date")).toBe("2026-04-30");
  });

  test("buildRangeQuery normalizes one selected custom date to a one-day range", () => {
    const query = new URLSearchParams(buildRangeQuery("custom", "2026-04-25", "", []));
    expect(query.get("preset")).toBe("custom");
    expect(query.get("start_date")).toBe("2026-04-25");
    expect(query.get("end_date")).toBe("2026-04-25");
  });

  test("buildRangeQuery preserves selected event types", () => {
    const query = new URLSearchParams(buildRangeQuery("today", "", "", ["feed_bottle", "diaper_pee"]));
    expect(query.get("preset")).toBe("today");
    expect(query.get("event_types")).toBe("feed_bottle,diaper_pee");
  });

  test("summaryQuery uses normalized custom dates when available", () => {
    const query = new URLSearchParams(summaryQuery("custom", "", "2026-04-30"));
    expect(query.get("preset")).toBe("custom");
    expect(query.get("start_date")).toBe("2026-04-30");
    expect(query.get("end_date")).toBe("2026-04-30");
  });

  test("summaryQuery includes event types for filtered summaries", () => {
    const query = new URLSearchParams(summaryQuery("last_7d", "", "", ["feed_bottle"]));
    expect(query.get("preset")).toBe("last_7d");
    expect(query.get("range")).toBe("7d");
    expect(query.get("event_types")).toBe("feed_bottle");
  });
});

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { RecentEvents } from "../../src/client/components/RecentEvents";
import type { DisplayEventRecord } from "../../src/client/types";

describe("RecentEvents", () => {
  test("shows all provided events when no explicit limit is passed", () => {
    const html = renderToStaticMarkup(createElement(RecentEvents, { events: events(12), timezone: "Asia/Shanghai", editable: false }));

    expect(html).toContain("12 records");
  });

  test("honors an explicit display limit", () => {
    const html = renderToStaticMarkup(createElement(RecentEvents, { events: events(12), timezone: "Asia/Shanghai", limit: 5, editable: false }));

    expect(html).toContain("5 records");
  });
});

function events(count: number): DisplayEventRecord[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `evt_${index + 1}`,
    event_type: "diaper_pee",
    occurred_at: `2026-06-08T00:${String(index).padStart(2, "0")}:00Z`,
    ended_at: null,
    amount_value: null,
    amount_unit: null,
    note: null,
    details_json: {}
  }));
}

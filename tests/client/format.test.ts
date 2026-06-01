import { describe, expect, test } from "vitest";
import { formatEventValue } from "../../src/client/utils/format";

describe("formatEventValue", () => {
  test("does not duplicate breastfeeding duration when duration and end time agree", () => {
    expect(
      formatEventValue({
        event_type: "feed_breast",
        occurred_at: "2026-05-17T03:30:00Z",
        ended_at: "2026-05-17T04:00:00Z",
        amount_value: null,
        amount_unit: null,
        note: null,
        details_json: { side: "both", session_mode: "timed", duration_min: 30 }
      })
    ).toBe("both · 30 min");
  });

  test("keeps gram-level precision for weight measurements stored as kg", () => {
    expect(
      formatEventValue({
        event_type: "growth_measurement",
        occurred_at: "2026-05-17T00:00:00Z",
        ended_at: null,
        amount_value: 3.456,
        amount_unit: null,
        note: null,
        details_json: { measure_type: "weight_kg" }
      })
    ).toBe("weight 3.456 kg");
  });
});

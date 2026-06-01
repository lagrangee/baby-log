import { describe, expect, test } from "vitest";
import {
  HOME_QUICK_BUTTONS,
  MORE_RECORD_TYPES,
  isAllowedEventType,
  validateEventInput
} from "../../src/shared/content";

describe("frozen content whitelist", () => {
  test("home quick buttons stay exactly the frozen eight items", () => {
    expect(HOME_QUICK_BUTTONS).toEqual([
      "feed_breast",
      "feed_bottle",
      "diaper_pee",
      "diaper_poop",
      "sleep_session",
      "temperature",
      "medicine",
      "note"
    ]);
  });

  test("more record types stay exactly the frozen three items", () => {
    expect(MORE_RECORD_TYPES).toEqual(["symptom", "tummy_time", "growth_measurement"]);
  });

  test("custom system event types are rejected", () => {
    expect(isAllowedEventType("cry_score")).toBe(false);
    expect(() =>
      validateEventInput({
        event_type: "cry_score",
        occurred_at: "2026-04-24T00:00:00Z"
      })
    ).toThrow(/event_type/);
  });

  test("validation errors carry HTTP 400 status", () => {
    try {
      validateEventInput({
        event_type: "feed_bottle",
        occurred_at: "2026-04-24T00:00:00Z",
        amount_unit: "ml"
      });
      throw new Error("expected validation to fail");
    } catch (error) {
      expect(error).toMatchObject({ status: 400 });
    }
  });

  test("type-specific required fields are enforced", () => {
    expect(() =>
      validateEventInput({
        event_type: "feed_bottle",
        occurred_at: "2026-04-24T00:00:00Z",
        amount_unit: "ml"
      })
    ).toThrow(/amount_value/);

    expect(() =>
      validateEventInput({
        event_type: "note",
        occurred_at: "2026-04-24T00:00:00Z"
      })
    ).toThrow(/note/);
  });

  test("medicine accepts name or dose, but not amount_value alone", () => {
    expect(() =>
      validateEventInput({
        event_type: "medicine",
        occurred_at: "2026-04-24T00:00:00Z",
        details_json: { name: "Vitamin D" }
      })
    ).not.toThrow();

    expect(() =>
      validateEventInput({
        event_type: "medicine",
        occurred_at: "2026-04-24T00:00:00Z",
        details_json: { dose: "1 ml" }
      })
    ).not.toThrow();

    expect(() =>
      validateEventInput({
        event_type: "medicine",
        occurred_at: "2026-04-24T00:00:00Z",
        details_json: { name: "Vitamin D", dose: "1 ml" }
      })
    ).not.toThrow();

    expect(() =>
      validateEventInput({
        event_type: "medicine",
        occurred_at: "2026-04-24T00:00:00Z",
        details_json: {}
      })
    ).toThrow(/name or details_json.dose/);

    expect(() =>
      validateEventInput({
        event_type: "medicine",
        occurred_at: "2026-04-24T00:00:00Z",
        amount_value: 1,
        amount_unit: "ml",
        details_json: {}
      })
    ).toThrow(/name or details_json.dose/);

    expect(() =>
      validateEventInput({
        event_type: "medicine",
        occurred_at: "2026-04-24T00:00:00Z",
        details_json: { name: "   ", dose: "   " }
      })
    ).toThrow(/name or details_json.dose/);
  });
});

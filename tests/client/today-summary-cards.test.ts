import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { TodaySummaryCards } from "../../src/client/components/TodaySummaryCards";
import type { TodaySummary } from "../../src/client/types";

describe("TodaySummaryCards", () => {
  test("shows bottle milk total and milk-type breakdown on the feeding card", () => {
    const divider = String.fromCharCode(183);
    const html = renderToStaticMarkup(
      createElement(TodaySummaryCards, {
        summary: summary({
          feed_breast_count: 2,
          feed_bottle_count: 3,
          bottle_ml_total: 180,
          bottle_formula_ml_total: 120,
          bottle_breastmilk_ml_total: 60,
          latest_bottle_at: "2026-06-08T10:00:00Z"
        }),
        timezone: "Asia/Shanghai",
        hideBreastfeeding: true
      })
    );

    expect(html).toContain(`<strong>180 ml ${divider} 3 times</strong>`);
    expect(html).toContain(`<small>Formula 120 ml ${divider} Expressed milk 60 ml</small>`);
  });

  test("hides the standalone bottle total card when requested", () => {
    const html = renderToStaticMarkup(
      createElement(TodaySummaryCards, {
        summary: summary({
          feed_bottle_count: 3,
          bottle_ml_total: 180,
          bottle_formula_ml_total: 120,
          bottle_breastmilk_ml_total: 60,
          latest_bottle_at: "2026-06-08T10:00:00Z"
        }),
        timezone: "Asia/Shanghai",
        hideBreastfeeding: true,
        hideBottleTotalCard: true
      })
    );

    expect(html).toContain("<span>Feeding</span>");
    expect(html).toContain("<strong>180 ml");
    expect(html).not.toContain("<span>Bottle total</span>");
  });
});

function summary(patch: Partial<TodaySummary>): TodaySummary {
  return {
    date: "2026-05-09",
    feed_breast_count: 0,
    feed_bottle_count: 0,
    bottle_ml_total: 0,
    bottle_formula_ml_total: 0,
    bottle_breastmilk_ml_total: 0,
    breast_minutes_total: 0,
    breast_left_minutes_total: 0,
    breast_right_minutes_total: 0,
    pee_count: 0,
    poop_count: 0,
    sleep_session_count: 0,
    sleep_minutes_total: 0,
    latest_feeding_at: null,
    latest_breast_at: null,
    latest_bottle_at: null,
    latest_pee_at: null,
    latest_poop_at: null,
    latest_temperature_c: null,
    latest_temperature: null,
    latest_medicine: null,
    growth: {
      latest_weight_g: null,
      latest_length_cm: null,
      latest_head_circumference_cm: null,
      latest_measure_type: null,
      latest_value: null,
      latest_at: null
    },
    system_flags: [],
    ...patch
  };
}

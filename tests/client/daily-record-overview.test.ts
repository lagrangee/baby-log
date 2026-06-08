import { describe, expect, test } from "vitest";
import { buildSevenDayTrendCharts } from "../../src/client/components/DailyRecordOverview";
import { READ_ONLY_TABS, readOnlyOverviewSectionsForTab } from "../../src/client/pages/ReadOnlyPage";
import type { TodaySummary } from "../../src/client/types";

describe("daily record overview trend charts", () => {
  test("builds elder-readable chart series from oldest to today with pee and poop separated", () => {
    const result = buildSevenDayTrendCharts([
      summary({
        date: "2026-05-09",
        feed_breast_count: 1,
        feed_bottle_count: 0,
        bottle_ml_total: 80,
        bottle_formula_ml_total: 50,
        bottle_breastmilk_ml_total: 30,
        pee_count: 3,
        poop_count: 1,
        sleep_minutes_total: 65
      }),
      summary({
        date: "2026-05-10",
        growth: {
          latest_weight_g: 3400,
          latest_length_cm: 50.8,
          latest_head_circumference_cm: null,
          latest_measure_type: "weight_kg",
          latest_value: 3.4,
          latest_at: "2026-05-10T08:00:00Z"
        }
      }),
      summary({
        date: "2026-05-11",
        feed_breast_count: 2,
        feed_bottle_count: 0,
        bottle_ml_total: 0,
        bottle_formula_ml_total: 0,
        bottle_breastmilk_ml_total: 60,
        pee_count: 4,
        poop_count: 2,
        sleep_minutes_total: 120,
        growth: {
          latest_weight_g: 3600,
          latest_length_cm: 51.2,
          latest_head_circumference_cm: null,
          latest_measure_type: "weight_kg",
          latest_value: 3.6,
          latest_at: "2026-05-11T08:00:00Z"
        }
      })
    ]);

    expect(result.charts.map((chart) => chart.key)).toEqual(["feeding", "formula", "breastmilk", "pee", "poop", "sleep", "weight", "length"]);
    expect(result.charts.map((chart) => chart.title)).toEqual([
      "Feeding count (times)",
      "Formula (ml)",
      "Expressed milk (ml)",
      "Pee (times)",
      "Poop (times)",
      "Sleep duration (hr)",
      "Weight (g)",
      "Length (cm)"
    ]);
    expect(result.charts.find((chart) => chart.key === "formula")?.bars.map((bar) => bar.displayValue)).toEqual(["50", "0", "0"]);
    expect(result.charts.find((chart) => chart.key === "breastmilk")?.bars.map((bar) => bar.displayValue)).toEqual(["30", "0", "60"]);
    expect(result.charts.find((chart) => chart.key === "pee")?.bars.map((bar) => bar.value)).toEqual([3, 0, 4]);
    expect(result.charts.find((chart) => chart.key === "poop")?.bars.map((bar) => bar.value)).toEqual([1, 0, 2]);
    expect(result.charts[0].bars.map((bar) => `${bar.shortDate}:${bar.axisLabel}:${bar.isToday}`)).toEqual(["5/9:5/9:false", "5/10:5/10:false", "5/11:Today:true"]);
    expect(result.charts[0]).not.toHaveProperty("summaryText");
    expect(result.charts[0]).not.toHaveProperty("maxText");
    expect(result.charts[0].bars.map((bar) => bar.displayValue)).toEqual(["1", "0", "2"]);
    expect(result.charts[0].bars.map((bar) => bar.heightPercent)).toEqual([50, 0, 100]);
    expect(result.charts[0].bars.map((bar) => bar.heightBucket)).toEqual([50, 0, 100]);
    expect(result.charts.find((chart) => chart.key === "sleep")?.bars.map((bar) => bar.displayValue)).toEqual(["1.1", "0", "2.0"]);
    expect(result.charts.find((chart) => chart.key === "weight")).not.toHaveProperty("summaryText");
    expect(result.charts.find((chart) => chart.key === "weight")?.bars.map((bar) => bar.displayValue)).toEqual(["—", "3400", "3600"]);
    expect(result.charts.find((chart) => chart.key === "length")?.bars.map((bar) => bar.displayValue)).toEqual(["—", "50.8", "51.2"]);
  });

  test("keeps zero charts readable and does not invent growth trends", () => {
    const result = buildSevenDayTrendCharts([summary({ date: "2026-05-09" }), summary({ date: "2026-05-10" })]);

    expect(result.charts.every((chart) => !("summaryText" in chart))).toBe(true);
    expect(result.charts.flatMap((chart) => chart.bars).every((bar) => bar.heightPercent === 0)).toBe(true);
    expect(result.charts.find((chart) => chart.key === "weight")?.bars.map((bar) => bar.displayValue)).toEqual(["—", "—"]);
  });

  test("hides breastfeeding trend data from the home overview", () => {
    const result = buildSevenDayTrendCharts(
      [
        summary({
          date: "2026-05-09",
          feed_breast_count: 3,
          feed_bottle_count: 1,
          bottle_breastmilk_ml_total: 90,
          bottle_formula_ml_total: 30
        }),
        summary({
          date: "2026-05-10",
          feed_breast_count: 2,
          feed_bottle_count: 4,
          bottle_breastmilk_ml_total: 120,
          bottle_formula_ml_total: 60
        })
      ],
      { hideBreastfeeding: true }
    );

    expect(result.charts.map((chart) => chart.key)).toEqual(["feeding", "formula", "pee", "poop", "sleep", "weight", "length"]);
    expect(result.charts.find((chart) => chart.key === "feeding")?.bars.map((bar) => bar.displayValue)).toEqual(["1", "4"]);
  });
});

describe("read-only page tabs", () => {
  test("keeps today focused and moves record, seven-day, and growth content into their own tabs", () => {
    expect(READ_ONLY_TABS.map((tab) => tab.label)).toEqual(["Today", "Record", "7 days", "Growth"]);
    expect(readOnlyOverviewSectionsForTab("today")).toContain("summaryCards");
    expect(readOnlyOverviewSectionsForTab("today")).toContain("recentEvents");
    expect(readOnlyOverviewSectionsForTab("today")).not.toContain("quickRecord");
    expect(readOnlyOverviewSectionsForTab("today")).not.toContain("sevenDayTrend");
    expect(readOnlyOverviewSectionsForTab("today")).not.toContain("growthCurve");
    expect(readOnlyOverviewSectionsForTab("record")).toEqual(["quickRecord"]);
    expect(readOnlyOverviewSectionsForTab("last7")).toEqual(["sevenDayTrend"]);
    expect(readOnlyOverviewSectionsForTab("growth")).toEqual(["growthCurve"]);
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

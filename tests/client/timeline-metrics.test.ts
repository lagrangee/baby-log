import { describe, expect, test } from "vitest";
import { visibleComparisonMetricItems, visibleTrendMetricItems } from "../../src/client/utils/timeline-metrics";

describe("timeline metric visibility", () => {
  test("shows only temperature trend metrics when temperature is selected", () => {
    expect(visibleTrendMetricItems(["temperature"]).map((item) => item.label)).toEqual(["最高体温"]);
  });

  test("shows only diaper trend metrics when diaper filters are selected", () => {
    expect(visibleTrendMetricItems(["diaper_pee", "diaper_poop"]).map((item) => item.label)).toEqual(["小便", "大便"]);
  });

  test("shows only temperature comparison metrics when temperature is selected", () => {
    expect(visibleComparisonMetricItems(["temperature"]).map((item) => item.label)).toEqual(["最高体温"]);
  });

  test("keeps the full trend set when there is no filter", () => {
    expect(visibleTrendMetricItems([]).map((item) => item.label)).toContain("喂养次数");
    expect(visibleTrendMetricItems([]).map((item) => item.label)).toContain("最高体温");
  });
});

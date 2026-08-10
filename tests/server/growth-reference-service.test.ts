import { describe, expect, test } from "vitest";
import { EventService } from "../../src/server/services/event-service";
import { buildGrowthCurvePayload } from "../../src/server/services/growth-reference-service";
import { updateStableChildFacts } from "../../src/server/services/stable-child-facts-service";
import { createMemoryStore } from "../../src/server/testing/memory-store";

describe("growth reference payload", () => {
  test("uses stable child facts and latest growth measurements against WHO sex-and-age reference bands", async () => {
    const store = createMemoryStore({
      profile: {
        child_name: "Demo Baby",
        child_birth_date: "2026-01-10",
        phase: "newborn_or_baby"
      }
    });
    const nowIso = "2026-01-27T04:00:00Z";

    await updateStableChildFacts(
      store,
      {
        sex: "female",
        birth_date: "2026-01-10",
        birth_weight_g: 3200,
        birth_length_cm: 50
      },
      nowIso
    );
    await new EventService(store).create(
      {
        event_type: "growth_measurement",
        occurred_at: "2026-01-27T02:00:00Z",
        amount_value: 3.8,
        amount_unit: "kg",
        details_json: { measure_type: "weight_kg" }
      },
      "mom",
      nowIso
    );

    const payload = await buildGrowthCurvePayload(store, nowIso);

    expect(payload.available).toBe(true);
    expect(payload.profile_context).toMatchObject({
      sex: "female",
      birth_date: "2026-01-10",
      current_age_days: 17,
      current_birth_day_number: 18
    });
    expect(payload.source.band_label).toBe("2nd-98th percentile reference band");
    expect(payload.source).toMatchObject({
      coverage: "birth_to_day_730",
      calculation: "lms",
      coverage_label: "Birth to day 730 (approximately 24 months)"
    });

    const weight = payload.items.find((item) => item.measure_type === "weight_kg");
    expect(weight).toMatchObject({
      status: "within_reference_band",
      latest_measurement: {
        value: 3800,
        unit: "g",
        age_days: 17,
        birth_day_number: 18,
        source: "event"
      },
      reference: {
        age_days: 17,
        p2: 2723,
        p25: 3342,
        p50: 3682,
        p75: 4048,
        p98: 4887
      }
    });
    expect(weight?.latest_measurement).toMatchObject({
      percentile: 58.8,
      z_score: 0.22
    });
    expect(weight?.personal_trend).toMatchObject({
      birth_percentile: 47.2,
      current_percentile: 58.8,
      z_score_delta: 0.29,
      direction: "stable",
      label: "Stable trend"
    });

    const length = payload.items.find((item) => item.measure_type === "length_cm");
    expect(length).toMatchObject({
      status: "within_reference_band",
      latest_measurement: {
        value: 50,
        unit: "cm",
        age_days: 0,
        birth_day_number: 1,
        source: "birth_fact"
      },
      reference: {
        age_days: 0,
        p2: 45.3,
        p25: 47.9,
        p50: 49.1,
        p75: 50.4,
        p98: 53
      }
    });
    expect(length?.latest_measurement).toMatchObject({
      percentile: 67.6,
      z_score: 0.46
    });
    expect(length?.personal_trend).toMatchObject({
      birth_percentile: 67.6,
      current_percentile: null,
      direction: "baseline_only",
      label: "Waiting for a recent measurement"
    });

    const head = payload.items.find((item) => item.measure_type === "head_circumference_cm");
    expect(head?.status).toBe("no_measurement");
    expect(head?.reference?.age_days).toBe(17);
  });

  test("reports missing profile facts instead of guessing sex or birth date", async () => {
    const store = createMemoryStore({
      profile: {
        child_name: "Demo Baby",
        phase: "newborn_or_baby"
      }
    });

    const payload = await buildGrowthCurvePayload(store, "2026-05-24T04:00:00Z");

    expect(payload.available).toBe(false);
    expect(payload.missing).toEqual(["sex", "birth_date"]);
    expect(payload.items).toEqual([]);
  });

  test("uses the daily WHO reference through day 730 and fails closed at day 731", async () => {
    const store = createMemoryStore({
      profile: {
        child_name: "Demo Baby",
        child_birth_date: "2026-01-10",
        phase: "newborn_or_baby"
      }
    });
    await updateStableChildFacts(
      store,
      {
        sex: "male",
        birth_date: "2026-01-10",
        birth_weight_g: 3200
      },
      "2028-01-10T04:00:00Z"
    );

    await new EventService(store).create(
      {
        event_type: "growth_measurement",
        occurred_at: "2028-01-10T02:00:00Z",
        amount_value: 12.1482,
        amount_unit: "kg",
        details_json: { measure_type: "weight_kg" }
      },
      "dad",
      "2028-01-10T04:00:00Z"
    );

    const day730 = await buildGrowthCurvePayload(store, "2028-01-10T04:00:00Z");
    const day730Weight = day730.items.find((item) => item.measure_type === "weight_kg");
    expect(day730.profile_context.current_age_days).toBe(730);
    expect(day730Weight).toMatchObject({
      status: "within_reference_band",
      reference: {
        age_days: 730,
        p50: 12148
      },
      latest_measurement: {
        age_days: 730,
        percentile: 50,
        z_score: 0
      }
    });

    await new EventService(store).create(
      {
        event_type: "growth_measurement",
        occurred_at: "2028-01-11T02:00:00Z",
        amount_value: 12.2,
        amount_unit: "kg",
        details_json: { measure_type: "weight_kg" }
      },
      "dad",
      "2028-01-11T04:00:00Z"
    );

    const day731 = await buildGrowthCurvePayload(store, "2028-01-11T04:00:00Z");
    const day731Weight = day731.items.find((item) => item.measure_type === "weight_kg");
    expect(day731.profile_context.current_age_days).toBe(731);
    expect(day731Weight).toMatchObject({
      status: "unavailable",
      reference: null,
      latest_measurement: {
        age_days: 731,
        percentile: null,
        z_score: null
      },
      personal_trend: {
        direction: "unavailable",
        label: "Reference unavailable at this age"
      }
    });
  });
});

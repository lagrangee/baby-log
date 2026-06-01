import { describe, expect, test } from "vitest";
import { createMemoryStore } from "../../src/server/testing/memory-store";
import { EventService } from "../../src/server/services/event-service";
import { buildMachinePayload } from "../../src/server/services/machine-service";
import { buildPediatricSummary, buildStatusDay, buildStatusOverview, buildStatusRangeAnalytics, buildStatusTimeline, buildStatusTrends } from "../../src/server/services/status-service";
import { getReferenceCatalog } from "../../src/server/services/reference-target-service";

const nowIso = "2026-04-26T04:00:00Z";

describe("baby status service", () => {
  test("day summary exposes today counts with real latest event timestamps across local dates", async () => {
    const store = createMemoryStore(afterBirthProfile());
    const events = new EventService(store);

    await events.create({ event_type: "feed_breast", occurred_at: "2026-04-25T15:00:00Z", details_json: { session_mode: "timed", duration_min: 10, side: "left" } }, "mom", nowIso);
    await events.create({ event_type: "diaper_pee", occurred_at: "2026-04-25T15:10:00Z" }, "mom", nowIso);
    await events.create({ event_type: "diaper_poop", occurred_at: "2026-04-25T15:20:00Z" }, "dad", nowIso);
    await events.create({ event_type: "feed_bottle", occurred_at: "2026-04-25T15:30:00Z", amount_value: 20, amount_unit: "ml" }, "dad", nowIso);

    const summary = await buildStatusDay(store, "2026-04-26T04:00:00Z", "today");

    expect(summary.summary.date).toBe("2026-04-26");
    expect(summary.summary.feed_breast_count).toBe(0);
    expect(summary.summary.feed_bottle_count).toBe(0);
    expect(summary.summary.pee_count).toBe(0);
    expect(summary.summary.poop_count).toBe(0);
    expect(summary.summary.latest_breast_at).toBe("2026-04-25T15:00:00Z");
    expect(summary.summary.latest_pee_at).toBe("2026-04-25T15:10:00Z");
    expect(summary.summary.latest_poop_at).toBe("2026-04-25T15:20:00Z");
    expect(summary.summary.latest_bottle_at).toBe("2026-04-25T15:30:00Z");
    expect(summary.summary.latest_feeding_at).toBe("2026-04-25T15:30:00Z");
  });

  test("day summary splits both-side breast minutes evenly across left and right", async () => {
    const store = createMemoryStore(afterBirthProfile());
    const events = new EventService(store);

    await events.create({ event_type: "feed_breast", occurred_at: "2026-04-26T00:00:00Z", details_json: { session_mode: "timed", duration_min: 12, side: "left" } }, "mom", nowIso);
    await events.create({ event_type: "feed_breast", occurred_at: "2026-04-26T01:00:00Z", details_json: { session_mode: "timed", duration_min: 8, side: "right" } }, "mom", nowIso);
    await events.create({ event_type: "feed_breast", occurred_at: "2026-04-26T02:00:00Z", details_json: { session_mode: "timed", duration_min: 6, side: "both" } }, "mom", nowIso);
    await events.create({ event_type: "feed_breast", occurred_at: "2026-04-26T03:00:00Z", details_json: { session_mode: "timed", duration_min: 5, side: "unknown" } }, "mom", nowIso);

    const summary = await buildStatusDay(store, nowIso, "today");

    expect(summary.summary.breast_minutes_total).toBe(31);
    expect(summary.summary.breast_left_minutes_total).toBe(15);
    expect(summary.summary.breast_right_minutes_total).toBe(11);
  });

  test("status day supports yesterday as a full local day with events for editing", async () => {
    const store = createMemoryStore(afterBirthProfile());
    const events = new EventService(store);

    const yesterdayEvent = await events.create({ event_type: "diaper_pee", occurred_at: "2026-04-25T01:00:00Z" }, "mom", nowIso);
    await events.create({ event_type: "diaper_poop", occurred_at: "2026-04-26T01:00:00Z" }, "dad", nowIso);

    const day = await buildStatusDay(store, nowIso, "yesterday");

    expect(day.local_date).toBe("2026-04-25");
    expect(day.summary.date).toBe("2026-04-25");
    expect(day.summary.pee_count).toBe(1);
    expect(day.summary.poop_count).toBe(0);
    expect(day.events.map((event) => event.id)).toEqual([yesterdayEvent.id]);
  });

  test("feeding summary counts breast minutes and bottle milk type totals", async () => {
    const store = createMemoryStore(afterBirthProfile());
    const events = new EventService(store);

    await events.create({ event_type: "feed_breast", occurred_at: "2026-04-26T00:00:00Z", details_json: { duration_min: 12 } }, "mom", nowIso);
    await events.create({ event_type: "feed_breast", occurred_at: "2026-04-26T01:00:00Z", details_json: { duration_min: 8 } }, "mom", nowIso);
    await events.create({ event_type: "feed_bottle", occurred_at: "2026-04-26T02:00:00Z", amount_value: 90, amount_unit: "ml", details_json: { milk_type: "formula" } }, "dad", nowIso);
    await events.create({ event_type: "feed_bottle", occurred_at: "2026-04-26T03:00:00Z", amount_value: 60, amount_unit: "ml", details_json: { milk_type: "breastmilk" } }, "dad", nowIso);
    await events.create({ event_type: "feed_bottle", occurred_at: "2026-04-26T03:30:00Z", amount_value: 30, amount_unit: "ml", details_json: { milk_type: "mixed" } }, "dad", nowIso);

    const overview = await buildStatusOverview(store, nowIso, 7);

    expect(overview.today.feeding).toEqual({
      breast_count: 2,
      breast_minutes_total: 20,
      breast_open_session_count: 0,
      breast_latest_at: "2026-04-26T01:00:00Z",
      bottle_count: 3,
      bottle_ml_total: 180,
      bottle_latest_at: "2026-04-26T03:30:00Z",
      formula_ml_total: 90,
      breastmilk_bottle_ml_total: 60,
      mixed_or_other_ml_total: 30,
      average_bottle_ml_per_feed: 60,
      total_count: 5,
      latest_feeding_at: "2026-04-26T03:30:00Z",
      latest_feeding_type: "feed_bottle"
    });
  });

  test("diaper summary counts pee, poop, colors, and textures", async () => {
    const store = createMemoryStore(afterBirthProfile());
    const events = new EventService(store);

    await events.create({ event_type: "diaper_pee", occurred_at: "2026-04-26T00:00:00Z" }, "mom", nowIso);
    await events.create({ event_type: "diaper_pee", occurred_at: "2026-04-26T01:00:00Z" }, "mom", nowIso);
    await events.create({ event_type: "diaper_poop", occurred_at: "2026-04-26T02:00:00Z", details_json: { color: "yellow", texture: "seedy" } }, "dad", nowIso);
    await events.create({ event_type: "diaper_poop", occurred_at: "2026-04-26T03:00:00Z", details_json: { color: "green", texture: "loose" } }, "dad", nowIso);
    await events.create({ event_type: "diaper_poop", occurred_at: "2026-04-26T03:30:00Z", details_json: { color: "yellow", texture: "seedy" } }, "dad", nowIso);

    const overview = await buildStatusOverview(store, nowIso, 7);

    expect(overview.today.diaper).toEqual({
      pee_count: 2,
      poop_count: 3,
      latest_diaper_at: "2026-04-26T03:30:00Z",
      latest_pee_at: "2026-04-26T01:00:00Z",
      latest_poop_at: "2026-04-26T03:30:00Z",
      poop_colors: { yellow: 2, green: 1 },
      poop_textures: { seedy: 2, loose: 1 }
    });
  });

  test("sleep summary splits cross-day sleep and reports daily longest segment", async () => {
    const store = createMemoryStore(afterBirthProfile());
    const events = new EventService(store);

    await events.create({ event_type: "sleep_session", occurred_at: "2026-04-25T15:00:00Z", ended_at: "2026-04-25T17:00:00Z" }, "dad", nowIso);
    await events.create({ event_type: "sleep_session", occurred_at: "2026-04-25T18:00:00Z", ended_at: "2026-04-25T20:30:00Z" }, "dad", nowIso);

    const trends = await buildStatusTrends(store, "2026-04-26T04:00:00Z", 3);
    const apr25 = trends.days.find((day) => day.local_date === "2026-04-25");
    const apr26 = trends.days.find((day) => day.local_date === "2026-04-26");

    expect(apr25?.sleep).toMatchObject({ minutes_total: 60, longest_minutes: 60, session_count: 1 });
    expect(apr26?.sleep).toMatchObject({ minutes_total: 210, longest_minutes: 150, session_count: 2 });
    expect(trends.series.sleep_minutes_total.at(-1)).toBe(210);
    expect(trends.series.longest_sleep_minutes.at(-1)).toBe(150);
  });

  test("temperature summary reports latest and max", async () => {
    const store = createMemoryStore(afterBirthProfile());
    const events = new EventService(store);

    await events.create({ event_type: "temperature", occurred_at: "2026-04-26T00:00:00Z", amount_value: 38.4, amount_unit: "celsius", details_json: { method: "rectal" } }, "mom", nowIso);
    const latest = await events.create({ event_type: "temperature", occurred_at: "2026-04-26T03:00:00Z", amount_value: 37.2, amount_unit: "celsius", details_json: { method: "armpit" } }, "mom", nowIso);

    const overview = await buildStatusOverview(store, nowIso, 7);

    expect(overview.today.temperature).toEqual({
      latest_c: 37.2,
      latest_occurred_at: "2026-04-26T03:00:00Z",
      latest_method: "armpit",
      latest_event_id: latest.id,
      max_c: 38.4,
      count: 2
    });
    expect(overview.data_quality.map((flag) => flag.code)).toContain("temperature_recorded_high");
  });

  test("data quality flags unusual temperature values as record checks only", async () => {
    const store = createMemoryStore(afterBirthProfile());
    const events = new EventService(store);

    await events.create({ event_type: "temperature", occurred_at: "2026-04-26T00:00:00Z", amount_value: 45, amount_unit: "celsius" }, "mom", nowIso);

    const overview = await buildStatusOverview(store, nowIso, 7);

    expect(overview.data_quality.map((flag) => flag.code)).toContain("temperature_value_unusual");
    expect(JSON.stringify(overview.data_quality)).not.toMatch(/诊断为|患有|建议用药|应接种|不应接种/);
  });

  test("feeding intelligence computes ended_at duration, tracks timed open breast sessions, and never estimates ml", async () => {
    const store = createMemoryStore(afterBirthProfile());
    const events = new EventService(store);

    await events.create({ event_type: "feed_breast", occurred_at: "2026-04-25T23:00:00Z", ended_at: "2026-04-25T23:18:00Z", details_json: { session_mode: "timed", side: "left" } }, "mom", nowIso);
    await events.create({ event_type: "feed_breast", occurred_at: "2026-04-26T02:30:00Z", details_json: { session_mode: "timed", side: "right" } }, "mom", nowIso);

    const overview = await buildStatusOverview(store, "2026-04-26T04:00:00Z", 7);

    expect(overview.today.feeding).toMatchObject({
      breast_count: 2,
      breast_minutes_total: 18,
      breast_open_session_count: 1,
      bottle_ml_total: 0
    });
    expect(overview.active_state.open_breast_session).toMatchObject({ event_type: "feed_breast" });
    expect(overview.data_quality.map((flag) => flag.code)).toContain("open_breast_session_long");
  });

  test("quick breast record is count-only and never becomes an open session", async () => {
    const store = createMemoryStore(afterBirthProfile());
    const events = new EventService(store);

    await events.create({ event_type: "feed_breast", occurred_at: "2026-04-26T02:30:00Z", details_json: { session_mode: "count_only", side: "left" } }, "mom", nowIso);

    const overview = await buildStatusOverview(store, "2026-04-26T04:00:00Z", 7);

    expect(overview.today.feeding).toMatchObject({
      breast_count: 1,
      breast_minutes_total: 0,
      breast_open_session_count: 0,
      breast_latest_at: "2026-04-26T02:30:00Z",
      latest_feeding_at: "2026-04-26T02:30:00Z",
      latest_feeding_type: "feed_breast"
    });
    expect(overview.active_state.open_breast_session).toBeNull();
    expect(overview.data_quality.map((flag) => flag.code)).not.toContain("open_breast_session_long");
  });

  test("timed breast record with duration but no ended_at is completed, not open", async () => {
    const store = createMemoryStore(afterBirthProfile());
    const events = new EventService(store);

    await events.create({ event_type: "feed_breast", occurred_at: "2026-04-26T01:00:00Z", details_json: { session_mode: "timed", duration_min: 15 } }, "mom", nowIso);

    const overview = await buildStatusOverview(store, "2026-04-26T04:00:00Z", 7);

    expect(overview.today.feeding).toMatchObject({
      breast_count: 1,
      breast_minutes_total: 15,
      breast_open_session_count: 0
    });
    expect(overview.active_state.open_breast_session).toBeNull();
    expect(overview.data_quality.map((flag) => flag.code)).not.toContain("open_breast_session_long");
  });

  test("ending a timed breast session records minutes and removes the open session", async () => {
    const store = createMemoryStore(afterBirthProfile());
    const events = new EventService(store);
    const open = await events.create({ event_type: "feed_breast", occurred_at: "2026-04-26T02:30:00Z", details_json: { session_mode: "timed", side: "right" } }, "mom", nowIso);

    await events.update(open.id, { ended_at: "2026-04-26T03:00:00Z" }, "2026-04-26T03:00:00Z");
    const overview = await buildStatusOverview(store, "2026-04-26T04:00:00Z", 7);

    expect(overview.today.feeding).toMatchObject({
      breast_count: 1,
      breast_minutes_total: 30,
      breast_open_session_count: 0
    });
    expect(overview.active_state.open_breast_session).toBeNull();
  });

  test("event validation rejects ended_at before occurred_at and invalid breast details", async () => {
    const store = createMemoryStore(afterBirthProfile());
    const events = new EventService(store);

    await expect(
      events.create({ event_type: "feed_breast", occurred_at: "2026-04-26T02:00:00Z", ended_at: "2026-04-26T01:59:00Z" }, "mom", nowIso)
    ).rejects.toThrow("ended_at must be after occurred_at");
    await expect(
      events.create({ event_type: "feed_breast", occurred_at: "2026-04-26T02:00:00Z", details_json: { duration_min: 0 } }, "mom", nowIso)
    ).rejects.toThrow("details_json.duration_min must be > 0 and <= 240");
  });

  test("reference targets validate catalog, compare day 5 diaper records, and use neutral fever wording", async () => {
    const catalog = getReferenceCatalog();
    const keys = catalog.items.map((item) => item.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(catalog.runtime_policy).toMatchObject({ d1_catalog: false, runtime_sync: false, diagnosis: false, treatment_advice: false, vaccine_schedule_generation: false });

    const store = createMemoryStore(afterBirthProfile());
    const events = new EventService(store);
    await events.create({ event_type: "diaper_pee", occurred_at: "2026-04-26T00:00:00Z" }, "mom", nowIso);
    await events.create({ event_type: "temperature", occurred_at: "2026-04-26T01:00:00Z", amount_value: 38.2, amount_unit: "celsius" }, "mom", nowIso);

    const overview = await buildStatusOverview(store, nowIso, 7);
    const wetDiaper = overview.reference_targets.items.find((item) => item.key === "wet_diapers_day_5_30");
    const temp = overview.reference_targets.items.find((item) => item.key === "temperature_under_3_months_38c");
    const noEstimate = overview.reference_targets.items.find((item) => item.key === "breastfeeding_no_auto_volume_estimate");

    expect(wetDiaper).toMatchObject({ current_value: 1, target_label: "≥ 6 wet diapers/24h", status: "below_reference" });
    expect(temp).toMatchObject({ target_label: "≤ 37.9 C", status: "red_flag_recorded" });
    expect(temp?.message).toContain("does not determine the cause");
    expect(noEstimate).toMatchObject({ status: "reference_only" });
    expect(JSON.stringify(overview.reference_targets)).not.toMatch(/诊断为|患有|治疗方案|建议用药|应接种|不应接种/);
  });

  test("range analytics supports presets, multi event filters, and previous comparison", async () => {
    const store = createMemoryStore(afterBirthProfile());
    const events = new EventService(store);
    await events.create({ event_type: "feed_bottle", occurred_at: "2026-04-25T01:00:00Z", amount_value: 40, amount_unit: "ml" }, "dad", nowIso);
    await events.create({ event_type: "feed_bottle", occurred_at: "2026-04-26T01:00:00Z", amount_value: 80, amount_unit: "ml" }, "dad", nowIso);
    await events.create({ event_type: "diaper_pee", occurred_at: "2026-04-26T02:00:00Z" }, "mom", nowIso);

    const analytics = await buildStatusRangeAnalytics(store, nowIso, { preset: "last_24h", event_types: ["feed_bottle", "diaper_pee"], compare: "previous" });

    expect(analytics.range.preset).toBe("last_24h");
    expect(analytics.event_types).toEqual(["feed_bottle", "diaper_pee"]);
    expect(analytics.summary.feeding.bottle_ml_total).toBe(80);
    expect(analytics.summary.diaper.pee_count).toBe(1);
    expect(analytics.comparison?.deltas.bottle_ml_total).toMatchObject({ current: 80, previous: 40, delta: 40 });
  });

  test("range analytics reference targets use the full range even when event type filters are active", async () => {
    const store = createMemoryStore(afterBirthProfile());
    const events = new EventService(store);
    await events.create({ event_type: "feed_breast", occurred_at: "2026-04-26T00:00:00Z", details_json: { session_mode: "count_only" } }, "mom", nowIso);
    await events.create({ event_type: "diaper_pee", occurred_at: "2026-04-26T01:00:00Z" }, "mom", nowIso);
    await events.create({ event_type: "diaper_pee", occurred_at: "2026-04-26T02:00:00Z" }, "mom", nowIso);

    const analytics = await buildStatusRangeAnalytics(store, nowIso, { preset: "last_24h", event_types: ["feed_breast"] });
    const wetDiaper = analytics.reference_targets.find((item) => item.key === "wet_diapers_day_5_30");

    expect(analytics.summary.diaper.pee_count).toBe(0);
    expect(wetDiaper).toMatchObject({ current_value: 2 });
    expect(analytics.reference_targets_note).toBe("Reference targets are based on all records in the period and are not affected by event-type filters.");
  });

  test("last_24h timeline and analytics use a strict rolling 24 hour range", async () => {
    const store = createMemoryStore(afterBirthProfile());
    const events = new EventService(store);
    await events.create({ event_type: "feed_bottle", occurred_at: "2026-04-25T03:00:00Z", amount_value: 20, amount_unit: "ml" }, "dad", nowIso);
    await events.create({ event_type: "feed_bottle", occurred_at: "2026-04-25T05:00:00Z", amount_value: 80, amount_unit: "ml" }, "dad", nowIso);

    const timeline = await buildStatusTimeline(store, nowIso, { preset: "last_24h", limit: 100 });
    const analytics = await buildStatusRangeAnalytics(store, nowIso, { preset: "last_24h" });

    expect(timeline.groups).toHaveLength(1);
    expect(timeline.groups[0].local_date).toBe("最近 24 小时");
    expect(timeline.groups[0].summary.feeding.bottle_ml_total).toBe(80);
    expect(timeline.groups.flatMap((group) => group.events).map((event) => event.amount_value)).toEqual([80]);
    expect(analytics.summary.feeding.bottle_ml_total).toBe(80);
    expect(analytics.days).toHaveLength(1);
    expect(analytics.days[0].feeding.bottle_ml_total).toBe(80);
  });

  test("UTC range end is exclusive", async () => {
    const store = createMemoryStore(afterBirthProfile());
    const events = new EventService(store);
    await events.create({ event_type: "feed_bottle", occurred_at: "2026-04-25T15:59:59.999Z", amount_value: 40, amount_unit: "ml" }, "dad", nowIso);
    await events.create({ event_type: "feed_bottle", occurred_at: "2026-04-25T16:00:00Z", amount_value: 100, amount_unit: "ml" }, "dad", nowIso);

    const analytics = await buildStatusRangeAnalytics(store, nowIso, { start_date: "2026-04-25", end_date: "2026-04-25" });

    expect(analytics.range.end_utc).toBe("2026-04-25T16:00:00Z");
    expect(analytics.summary.feeding.bottle_count).toBe(1);
    expect(analytics.summary.feeding.bottle_ml_total).toBe(40);
  });

  test("growth summary reports latest values by measurement type", async () => {
    const store = createMemoryStore(afterBirthProfile());
    const events = new EventService(store);

    await events.create({ event_type: "growth_measurement", occurred_at: "2026-04-26T00:00:00Z", amount_value: 4.1, details_json: { measure_type: "weight_kg" } }, "dad", nowIso);
    await events.create({ event_type: "growth_measurement", occurred_at: "2026-04-26T01:00:00Z", amount_value: 4.25, details_json: { measure_type: "weight_kg" } }, "dad", nowIso);
    await events.create({ event_type: "growth_measurement", occurred_at: "2026-04-26T02:00:00Z", amount_value: 54.2, details_json: { measure_type: "length_cm" } }, "dad", nowIso);
    await events.create({ event_type: "growth_measurement", occurred_at: "2026-04-26T03:00:00Z", amount_value: 37.1, details_json: { measure_type: "head_circumference_cm" } }, "dad", nowIso);

    const overview = await buildStatusOverview(store, nowIso, 7);

    expect(overview.today.growth).toEqual({
      latest_weight_g: 4250,
      latest_length_cm: 54.2,
      latest_head_circumference_cm: 37.1
    });
  });

  test("symptom summary counts severity and tags", async () => {
    const store = createMemoryStore(afterBirthProfile());
    const events = new EventService(store);

    await events.create({ event_type: "symptom", occurred_at: "2026-04-26T00:00:00Z", details_json: { severity: "mild", symptom_tags: ["cough", "rash"] } }, "mom", nowIso);
    await events.create({ event_type: "symptom", occurred_at: "2026-04-26T02:00:00Z", details_json: { severity: "moderate", symptom_tags: ["cough"] } }, "mom", nowIso);

    const overview = await buildStatusOverview(store, nowIso, 7);

    expect(overview.today.symptoms).toEqual({
      count: 2,
      by_severity: { mild: 1, moderate: 1 },
      tags: { cough: 2, rash: 1 }
    });
  });

  test("pediatric summary returns safe Chinese plain text and structured sections", async () => {
    const store = createMemoryStore(afterBirthProfile());
    const events = new EventService(store);

    await events.create({ event_type: "feed_bottle", occurred_at: "2026-04-26T00:00:00Z", amount_value: 90, amount_unit: "ml", details_json: { milk_type: "formula" } }, "dad", nowIso);
    await events.create({ event_type: "temperature", occurred_at: "2026-04-26T01:00:00Z", amount_value: 38.1, amount_unit: "celsius" }, "mom", nowIso);
    await events.create({ event_type: "symptom", occurred_at: "2026-04-26T02:00:00Z", details_json: { severity: "mild", symptom_tags: ["cough"] } }, "mom", nowIso);

    const summary = await buildPediatricSummary(store, "7d", nowIso);

    expect(summary.range).toBe("7d");
    expect(summary.plain_text).toContain("以下为便于问诊的记录摘要");
    expect(summary.plain_text).toContain("基本信息");
    expect(summary.plain_text).toContain("以上只汇总家庭记录，不提供诊断、治疗、用药或疫苗决策；如有担心，请联系儿科医生或医院。");
    expect(summary.plain_text).toContain("记录到");
    expect(summary.structured.basic_info.length).toBeGreaterThan(0);
    expect(summary.structured.feeding.length).toBeGreaterThan(0);
    expect(summary.structured.temperature.length).toBeGreaterThan(0);
    expect(summary.plain_text).not.toMatch(/诊断为|患有|建议用药|可以不用看医生|应接种|不应接种/);
  });

  test("pediatric summary range uses a rolling window", async () => {
    const store = createMemoryStore(afterBirthProfile());
    const events = new EventService(store);

    await events.create({ event_type: "feed_bottle", occurred_at: "2026-04-25T02:30:00Z", amount_value: 20, amount_unit: "ml" }, "dad", nowIso);
    await events.create({ event_type: "feed_bottle", occurred_at: "2026-04-25T06:00:00Z", amount_value: 80, amount_unit: "ml" }, "dad", nowIso);

    const summary24h = await buildPediatricSummary(store, "24h", nowIso);
    const summary3d = await buildPediatricSummary(store, "3d", nowIso);

    expect(summary24h.structured.feeding[0]).toContain("奶瓶总量 80 ml");
    expect(summary3d.structured.feeding[0]).toContain("奶瓶总量 100 ml");
  });

  test("pediatric summary can be filtered by event type without full reference targets", async () => {
    const store = createMemoryStore(afterBirthProfile());
    const events = new EventService(store);

    await events.create({ event_type: "feed_bottle", occurred_at: "2026-04-26T00:00:00Z", amount_value: 80, amount_unit: "ml" }, "dad", nowIso);
    await events.create({ event_type: "diaper_pee", occurred_at: "2026-04-26T01:00:00Z" }, "mom", nowIso);
    await events.create({ event_type: "sleep_session", occurred_at: "2026-04-26T02:00:00Z", ended_at: "2026-04-26T03:00:00Z" }, "dad", nowIso);

    const summary = await buildPediatricSummary(store, { range: "24h", preset: "last_24h", event_types: ["feed_bottle"] }, nowIso);
    const plain = summary.plain_text;

    expect(summary.structured.feeding[0]).toContain("奶瓶总量 80 ml");
    expect(summary.structured.diaper[0]).toContain("小便 0 次，大便 0 次");
    expect(summary.structured.sleep[0]).toContain("睡眠 0 段");
    expect(summary.structured.reference_targets.join("\n")).toContain("完整问诊摘要请清空筛选");
    expect(plain).not.toContain("小便 1 次");
    expect(plain).not.toContain("睡眠 1 段");
    expect(summary.structured.reference_targets.join("\n")).not.toContain("记录 1 次");
  });

  test("pediatric summary latest medicine uses newest occurred_at", async () => {
    const store = createMemoryStore(afterBirthProfile());
    const events = new EventService(store);

    await events.create({ event_type: "medicine", occurred_at: "2026-04-26T00:00:00Z", details_json: { name: "旧记录", dose: "1 ml" } }, "dad", nowIso);
    await events.create({ event_type: "medicine", occurred_at: "2026-04-26T03:00:00Z", details_json: { name: "新记录", dose: "2 ml" } }, "dad", nowIso);

    const summary = await buildPediatricSummary(store, "24h", nowIso);

    expect(summary.structured.medicines[0]).toContain("新记录");
    expect(summary.structured.medicines[0]).not.toContain("旧记录");
  });

  test("timeline and pediatric summary avoid unbounded active event scans", async () => {
    const base = createMemoryStore(afterBirthProfile());
    const events = new EventService(base);
    await events.create({ event_type: "diaper_pee", occurred_at: "2026-04-26T00:00:00Z" }, "mom", nowIso);
    const guarded = {
      ...base,
      listEvents: async (options: Parameters<typeof base.listEvents>[0]) => {
        if (!options.days && !options.limit && !options.since) throw new Error("unbounded event scan");
        return base.listEvents(options);
      }
    };

    await expect(buildStatusTimeline(guarded, nowIso, { days: 3, limit: 100 })).resolves.toBeDefined();
    await expect(buildPediatricSummary(guarded, "24h", nowIso)).resolves.toBeDefined();
  });

  test("data quality warns about long open sleep sessions", async () => {
    const store = createMemoryStore(afterBirthProfile());
    const events = new EventService(store);

    await events.create({ event_type: "sleep_session", occurred_at: "2026-04-25T12:00:00Z" }, "dad", "2026-04-25T12:00:00Z");

    const overview = await buildStatusOverview(store, "2026-04-26T04:00:00Z", 7);

    expect(overview.data_quality).toContainEqual(
      expect.objectContaining({
        code: "open_sleep_session_long",
        severity: "warning"
      })
    );
  });

  test("high temperature data quality wording is age aware", async () => {
    const underThreeMonths = createMemoryStore(afterBirthProfile());
    const older = createMemoryStore({
      profile: {
        child_name: "Baby",
        child_birth_date: "2025-12-01",
        due_date: null,
        phase: "newborn_or_baby",
        timezone: "Asia/Shanghai"
      }
    });
    const unknownBirthDate = createMemoryStore({
      profile: {
        child_name: "Baby",
        child_birth_date: null,
        due_date: null,
        phase: "pregnancy_prebirth",
        timezone: "Asia/Shanghai"
      }
    });

    await new EventService(underThreeMonths).create({ event_type: "temperature", occurred_at: "2026-04-26T01:00:00Z", amount_value: 38.1, amount_unit: "celsius" }, "mom", nowIso);
    await new EventService(older).create({ event_type: "temperature", occurred_at: "2026-04-26T01:00:00Z", amount_value: 38.1, amount_unit: "celsius" }, "mom", nowIso);
    await new EventService(unknownBirthDate).create({ event_type: "temperature", occurred_at: "2026-04-26T01:00:00Z", amount_value: 38.1, amount_unit: "celsius" }, "mom", nowIso);

    const underMessage = (await buildStatusOverview(underThreeMonths, nowIso, 7)).data_quality.find((flag) => flag.code === "temperature_recorded_high")?.message;
    const olderMessage = (await buildStatusOverview(older, nowIso, 7)).data_quality.find((flag) => flag.code === "temperature_recorded_high")?.message;
    const unknownMessage = (await buildStatusOverview(unknownBirthDate, nowIso, 7)).data_quality.find((flag) => flag.code === "temperature_recorded_high")?.message;

    expect(underMessage).toContain("联系儿科医生或医院");
    expect(olderMessage).toBe("记录到较高体温，请核对测量方式和值，并结合医生建议。");
    expect(unknownMessage).toBe("记录到较高体温，请核对测量方式和值，并结合医生建议。");
    expect([underMessage, olderMessage, unknownMessage].join("\n")).not.toMatch(/诊断为|患有|建议用药|应接种|不应接种/);
  });

  test("birth ready mode is profile-driven and does not appear before birth", async () => {
    const store = createMemoryStore({
      profile: {
        child_birth_date: null,
        due_date: "2026-05-20",
        phase: "pregnancy_prebirth",
        timezone: "Asia/Shanghai"
      }
    });

    const overview = await buildStatusOverview(store, "2026-04-26T04:00:00Z", 7);

    expect(overview.profile.birth_day_number).toBeNull();
    expect(overview.birth_ready).toBeNull();
    expect(overview.first_week).toBeNull();
  });

  test("birth ready mode shows birth day and checklist presence without auto-importing", async () => {
    const store = createMemoryStore(afterBirthProfile());

    const overview = await buildStatusOverview(store, nowIso, 7);

    expect(overview.profile.birth_day_number).toBe(6);
    expect(overview.birth_ready).toMatchObject({
      child_birth_date: "2026-04-21",
      birth_day_number: 6,
      checklist_templates: {
        birth_hospital: { template_code: "aap_birth_hospital_v1", imported: false, imported_item_count: 0 },
        first_week: { template_code: "aap_first_week_v1", imported: false, imported_item_count: 0 }
      }
    });
    expect((await store.listChecklistItems({ includeArchived: true }))).toHaveLength(0);
  });

  test("birth ready mode summarizes latest existing newborn records only", async () => {
    const store = createMemoryStore(afterBirthProfile());
    const events = new EventService(store);

    await events.create({ event_type: "feed_bottle", occurred_at: "2026-04-26T00:00:00Z", amount_value: 25, amount_unit: "ml" }, "dad", nowIso);
    await events.create({ event_type: "diaper_pee", occurred_at: "2026-04-26T01:00:00Z" }, "mom", nowIso);
    await events.create({ event_type: "temperature", occurred_at: "2026-04-26T02:00:00Z", amount_value: 37.1, amount_unit: "celsius", details_json: { method: "armpit" } }, "mom", nowIso);
    await events.create({ event_type: "growth_measurement", occurred_at: "2026-04-26T03:00:00Z", amount_value: 3.2, details_json: { measure_type: "weight_kg" } }, "dad", nowIso);

    const overview = await buildStatusOverview(store, nowIso, 7);

    expect(overview.birth_ready?.latest_feeding).toMatchObject({ event_type: "feed_bottle", amount_value: 25 });
    expect(overview.birth_ready?.latest_diaper).toMatchObject({ event_type: "diaper_pee" });
    expect(overview.birth_ready?.latest_temperature_c).toBe(37.1);
    expect(overview.birth_ready?.latest_temperature).toEqual({ value_c: 37.1, occurred_at: "2026-04-26T02:00:00Z", method: "armpit" });
    expect(overview.birth_ready?.latest_weight_g).toBe(3200);
    expect(JSON.stringify(overview.birth_ready)).not.toMatch(/诊断|治疗|应接种|不应接种/);
  });

  test("first-week pack appears only on birth day 1 to 7", async () => {
    const active = createMemoryStore(afterBirthProfile());
    const later = createMemoryStore({
      profile: {
        child_name: "Baby",
        child_birth_date: "2026-04-10",
        due_date: null,
        phase: "newborn_or_baby",
        timezone: "Asia/Shanghai"
      }
    });

    expect((await buildStatusOverview(active, nowIso, 7)).first_week).not.toBeNull();
    expect((await buildStatusOverview(later, nowIso, 7)).first_week).toBeNull();
  });

  test("first-week pack uses rolling 24h feeding diaper sleep temperature and weight summaries", async () => {
    const store = createMemoryStore(afterBirthProfile());
    const events = new EventService(store);

    await events.create({ event_type: "feed_breast", occurred_at: "2026-04-25T03:00:00Z", details_json: { duration_min: 9 } }, "mom", nowIso);
    await events.create({ event_type: "feed_breast", occurred_at: "2026-04-25T23:00:00Z", details_json: { duration_min: 11 } }, "mom", nowIso);
    await events.create({ event_type: "feed_bottle", occurred_at: "2026-04-26T01:00:00Z", amount_value: 35, amount_unit: "ml" }, "dad", nowIso);
    await events.create({ event_type: "diaper_pee", occurred_at: "2026-04-25T23:30:00Z" }, "mom", nowIso);
    await events.create({ event_type: "diaper_poop", occurred_at: "2026-04-26T00:30:00Z" }, "dad", nowIso);
    await events.create({ event_type: "sleep_session", occurred_at: "2026-04-26T01:00:00Z", ended_at: "2026-04-26T03:00:00Z" }, "dad", nowIso);
    await events.create({ event_type: "temperature", occurred_at: "2026-04-26T02:30:00Z", amount_value: 37.4, amount_unit: "celsius" }, "mom", nowIso);
    await events.create({ event_type: "growth_measurement", occurred_at: "2026-04-26T03:30:00Z", amount_value: 3.35, details_json: { measure_type: "weight_kg" } }, "dad", nowIso);

    const overview = await buildStatusOverview(store, nowIso, 7);

    expect(overview.first_week?.summary_24h.feeding).toMatchObject({
      breast_count: 1,
      breast_minutes_total: 11,
      bottle_count: 1,
      bottle_ml_total: 35,
      total_count: 2
    });
    expect(overview.first_week?.summary_24h.diaper).toMatchObject({ pee_count: 1, poop_count: 1 });
    expect(overview.first_week?.summary_24h.sleep).toMatchObject({ minutes_total: 120, longest_minutes: 120 });
    expect(overview.first_week?.summary_24h.temperature.latest_c).toBe(37.4);
    expect(overview.first_week?.summary_24h.growth.latest_weight_g).toBe(3350);
  });

  test("first-week data quality warns about open sleep and tummy time without diagnosis", async () => {
    const store = createMemoryStore(afterBirthProfile());
    const events = new EventService(store);

    await events.create({ event_type: "sleep_session", occurred_at: "2026-04-25T12:00:00Z" }, "dad", "2026-04-25T12:00:00Z");
    await events.create({ event_type: "tummy_time", occurred_at: "2026-04-26T02:30:00Z" }, "dad", "2026-04-26T02:30:00Z");

    const overview = await buildStatusOverview(store, "2026-04-26T04:00:00Z", 7);
    const codes = overview.data_quality.map((flag) => flag.code);

    expect(codes).toEqual(expect.arrayContaining(["open_sleep_session_long", "open_tummy_time_session_long"]));
    expect(JSON.stringify(overview.data_quality)).not.toMatch(/诊断为|患有|建议用药|应接种|不应接种/);
  });

  test("timeline groups events by local date with daily summaries", async () => {
    const store = createMemoryStore(afterBirthProfile());
    const events = new EventService(store);

    await events.create({ event_type: "diaper_pee", occurred_at: "2026-04-25T15:30:00Z" }, "mom", nowIso);
    await events.create({ event_type: "feed_bottle", occurred_at: "2026-04-26T01:00:00Z", amount_value: 80, amount_unit: "ml" }, "dad", nowIso);

    const timeline = await buildStatusTimeline(store, nowIso, { days: 3, limit: 100 });

    expect(timeline.groups.map((group) => group.local_date)).toEqual(expect.arrayContaining(["2026-04-25", "2026-04-26"]));
    expect(timeline.groups.find((group) => group.local_date === "2026-04-26")?.summary.feeding.bottle_ml_total).toBe(80);
    expect(timeline.groups.flatMap((group) => group.events).map((event) => event.event_type)).toEqual(expect.arrayContaining(["diaper_pee", "feed_bottle"]));
  });

  test("timeline applies a single event-type filter before limiting range events", async () => {
    const store = createMemoryStore(afterBirthProfile());
    const events = new EventService(store);

    const growth = await events.create(
      { event_type: "growth_measurement", occurred_at: "2026-05-07T10:42:00Z", amount_value: 50, details_json: { measure_type: "length_cm" } },
      "dad",
      "2026-05-18T23:43:00Z"
    );
    for (let index = 0; index < 12; index += 1) {
      await events.create({ event_type: "diaper_pee", occurred_at: `2026-05-18T${String(index).padStart(2, "0")}:00:00Z` }, "mom", "2026-05-18T12:30:00Z");
    }

    const timeline = await buildStatusTimeline(store, "2026-05-19T04:00:00Z", {
      preset: "last_30d",
      event_types: ["growth_measurement"],
      limit: 10
    });

    expect(timeline.groups.flatMap((group) => group.events).map((event) => event.id)).toContain(growth.id);
  });

  test("machine v1 schema is unchanged", async () => {
    const store = createMemoryStore({
      profile: {
        ...afterBirthProfile().profile,
        machine_token: "machine-secret"
      }
    });

    const payload = await buildMachinePayload(store, "machine-secret", nowIso);

    expect(payload.schema_version).toBe("1");
    expect(payload).not.toHaveProperty("status_overview");
    expect(payload).not.toHaveProperty("pediatric_summary");
  });
});

function afterBirthProfile() {
  return {
    profile: {
      child_name: "Baby",
      child_birth_date: "2026-04-21",
      due_date: null,
      phase: "newborn_or_baby" as const,
      timezone: "Asia/Shanghai"
    }
  };
}

import { describe, expect, test } from "vitest";
import { createMemoryStore } from "../../src/server/testing/memory-store";
import { EventService } from "../../src/server/services/event-service";
import { buildLast7DaysSummary, buildSummaryForDate, buildTodaySummary } from "../../src/server/services/summary-service";

describe("events and today summary", () => {
  test("create event stores UTC timestamps and server-computed local_date", async () => {
    const store = createMemoryStore();
    const events = new EventService(store);

    const created = await events.create(
      {
        event_type: "diaper_pee",
        occurred_at: "2026-04-23T16:30:00Z"
      },
      "dad",
      "2026-04-24T00:00:00Z"
    );

    expect(created.occurred_at).toBe("2026-04-23T16:30:00Z");
    expect(created.local_date).toBe("2026-04-24");
  });

  test("sleep quick action closes the existing open sleep session", async () => {
    const store = createMemoryStore();
    const events = new EventService(store);

    const opened = await events.create(
      {
        event_type: "sleep_session",
        occurred_at: "2026-04-24T00:00:00Z"
      },
      "mom",
      "2026-04-24T00:00:00Z"
    );
    const closed = await events.create(
      {
        event_type: "sleep_session",
        occurred_at: "2026-04-24T01:30:00Z"
      },
      "mom",
      "2026-04-24T01:30:00Z"
    );

    expect(closed.id).toBe(opened.id);
    expect(closed.ended_at).toBe("2026-04-24T01:30:00Z");
    expect(await store.listOpenSleepSessions()).toHaveLength(0);
    expect(await store.listEvents({ since: "2026-04-24T00:00:00Z" })).toHaveLength(1);
  });

  test("today summary is derived from events and ignores soft-deleted records", async () => {
    const store = createMemoryStore();
    const events = new EventService(store);

    await events.create({ event_type: "feed_breast", occurred_at: "2026-04-24T00:10:00Z" }, "dad", "2026-04-24T00:10:00Z");
    await events.create({ event_type: "feed_bottle", occurred_at: "2026-04-24T01:00:00Z", amount_value: 90, amount_unit: "ml", details_json: { milk_type: "formula" } }, "mom", "2026-04-24T01:00:00Z");
    await events.create({ event_type: "feed_bottle", occurred_at: "2026-04-24T01:30:00Z", amount_value: 40, amount_unit: "ml", details_json: { milk_type: "breastmilk" } }, "mom", "2026-04-24T01:30:00Z");
    await events.create({ event_type: "diaper_pee", occurred_at: "2026-04-24T02:00:00Z" }, "mom", "2026-04-24T02:00:00Z");
    const poop = await events.create({ event_type: "diaper_poop", occurred_at: "2026-04-24T03:00:00Z" }, "dad", "2026-04-24T03:00:00Z");
    await events.delete(poop.id, "2026-04-24T03:10:00Z");
    await events.create(
      { event_type: "temperature", occurred_at: "2026-04-24T04:00:00Z", amount_value: 38.2, amount_unit: "celsius", details_json: { method: "armpit" } },
      "mom",
      "2026-04-24T04:00:00Z"
    );
    await events.create({ event_type: "sleep_session", occurred_at: "2026-04-24T05:00:00Z", ended_at: "2026-04-24T06:00:00Z" }, "dad", "2026-04-24T06:00:00Z");

    const summary = await buildTodaySummary(store, "2026-04-24T08:00:00Z");

    expect(summary).toMatchObject({
      date: "2026-04-24",
      feed_breast_count: 1,
      feed_bottle_count: 2,
      bottle_ml_total: 130,
      bottle_formula_ml_total: 90,
      bottle_breastmilk_ml_total: 40,
      pee_count: 1,
      poop_count: 0,
      sleep_session_count: 1,
      sleep_minutes_total: 60,
      latest_temperature_c: 38.2,
      latest_temperature: {
        value_c: 38.2,
        occurred_at: "2026-04-24T04:00:00Z",
        method: "armpit"
      }
    });
    expect(summary.system_flags).toContain("temperature_high_neutral_notice");
  });

  test("today summary includes latest growth measurement values", async () => {
    const store = createMemoryStore();
    const events = new EventService(store);

    await events.create({ event_type: "growth_measurement", occurred_at: "2026-04-24T01:00:00Z", amount_value: 3.45, details_json: { measure_type: "weight_kg" } }, "dad", "2026-04-24T01:00:00Z");
    await events.create({ event_type: "growth_measurement", occurred_at: "2026-04-24T02:00:00Z", amount_value: 50.2, details_json: { measure_type: "length_cm" } }, "dad", "2026-04-24T02:00:00Z");

    const summary = await buildTodaySummary(store, "2026-04-24T08:00:00Z");

    expect(summary.growth.latest_weight_g).toBe(3450);
    expect(summary.growth.latest_length_cm).toBe(50.2);
    expect(summary.growth.latest_measure_type).toBe("length_cm");
    expect(summary.growth.latest_value).toBe(50.2);
    expect(summary.growth.latest_at).toBe("2026-04-24T02:00:00Z");
  });

  test("today summary shows the latest temperature and growth values across days", async () => {
    const store = createMemoryStore();
    const events = new EventService(store);

    await events.create(
      { event_type: "temperature", occurred_at: "2026-04-23T04:00:00Z", amount_value: 36.7, amount_unit: "celsius", details_json: { method: "armpit" } },
      "dad",
      "2026-04-23T04:00:00Z"
    );
    await events.create(
      { event_type: "growth_measurement", occurred_at: "2026-04-23T05:00:00Z", amount_value: 3.335, details_json: { measure_type: "weight_kg" } },
      "dad",
      "2026-04-23T05:00:00Z"
    );
    await events.create({ event_type: "diaper_pee", occurred_at: "2026-04-24T01:00:00Z" }, "mom", "2026-04-24T01:00:00Z");

    const summary = await buildTodaySummary(store, "2026-04-24T08:00:00Z");

    expect(summary.date).toBe("2026-04-24");
    expect(summary.pee_count).toBe(1);
    expect(summary.latest_temperature).toEqual({ value_c: 36.7, occurred_at: "2026-04-23T04:00:00Z", method: "armpit" });
    expect(summary.growth.latest_weight_g).toBe(3335);
    expect(summary.growth.latest_measure_type).toBe("weight_kg");
    expect(summary.growth.latest_at).toBe("2026-04-23T05:00:00Z");
  });

  test("today summary only exposes timed breast records as open sessions", async () => {
    const quickStore = createMemoryStore();
    const quickEvents = new EventService(quickStore);
    await quickEvents.create(
      { event_type: "feed_breast", occurred_at: "2026-04-24T00:10:00Z", details_json: { session_mode: "count_only" } },
      "mom",
      "2026-04-24T00:10:00Z"
    );

    const quickSummary = await buildTodaySummary(quickStore, "2026-04-24T01:30:00Z");
    expect(quickSummary.feed_breast_count).toBe(1);
    expect(quickSummary.open_sessions?.filter((event) => event.event_type === "feed_breast")).toHaveLength(0);

    const durationStore = createMemoryStore();
    const durationEvents = new EventService(durationStore);
    await durationEvents.create(
      { event_type: "feed_breast", occurred_at: "2026-04-24T00:10:00Z", details_json: { session_mode: "timed", duration_min: 15 } },
      "mom",
      "2026-04-24T00:10:00Z"
    );

    const durationSummary = await buildTodaySummary(durationStore, "2026-04-24T01:30:00Z");
    expect(durationSummary.feed_breast_count).toBe(1);
    expect(durationSummary.open_sessions?.filter((event) => event.event_type === "feed_breast")).toHaveLength(0);

    const timedStore = createMemoryStore();
    const timedEvents = new EventService(timedStore);
    await timedEvents.create(
      { event_type: "feed_breast", occurred_at: "2026-04-24T00:10:00Z", details_json: { session_mode: "timed" } },
      "mom",
      "2026-04-24T00:10:00Z"
    );

    const timedSummary = await buildTodaySummary(timedStore, "2026-04-24T01:30:00Z");
    expect(timedSummary.open_sessions?.filter((event) => event.event_type === "feed_breast")).toHaveLength(1);
  });

  test("sleep duration is split across family local dates", async () => {
    const store = createMemoryStore();
    const events = new EventService(store);

    await events.create(
      {
        event_type: "sleep_session",
        occurred_at: "2026-04-25T15:00:00Z",
        ended_at: "2026-04-25T17:00:00Z"
      },
      "dad",
      "2026-04-25T17:00:00Z"
    );

    await expect(buildSummaryForDate(store, "2026-04-25", "2026-04-25T17:00:00Z")).resolves.toMatchObject({
      sleep_minutes_total: 60
    });
    await expect(buildSummaryForDate(store, "2026-04-26", "2026-04-25T17:00:00Z")).resolves.toMatchObject({
      sleep_minutes_total: 60
    });
  });

  test("sleep summary uses overlapping range query instead of scanning all sleep events", async () => {
    const baseStore = createMemoryStore();
    const events = new EventService(baseStore);
    await events.create(
      {
        event_type: "sleep_session",
        occurred_at: "2026-04-25T15:00:00Z",
        ended_at: "2026-04-25T17:00:00Z"
      },
      "dad",
      "2026-04-25T17:00:00Z"
    );

    const rangedStore = {
      ...baseStore,
      async listEvents(options: Parameters<typeof baseStore.listEvents>[0]) {
        if (options.event_type === "sleep_session") throw new Error("summary should use range query for sleep");
        return baseStore.listEvents(options);
      },
      async listSleepEventsOverlappingRange() {
        return baseStore.listEvents({ event_type: "sleep_session" });
      }
    };

    await expect(buildSummaryForDate(rangedStore, "2026-04-26", "2026-04-25T17:00:00Z")).resolves.toMatchObject({
      sleep_minutes_total: 60
    });
  });

  test("last 7 days summary does not repeat global open sessions", async () => {
    const store = createMemoryStore();
    const events = new EventService(store);
    await events.create(
      {
        event_type: "sleep_session",
        occurred_at: "2026-04-25T15:00:00Z"
      },
      "dad",
      "2026-04-25T15:00:00Z"
    );

    const summaries = await buildLast7DaysSummary(store, "2026-04-25T17:00:00Z");

    expect(summaries).toHaveLength(7);
    expect(summaries.every((summary) => !("open_sessions" in summary))).toBe(true);
  });
});

import { describe, expect, test } from "vitest";
import { EventService } from "../../src/server/services/event-service";
import { buildReadOnlySummaryPayload } from "../../src/server/services/read-summary-service";
import { updateStableChildFacts } from "../../src/server/services/stable-child-facts-service";
import { createMemoryStore } from "../../src/server/testing/memory-store";

describe("read-only summary payload", () => {
  test("adds elder-care fields without exposing raw event internals", async () => {
    const store = createMemoryStore({
      profile: {
        child_name: "Demo Baby",
        child_birth_date: "2026-01-10",
        phase: "newborn_or_baby",
        read_only_title: "Baby近况"
      }
    });
    const events = new EventService(store);
    const nowIso = "2026-04-24T08:00:00Z";

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
    await events.create(
      { event_type: "feed_bottle", occurred_at: "2026-04-24T01:00:00Z", amount_value: 70, amount_unit: "ml", note: "喝得平稳" },
      "mom",
      "2026-04-24T01:00:00Z"
    );
    await events.create(
      { event_type: "diaper_pee", occurred_at: "2026-04-24T02:00:00Z", details_json: { private_admin_note: "不要给只读页", color: "light" } },
      "dad",
      "2026-04-24T02:00:00Z"
    );
    await events.create({ event_type: "sleep_session", occurred_at: "2026-04-23T19:00:00Z" }, "mom", "2026-04-23T19:00:00Z");

    const payload = await buildReadOnlySummaryPayload(store, nowIso);

    expect(payload.generated_at).toBe(nowIso);
    expect(payload.stable_child_facts).toMatchObject({
      sex: "female",
      birth_date: "2026-01-10",
      birth_weight_g: 3200,
      birth_length_cm: 50
    });
    expect(payload.growth_curve.available).toBe(true);
    expect(payload.growth_curve.items.find((item) => item.measure_type === "weight_kg")).toMatchObject({
      latest_measurement: {
        value: 3200,
        source: "birth_fact"
      },
      reference: {
        age_days: 0,
        p2: 2374,
        p50: 3232,
        p98: 4260
      }
    });
    expect(payload.reference_targets.items).toEqual(expect.any(Array));
    expect(payload.last_7_days_summary).toHaveLength(7);
    expect(payload.today_events.map((event) => event.event_type)).toEqual(["diaper_pee", "feed_bottle", "sleep_session"]);
    expect(payload.active_state.open_sleep_session?.event_type).toBe("sleep_session");
    expect(payload.data_quality.map((flag) => flag.code)).toContain("open_sleep_session_long");
    const sleepEvent = payload.recent_events.find((event) => event.event_type === "sleep_session");
    expect(sleepEvent).toMatchObject({
      event_type: "sleep_session",
      occurred_at: "2026-04-23T19:00:00Z",
      local_date: "2026-04-24"
    });
    expect(payload.recent_events[0]).not.toHaveProperty("id");
    expect(payload.recent_events[0]).not.toHaveProperty("source");
    expect(payload.recent_events[0]).not.toHaveProperty("created_by");
    expect(payload.recent_events[0]).not.toHaveProperty("created_at");
    expect(payload.today_events[0]).not.toHaveProperty("source");
    expect(payload.today_events[0]).not.toHaveProperty("created_by");
    expect(payload.today_events[0]).not.toHaveProperty("created_at");
    expect(JSON.stringify(payload.recent_events)).not.toContain("private_admin_note");
    expect(JSON.stringify(payload.today_events)).not.toContain("private_admin_note");
  });
});

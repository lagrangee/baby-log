import { describe, expect, test } from "vitest";
import { createReadQuickEvent } from "../../src/server/services/read-event-service";
import { createMemoryStore } from "../../src/server/testing/memory-store";

describe("read quick event service", () => {
  test("creates only the elder quick-record event shapes", async () => {
    const store = createMemoryStore({ profile: { phase: "newborn_or_baby" } });
    const nowIso = "2026-05-15T08:00:00Z";

    const bottle = await createReadQuickEvent(store, { action: "feed_bottle", occurred_at: "2026-05-15T07:50:00Z", amount_value: 80, milk_type: "formula" }, nowIso);
    const pee = await createReadQuickEvent(store, { action: "diaper_pee", occurred_at: "2026-05-15T07:55:00Z", note: "ignored" }, nowIso);
    const temperature = await createReadQuickEvent(
      store,
      { action: "temperature", occurred_at: "2026-05-15T08:00:00Z", amount_value: 36.8, details_json: { method: "ear" } },
      nowIso
    );

    expect(bottle).toMatchObject({ event_type: "feed_bottle", amount_value: 80, amount_unit: "ml", details_json: { milk_type: "formula" }, created_by: "system" });
    expect(pee).toMatchObject({ event_type: "diaper_pee", note: null, created_by: "system" });
    expect(temperature).toMatchObject({
      event_type: "temperature",
      amount_value: 36.8,
      amount_unit: "celsius",
      details_json: { method: "forehead" },
      created_by: "system"
    });
  });

  test("rejects unsupported actions and invalid amounts", async () => {
    const store = createMemoryStore();
    const nowIso = "2026-05-15T08:00:00Z";

    await expect(createReadQuickEvent(store, { action: "medicine", occurred_at: "2026-05-15T08:00:00Z" }, nowIso)).rejects.toThrow("Unsupported read action");
    await expect(createReadQuickEvent(store, { action: "feed_bottle", occurred_at: "2026-05-15T08:00:00Z", amount_value: 0 }, nowIso)).rejects.toThrow(
      "amount_value must be greater than 0"
    );
    await expect(createReadQuickEvent(store, { action: "feed_bottle", occurred_at: "2026-05-15T08:00:00Z", amount_value: 80, milk_type: "mixed" }, nowIso)).rejects.toThrow(
      "milk_type must be formula or breastmilk"
    );
  });

  test("starts and ends sleep sessions without exposing edit behavior", async () => {
    const store = createMemoryStore({ profile: { phase: "newborn_or_baby" } });
    const nowIso = "2026-05-15T08:00:00Z";

    const started = await createReadQuickEvent(store, { action: "sleep_start", occurred_at: "2026-05-15T07:00:00Z" }, nowIso);
    const ended = await createReadQuickEvent(store, { action: "sleep_end", occurred_at: "2026-05-15T08:00:00Z" }, nowIso);

    expect(started).toMatchObject({ event_type: "sleep_session", occurred_at: "2026-05-15T07:00:00Z" });
    expect(ended).toMatchObject({ id: started.id, ended_at: "2026-05-15T08:00:00Z" });
    expect(await store.listOpenSleepSessions()).toHaveLength(0);
    await expect(createReadQuickEvent(store, { action: "sleep_end", occurred_at: "2026-05-15T08:10:00Z" }, nowIso)).rejects.toThrow("No open sleep session");
  });
});

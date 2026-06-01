import { describe, expect, test } from "vitest";
import {
  buildSourcePackFiles,
  formatDailyBrief,
  formatEventsDocument,
  isoWeekKey,
  parseEnvFile,
  weeklyRanges
} from "../../scripts/chatgpt-source-pack.mjs";

const current = {
  generated_at: "2026-02-01T19:00:00Z",
  timezone: "Asia/Shanghai",
  profile: {
    child_name: "Demo Baby",
    child_birth_date: "2026-01-10",
    due_date: "2026-01-20",
    phase: "newborn_or_baby"
  },
  stable_child_facts: {
    nickname: "Baby",
    sex: "female",
    birth_weight_g: 3200,
    birth_length_cm: 50,
    gestational_age_label: "39+0",
    current_feeding_mode: "mixed_feeding"
  },
  data_range: {
    first_event_at: "2026-01-10T10:42:00Z",
    latest_event_at: "2026-02-01T18:30:00Z",
    event_count: 42,
    available_from_local_date: "2026-01-10",
    available_to_local_date: "2026-02-01"
  },
  latest_global: {
    feeding: { occurred_at: "2026-02-01T17:00:00Z" },
    pee: { occurred_at: "2026-02-01T18:00:00Z" },
    poop: { occurred_at: "2026-01-31T21:00:00Z" },
    temperature: { value_c: 36.7, occurred_at: "2026-01-30T01:00:00Z" },
    weight: { value: 3900, unit: "g", occurred_at: "2026-01-31T02:00:00Z" }
  },
  open_sessions: [],
  data_quality: []
};

const daysPayload = {
  generated_at: "2026-02-01T19:00:00Z",
  timezone: "Asia/Shanghai",
  range: { from: "2026-01-26", to: "2026-02-01", day_count: 7 },
  days: [
    day("2026-01-26", 8, 480, 7, 4, 620, 36.7, 3600),
    day("2026-01-27", 9, 520, 8, 3, 650, null, 3650),
    day("2026-02-01", 7, 500, 6, 2, 610, 36.8, 3900)
  ]
};

const recentEventsPayload = {
  generated_at: "2026-02-01T19:00:00Z",
  timezone: "Asia/Shanghai",
  range: { since: "2026-01-26T00:00:00Z", until: "2026-02-02T00:00:00Z" },
  events: [
    event("evt-3", "feed_bottle", "2026-02-01T16:00:00Z", "2026-02-02", 70, "ml", { milk_kind: "formula" }),
    event("evt-2", "diaper_poop", "2026-01-31T20:00:00Z", "2026-02-01", null, null, { color: "yellow" }),
    event("evt-1", "sleep_session", "2026-01-31T13:00:00Z", "2026-01-31", null, null, { quality: "ok" }, "2026-01-31T15:30:00Z")
  ],
  pagination: { has_more: false }
};

describe("ChatGPT source pack", () => {
  test("builds only Markdown/TXT source files with stable names and weekly archive rotation", () => {
    const files = buildSourcePackFiles({
      current,
      daysPayload,
      recentEventsPayload,
      weeklyEventPayloads: [
        {
          weekKey: "2026-W05",
          from: "2026-01-26",
          to: "2026-02-01",
          payload: { ...recentEventsPayload, events: recentEventsPayload.events.slice(1) }
        }
      ]
    });

    expect(files.map((file) => file.path).sort()).toEqual([
      "README.md",
      "baby_log_7days_events.md",
      "baby_log_daily_brief.md",
      "baby_log_data_dictionary.md",
      "events_archive/events_2026-W05.md",
      "sync_status.txt"
    ]);
    expect(files.every((file) => file.path.endsWith(".md") || file.path.endsWith(".txt"))).toBe(true);
    expect(files.some((file) => file.path.endsWith(".json") || file.path.endsWith(".zip"))).toBe(false);
    const readme = files.find((file) => file.path === "README.md")?.content ?? "";
    expect(readme).toContain("Do not infer from files that are not included in this source pack.");
    expect(readme).toContain("## Recommended Entry Points");
    expect(readme).toContain("- Trend analysis: `baby_log_daily_brief.md`");
    expect(readme).toContain("- Recent events: `baby_log_7days_events.md`");
    expect(readme).toContain("- Field explanations: `baby_log_data_dictionary.md`");
    expect(readme).toContain("- Sync status: `sync_status.txt`");
  });

  test("daily brief is one fixed-format row per day with newest date first", () => {
    const markdown = formatDailyBrief({ current, daysPayload });

    expect(markdown).toContain("| local_date | age_days | feed_count | bottle_ml | pee | poop | sleep_min | max_temp_c | latest_weight_g | notes |");
    expect(markdown.indexOf("| 2026-02-01 |")).toBeLessThan(markdown.indexOf("| 2026-01-27 |"));
    expect(markdown).toContain("| 2026-02-01 | 22 | 7 | 500 | 6 | 2 | 610 | 36.8 | 3900 |  |");
    expect(markdown).not.toContain("latest feeding");
  });

  test("event documents group complete events by local date and avoid unbounded logs", () => {
    const markdown = formatEventsDocument({
      title: "Complete events from the last 7 days",
      generatedAt: "2026-02-01T19:00:00Z",
      timezone: "Asia/Shanghai",
      rangeLabel: "2026-01-26 to 2026-02-01",
      events: recentEventsPayload.events,
      includeReadHint: true
    });

    expect(markdown).toContain("# Complete events from the last 7 days");
    expect(markdown).toContain("Read this recent window by default");
    expect(markdown).toContain("## 2026-02-02");
    expect(markdown).toContain("- 00:00 feed_bottle 70 ml");
    expect(markdown).toContain("milk_kind=formula");
    expect(markdown).toContain("## 2026-01-31");
    expect(markdown).toContain("ended_at=2026-01-31T15:30:00Z");
  });

  test("weekly ranges use ISO week keys for archive filenames", () => {
    expect(isoWeekKey("2026-01-01")).toBe("2026-W01");
    expect(isoWeekKey("2026-12-31")).toBe("2026-W53");

    expect(weeklyRanges("2026-05-07", "2026-05-19")).toEqual([
      { weekKey: "2026-W19", from: "2026-05-07", to: "2026-05-10" },
      { weekKey: "2026-W20", from: "2026-05-11", to: "2026-05-17" },
      { weekKey: "2026-W21", from: "2026-05-18", to: "2026-05-19" }
    ]);
  });

  test("parses ignored local env files without requiring token in the automation prompt", () => {
    expect(parseEnvFile("BABY_LOG_MACHINE_TOKEN=secret-token\n# comment\nOTHER=value\n")).toEqual({
      BABY_LOG_MACHINE_TOKEN: "secret-token",
      OTHER: "value"
    });
    expect(parseEnvFile('BABY_LOG_MACHINE_TOKEN="quoted-token"\n')).toEqual({
      BABY_LOG_MACHINE_TOKEN: "quoted-token"
    });
  });
});

function day(localDate, feedCount, bottleMl, pee, poop, sleepMin, maxTemp, weightG) {
  return {
    local_date: localDate,
    age_days: daysBetween("2026-01-10", localDate),
    feeding: {
      total_count: feedCount,
      bottle_ml_total: bottleMl
    },
    diaper: {
      pee_count: pee,
      poop_count: poop
    },
    sleep: {
      minutes_total: sleepMin
    },
    temperature: {
      max_c: maxTemp
    },
    growth: {
      latest_weight_g: weightG
    }
  };
}

function event(id, eventType, occurredAt, localDate, amountValue, amountUnit, details, endedAt = null) {
  return {
    id,
    category: eventType.split("_")[0],
    event_type: eventType,
    occurred_at: occurredAt,
    ended_at: endedAt,
    local_date: localDate,
    amount_value: amountValue,
    amount_unit: amountUnit,
    note: null,
    details_json: details,
    source: "manual",
    created_by: "dad",
    created_at: occurredAt,
    updated_at: occurredAt
  };
}

function daysBetween(fromDate, toDate) {
  return Math.round((Date.parse(`${toDate}T00:00:00Z`) - Date.parse(`${fromDate}T00:00:00Z`)) / 86_400_000);
}

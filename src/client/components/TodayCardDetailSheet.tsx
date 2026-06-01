import { Sheet } from "./Sheet";
import { localizedText, useI18n } from "../i18n";
import type { DisplayEventRecord, EventType, TodaySummary } from "../types";
import { eventLabel, formatEventValue, formatNumber, formatTemperature, temperatureMethodLabel } from "../utils/format";
import { formatDuration, formatRelativeTime, formatTime } from "../utils/time";
import type { TodaySummaryCardSlot } from "./TodaySummaryCards";

export interface TodayCardDetailData<TEvent extends DisplayEventRecord = DisplayEventRecord> {
  summary: TodaySummary;
  events: TEvent[];
}

interface TodayCardDetailSheetProps<TEvent extends DisplayEventRecord> {
  slot: TodaySummaryCardSlot;
  day: TodayCardDetailData<TEvent> | null;
  timezone: string;
  loading?: boolean;
  error?: string;
  editable?: boolean;
  onClose: () => void;
  onRetry?: () => void;
  onEdit?: (event: TEvent) => void;
}

export function TodayCardDetailSheet<TEvent extends DisplayEventRecord>({
  slot,
  day,
  timezone,
  loading = false,
  error = "",
  editable = false,
  onClose,
  onRetry,
  onEdit
}: TodayCardDetailSheetProps<TEvent>) {
  const { text: tx } = useI18n();
  const events = day ? eventsForCard(slot, day.events) : [];
  const lines = day ? cardDetailLines(slot, day.summary, timezone, events) : [];
  return (
    <Sheet title={tx({ en: "{title} details", zh: "{title}明细" }, { title: cardTitle(slot) })} onClose={onClose}>
      {loading ? <p className="empty">{tx({ en: "Loading...", zh: "正在加载..." })}</p> : null}
      {error ? (
        <div className="stack">
          <p className="error-text">{error}</p>
          {onRetry ? (
            <button className="secondary" type="button" onClick={onRetry}>
              {tx({ en: "Retry", zh: "重试" })}
            </button>
          ) : null}
        </div>
      ) : null}
      {!loading && !error && day ? (
        <div className="stack">
          <div className="detail-metrics">
            {lines.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
          <div className="section-head">
            <h3>{tx({ en: "Day records", zh: "当日记录" })}</h3>
            <span>{tx({ en: "{count} records", zh: "{count} 条" }, { count: events.length })}</span>
          </div>
          {events.length ? (
            <div className="event-list">
              {events.map((event, index) => (
                <article key={event.id ?? `${event.event_type}-${event.occurred_at}-${index}`} className="event-row">
                  <div>
                    <strong>{eventLabel(event.event_type)}</strong>
                    <p>
                      {formatTime(event.occurred_at, timezone)}
                      <span>{formatEventValue(event)}</span>
                    </p>
                    {event.note && event.event_type !== "note" ? <small>{event.note}</small> : null}
                  </div>
                  {editable && onEdit ? (
                    <div className="row-actions compact">
                      <button className="secondary small" type="button" onClick={() => onEdit(event)}>
                        {tx({ en: "Edit", zh: "编辑" })}
                      </button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <p className="empty">{tx({ en: "No records of this type today.", zh: "今天还没有这类记录。" })}</p>
          )}
        </div>
      ) : null}
    </Sheet>
  );
}

const cardEventTypes: Record<TodaySummaryCardSlot, EventType[]> = {
  feeding: ["feed_breast", "feed_bottle"],
  breast: ["feed_breast"],
  pee: ["diaper_pee"],
  poop: ["diaper_poop"],
  sleep: ["sleep_session"],
  temperature: ["temperature"],
  bottle: ["feed_bottle"],
  growth: ["growth_measurement"]
};

function eventsForCard<TEvent extends DisplayEventRecord>(slot: TodaySummaryCardSlot, events: TEvent[]): TEvent[] {
  const allowed = cardEventTypes[slot];
  return events
    .filter((event) => allowed.includes(event.event_type))
    .sort((left, right) => (right.ended_at ?? right.occurred_at).localeCompare(left.ended_at ?? left.occurred_at));
}

function cardDetailLines(slot: TodaySummaryCardSlot, summary: TodaySummary, timezone: string, events: DisplayEventRecord[]): string[] {
  const last = (iso: string | null) => localizedText({ en: "Last {time}", zh: "上次 {time}" }, { time: formatRelativeTime(iso ?? latestEventIso(events), timezone) });
  if (slot === "feeding") {
    return [
      localizedText({ en: "Today {count} times", zh: "今日 {count} 次" }, { count: summary.feed_breast_count + summary.feed_bottle_count }),
      localizedText(
        { en: "Breast {breast} times · Bottle {bottle} times", zh: "母乳 {breast} 次 · 奶瓶 {bottle} 次" },
        { breast: summary.feed_breast_count, bottle: summary.feed_bottle_count }
      ),
      last(summary.latest_feeding_at)
    ];
  }
  if (slot === "breast") {
    return [
      localizedText({ en: "Total {duration}", zh: "总时长 {duration}" }, { duration: formatDuration(summary.breast_minutes_total) }),
      localizedText(
        { en: "Left {left} · Right {right}", zh: "左 {left} · 右 {right}" },
        { left: formatDuration(summary.breast_left_minutes_total), right: formatDuration(summary.breast_right_minutes_total) }
      ),
      last(summary.latest_breast_at)
    ];
  }
  if (slot === "pee") return [localizedText({ en: "Today {count} times", zh: "今日 {count} 次" }, { count: summary.pee_count }), last(summary.latest_pee_at)];
  if (slot === "poop") return [localizedText({ en: "Today {count} times", zh: "今日 {count} 次" }, { count: summary.poop_count }), last(summary.latest_poop_at)];
  if (slot === "sleep") {
    return [
      localizedText({ en: "Total {duration}", zh: "总时长 {duration}" }, { duration: formatDuration(summary.sleep_minutes_total) }),
      localizedText({ en: "Today {count} sessions", zh: "今日 {count} 段" }, { count: summary.sleep_session_count }),
      last(latestEventIso(events))
    ];
  }
  if (slot === "temperature") {
    const latest = summary.latest_temperature;
    const method = latest ? temperatureMethodLabel(latest.method) : localizedText({ en: "not set", zh: "未填" });
    return [
      localizedText({ en: "Today {count} times", zh: "今日 {count} 次" }, { count: events.length }),
      localizedText({ en: "Latest {value} · {method}", zh: "最新 {value} · {method}" }, { value: formatTemperature(summary.latest_temperature_c), method }),
      last(latest?.occurred_at ?? null)
    ];
  }
  if (slot === "growth") {
    return [
      summary.growth.latest_weight_g == null
        ? localizedText({ en: "Weight —", zh: "体重 —" })
        : localizedText({ en: "Weight {value} g", zh: "体重 {value} g" }, { value: summary.growth.latest_weight_g }),
      summary.growth.latest_length_cm == null
        ? localizedText({ en: "Length —", zh: "身长 —" })
        : localizedText({ en: "Length {value} cm", zh: "身长 {value} cm" }, { value: formatNumber(summary.growth.latest_length_cm) }),
      last(latestEventIso(events))
    ];
  }
  return [
    localizedText({ en: "Total {value} ml", zh: "总量 {value} ml" }, { value: formatNumber(summary.bottle_ml_total) }),
    localizedText({ en: "Today {count} times", zh: "今日 {count} 次" }, { count: summary.feed_bottle_count }),
    last(summary.latest_bottle_at)
  ];
}

function latestEventIso(events: DisplayEventRecord[]): string | null {
  return events[0]?.ended_at ?? events[0]?.occurred_at ?? null;
}

function cardTitle(slot: TodaySummaryCardSlot): string {
  if (slot === "feeding") return localizedText({ en: "Feeding", zh: "喂养" });
  if (slot === "breast") return localizedText({ en: "Breast", zh: "母乳" });
  if (slot === "pee") return localizedText({ en: "Pee", zh: "小便" });
  if (slot === "poop") return localizedText({ en: "Poop", zh: "大便" });
  if (slot === "sleep") return localizedText({ en: "Sleep", zh: "睡眠" });
  if (slot === "temperature") return localizedText({ en: "Temperature", zh: "体温" });
  if (slot === "growth") return localizedText({ en: "Growth", zh: "生长" });
  return localizedText({ en: "Bottle", zh: "奶瓶" });
}

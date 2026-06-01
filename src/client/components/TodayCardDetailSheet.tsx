import { Sheet } from "./Sheet";
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
  const events = day ? eventsForCard(slot, day.events) : [];
  const lines = day ? cardDetailLines(slot, day.summary, timezone, events) : [];
  return (
    <Sheet title={`${cardTitle(slot)}明细`} onClose={onClose}>
      {loading ? <p className="empty">正在加载...</p> : null}
      {error ? (
        <div className="stack">
          <p className="error-text">{error}</p>
          {onRetry ? (
            <button className="secondary" type="button" onClick={onRetry}>
              重试
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
            <h3>当日记录</h3>
            <span>{events.length} 条</span>
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
                        编辑
                      </button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <p className="empty">今天还没有这类记录。</p>
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
  const last = (iso: string | null) => `上次 ${formatRelativeTime(iso ?? latestEventIso(events), timezone)}`;
  if (slot === "feeding") {
    return [`今日 ${summary.feed_breast_count + summary.feed_bottle_count} 次`, `母乳 ${summary.feed_breast_count} 次 · 奶瓶 ${summary.feed_bottle_count} 次`, last(summary.latest_feeding_at)];
  }
  if (slot === "breast") {
    return [`总时长 ${formatDuration(summary.breast_minutes_total)}`, `左 ${formatDuration(summary.breast_left_minutes_total)} · 右 ${formatDuration(summary.breast_right_minutes_total)}`, last(summary.latest_breast_at)];
  }
  if (slot === "pee") return [`今日 ${summary.pee_count} 次`, last(summary.latest_pee_at)];
  if (slot === "poop") return [`今日 ${summary.poop_count} 次`, last(summary.latest_poop_at)];
  if (slot === "sleep") return [`总时长 ${formatDuration(summary.sleep_minutes_total)}`, `今日 ${summary.sleep_session_count} 段`, last(latestEventIso(events))];
  if (slot === "temperature") {
    const latest = summary.latest_temperature;
    const method = latest ? temperatureMethodLabel(latest.method) : "未填";
    return [`今日 ${events.length} 次`, `最新 ${formatTemperature(summary.latest_temperature_c)} · ${method}`, last(latest?.occurred_at ?? null)];
  }
  if (slot === "growth") {
    return [
      summary.growth.latest_weight_g == null ? "体重 —" : `体重 ${summary.growth.latest_weight_g} g`,
      summary.growth.latest_length_cm == null ? "身长 —" : `身长 ${formatNumber(summary.growth.latest_length_cm)} cm`,
      last(latestEventIso(events))
    ];
  }
  return [`总量 ${formatNumber(summary.bottle_ml_total)} ml`, `今日 ${summary.feed_bottle_count} 次`, last(summary.latest_bottle_at)];
}

function latestEventIso(events: DisplayEventRecord[]): string | null {
  return events[0]?.ended_at ?? events[0]?.occurred_at ?? null;
}

function cardTitle(slot: TodaySummaryCardSlot): string {
  if (slot === "feeding") return "喂养";
  if (slot === "breast") return "母乳";
  if (slot === "pee") return "小便";
  if (slot === "poop") return "大便";
  if (slot === "sleep") return "睡眠";
  if (slot === "temperature") return "体温";
  if (slot === "growth") return "生长";
  return "奶瓶";
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, isUnauthorized } from "../api";
import { EventEditSheet } from "../components/EventEditSheet";
import { localizedText, useI18n, type LocalizedText } from "../i18n";
import type { EventRecord, EventType, PediatricSummaryPayload, ShowToast, StatusDailySummary, StatusRangeAnalyticsPayload, StatusTimelinePayload } from "../types";
import { EVENT_LABELS, SECONDARY_ACTIONS, PRIMARY_ACTIONS, eventLabel, formatEventValue, formatMetricDelta, formatNumber, formatTemperature } from "../utils/format";
import { buildRangeQuery, hasCustomDateSelection, presetFromParams, summaryQuery, type TimelinePreset as Preset } from "../utils/timeline-range";
import { visibleComparisonMetricItems, visibleTrendMetricItems } from "../utils/timeline-metrics";
import { formatDuration, formatTime } from "../utils/time";

interface TimelinePageProps {
  search: string;
  onNavigate: (path: string) => void;
  onUnauthorized: () => void;
  showToast: ShowToast;
}

type ViewMode = "events" | "trends" | "comparison" | "summary";

const presets: Array<{ value: Preset; label: LocalizedText }> = [
  { value: "last_24h", label: { en: "Last 24h", zh: "最近 24h" } },
  { value: "today", label: { en: "Today", zh: "今天" } },
  { value: "yesterday", label: { en: "Yesterday", zh: "昨天" } },
  { value: "last_3d", label: { en: "3 days", zh: "3 天" } },
  { value: "last_7d", label: { en: "7 days", zh: "7 天" } },
  { value: "last_14d", label: { en: "14 days", zh: "14 天" } },
  { value: "last_30d", label: { en: "30 days", zh: "30 天" } },
  { value: "custom", label: { en: "Custom", zh: "自定义" } }
];

const eventGroups: Array<{ key: string; label: LocalizedText; types: EventType[] }> = [
  { key: "feeding", label: { en: "Feeding", zh: "喂养" }, types: ["feed_breast", "feed_bottle"] },
  { key: "diaper", label: { en: "Diaper", zh: "尿布" }, types: ["diaper_pee", "diaper_poop"] },
  { key: "sleep", label: { en: "Sleep", zh: "睡眠" }, types: ["sleep_session"] },
  { key: "temperature", label: { en: "Temperature", zh: "体温" }, types: ["temperature"] },
  { key: "growth", label: { en: "Growth", zh: "生长" }, types: ["growth_measurement"] },
  { key: "symptom_medicine", label: { en: "Symptoms / medicine", zh: "症状/用药" }, types: ["symptom", "medicine"] },
  { key: "note", label: { en: "Notes", zh: "备注" }, types: ["note"] },
  { key: "activity", label: { en: "Activity", zh: "活动" }, types: ["tummy_time"] }
];

const allTypes = [...PRIMARY_ACTIONS.map((item) => item.type), ...SECONDARY_ACTIONS.map((item) => item.type)] as EventType[];

export function TimelinePage({ search, onNavigate, onUnauthorized, showToast }: TimelinePageProps) {
  const { text: tx } = useI18n();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const [preset, setPreset] = useState<Preset>(() => presetFromParams(params));
  const [startDate, setStartDate] = useState(params.get("start_date") || "");
  const [endDate, setEndDate] = useState(params.get("end_date") || "");
  const [view, setView] = useState<ViewMode>((params.get("view") as ViewMode) || "events");
  const [eventTypes, setEventTypes] = useState<EventType[]>(() => parseEventTypes(params.get("event_types") || params.get("event_type") || ""));
  const [timeline, setTimeline] = useState<StatusTimelinePayload | null>(null);
  const [analytics, setAnalytics] = useState<StatusRangeAnalyticsPayload | null>(null);
  const [pediatricSummary, setPediatricSummary] = useState<PediatricSummaryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<EventRecord | null>(null);
  const [editError, setEditError] = useState("");

  useEffect(() => {
    setPreset(presetFromParams(params));
    setStartDate(params.get("start_date") || "");
    setEndDate(params.get("end_date") || "");
    setView((params.get("view") as ViewMode) || "events");
    setEventTypes(parseEventTypes(params.get("event_types") || params.get("event_type") || ""));
  }, [params]);

  const query = useMemo(() => buildRangeQuery(preset, startDate, endDate, eventTypes), [preset, startDate, endDate, eventTypes]);
  const customDateReady = useMemo(() => hasCustomDateSelection(preset, startDate, endDate), [preset, startDate, endDate]);

  const load = useCallback(async () => {
    if (!customDateReady) {
      setError("");
      setTimeline(null);
      setAnalytics(null);
      setPediatricSummary(null);
      setLoading(false);
      return;
    }
    try {
      setError("");
      setLoading(true);
      const [timelinePayload, analyticsPayload, summaryPayload] = await Promise.all([
        api<StatusTimelinePayload>(`/api/status/timeline?${query}&limit=300`),
        api<StatusRangeAnalyticsPayload>(`/api/status/range-analytics?${query}&compare=previous`),
        api<PediatricSummaryPayload>(`/api/status/pediatric-summary?${summaryQuery(preset, startDate, endDate, eventTypes)}`)
      ]);
      setTimeline(timelinePayload);
      setAnalytics(analyticsPayload);
      setPediatricSummary(summaryPayload);
    } catch (err) {
      if (isUnauthorized(err)) return onUnauthorized();
      setError(err instanceof Error ? err.message : tx({ en: "Failed to load", zh: "加载失败" }));
    } finally {
      setLoading(false);
    }
  }, [customDateReady, endDate, eventTypes, onUnauthorized, preset, query, startDate, tx]);

  useEffect(() => {
    void load();
  }, [load]);

  function navigate(nextPreset: Preset, nextView: ViewMode, nextTypes = eventTypes, nextStart = startDate, nextEnd = endDate) {
    const nextQuery = buildRangeQuery(nextPreset, nextStart, nextEnd, nextTypes);
    onNavigate(`/app/timeline?${nextQuery}&view=${nextView}`);
  }

  function toggleType(type: EventType) {
    const next = eventTypes.includes(type) ? eventTypes.filter((item) => item !== type) : [...eventTypes, type];
    setEventTypes(next);
    navigate(preset, view, next);
  }

  function selectGroup(types: EventType[]) {
    const allSelected = types.every((type) => eventTypes.includes(type));
    const next = allSelected ? eventTypes.filter((type) => !types.includes(type)) : Array.from(new Set([...eventTypes, ...types]));
    setEventTypes(next);
    navigate(preset, view, next);
  }

  async function deleteEvent(event: EventRecord) {
    if (!window.confirm(tx({ en: "Delete this record?", zh: "删除这条记录？" }))) return;
    try {
      await api(`/api/events/${event.id}`, { method: "DELETE" });
      await load();
      showToast(tx({ en: "Record deleted", zh: "已删除记录" }));
    } catch (err) {
      showToast(err instanceof Error ? err.message : tx({ en: "Failed to delete", zh: "删除失败" }));
    }
  }

  async function submitEdit(payload: Record<string, unknown>) {
    if (!editing || !timeline) return;
    setEditError("");
    try {
      await api(`/api/events/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      setEditing(null);
      await load();
      showToast(tx({ en: "Record saved", zh: "已保存记录" }));
    } catch (err) {
      setEditError(err instanceof Error ? err.message : tx({ en: "Failed to save", zh: "保存失败" }));
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">{analytics?.range.label ?? tx({ en: "Time range", zh: "时间范围" })}</p>
          <h1>{tx({ en: "Timeline", zh: "时间线" })}</h1>
        </div>
      </header>

      <section className="filters panel">
        <div className="segmented">
          {presets.map((item) => (
            <button
              key={item.value}
              className={preset === item.value ? "active" : ""}
              type="button"
              onClick={() => {
                setPreset(item.value);
                navigate(item.value, view, eventTypes);
              }}
            >
              {tx(item.label)}
            </button>
          ))}
        </div>
        {preset === "custom" ? (
          <div className="form-grid">
            <label>
              {tx({ en: "Start date", zh: "开始日期" })}
              <input
                type="date"
                value={startDate}
                onChange={(event) => {
                  setStartDate(event.target.value);
                  navigate("custom", view, eventTypes, event.target.value, endDate);
                }}
                onBlur={(event) => navigate("custom", view, eventTypes, event.target.value, endDate)}
              />
            </label>
            <label>
              {tx({ en: "End date", zh: "结束日期" })}
              <input
                type="date"
                value={endDate}
                onChange={(event) => {
                  setEndDate(event.target.value);
                  navigate("custom", view, eventTypes, startDate, event.target.value);
                }}
                onBlur={(event) => navigate("custom", view, eventTypes, startDate, event.target.value)}
              />
            </label>
          </div>
        ) : null}
        <div className="segmented">
          {(["events", "trends", "comparison", "summary"] as const).map((mode) => (
            <button
              key={mode}
              className={view === mode ? "active" : ""}
              type="button"
              onClick={() => {
                setView(mode);
                navigate(preset, mode, eventTypes);
              }}
            >
              {viewLabel(mode)}
            </button>
          ))}
        </div>
        <div className="chip-row">
          <button className={eventTypes.length === 0 ? "chip active" : "chip"} type="button" onClick={() => { setEventTypes([]); navigate(preset, view, []); }}>
            {tx({ en: "All", zh: "全部" })}
          </button>
          {eventGroups.map((group) => (
            <button key={group.key} className={group.types.every((type) => eventTypes.includes(type)) ? "chip active" : "chip"} type="button" onClick={() => selectGroup(group.types)}>
              {tx(group.label)}
            </button>
          ))}
        </div>
        <div className="chip-row subtle">
          {allTypes.map((type) => (
            <button key={type} className={eventTypes.includes(type) ? "chip active" : "chip"} type="button" onClick={() => toggleType(type)}>
              {eventLabel(type)}
            </button>
          ))}
        </div>
      </section>

      {loading ? <div className="loading">{tx({ en: "Loading timeline...", zh: "正在加载时间线..." })}</div> : null}
      {error ? <p className="error-text">{error}</p> : null}
      {!loading && !error && !customDateReady ? (
        <section className="panel">
          <h2>{tx({ en: "Custom range", zh: "自定义范围" })}</h2>
          <p className="empty">{tx({ en: "Choose start and end dates.", zh: "请选择开始和结束日期。" })}</p>
        </section>
      ) : null}

      {!loading && !error && view === "events" && timeline ? (
        <EventList timeline={timeline} onEdit={setEditing} onDelete={(event) => void deleteEvent(event)} />
      ) : null}
      {!loading && !error && view === "trends" && analytics ? <TrendView analytics={analytics} eventTypes={eventTypes} /> : null}
      {!loading && !error && view === "comparison" && analytics ? <ComparisonView analytics={analytics} eventTypes={eventTypes} /> : null}
      {!loading && !error && view === "summary" && pediatricSummary ? <SummaryView summary={pediatricSummary} filtered={eventTypes.length > 0} /> : null}

      {editing && timeline ? <EventEditSheet event={editing} timezone={timeline.timezone} error={editError} onClose={() => setEditing(null)} onSubmit={submitEdit} /> : null}
    </>
  );
}

function EventList({ timeline, onEdit, onDelete }: { timeline: StatusTimelinePayload; onEdit: (event: EventRecord) => void; onDelete: (event: EventRecord) => void }) {
  const { text: tx } = useI18n();
  if (!timeline.groups.length) {
    return (
      <section className="panel">
        <h2>{tx({ en: "Timeline", zh: "时间线" })}</h2>
        <p className="empty">
          {timeline.event_types.length
            ? tx({ en: "No records match the current filter.", zh: "当前筛选无记录。" })
            : tx({ en: "No records in this range. Add one from the Record page.", zh: "这个范围里还没有记录。先从记录页添加一条。" })}
        </p>
      </section>
    );
  }
  return (
    <div className="timeline-groups">
      {timeline.groups.map((group) => (
        <section key={group.local_date} className="panel">
          <div className="section-head">
            <div>
              <h2>{group.local_date}</h2>
              <p className="muted">{dailyLine(group.summary)}</p>
            </div>
            <span>{tx({ en: "{count} records", zh: "{count} 条" }, { count: group.events.length })}</span>
          </div>
          <div className="event-list">
            {group.events.map((event) => (
              <article key={event.id} className="event-row">
                <div>
                  <strong>{eventLabel(event.event_type)}</strong>
                  <p>
                    {formatTime(event.occurred_at, timeline.timezone)}
                    <span>{formatEventValue(event)}</span>
                  </p>
                  {event.note && event.event_type !== "note" ? <small>{event.note}</small> : null}
                </div>
                <div className="row-actions compact">
                  <button className="secondary small" type="button" onClick={() => onEdit(event)}>
                    {tx({ en: "Edit", zh: "编辑" })}
                  </button>
                  <button className="danger small" type="button" onClick={() => onDelete(event)}>
                    {tx({ en: "Delete", zh: "删除" })}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function TrendView({ analytics, eventTypes }: { analytics: StatusRangeAnalyticsPayload; eventTypes: EventType[] }) {
  const { text: tx } = useI18n();
  const items = visibleTrendMetricItems(eventTypes);
  if (!items.length) {
    return (
      <section className="panel">
        <h2>{tx({ en: "Trends", zh: "趋势" })}</h2>
        <p className="empty">{tx({ en: "No trend metrics for the current filter.", zh: "当前筛选暂无趋势指标。" })}</p>
      </section>
    );
  }
  return (
    <section className="panel">
      <div className="section-head">
        <h2>{tx({ en: "Trends", zh: "趋势" })}</h2>
        <span>{analytics.range.label}</span>
      </div>
      <div className="trend-grid timeline-trend-grid">
        {items.map((item) => (
          <TrendCard key={item.key} label={item.label} dates={analytics.series.local_dates} values={analytics.series[item.key]} unit={item.unit} headline={item.headline} />
        ))}
      </div>
    </section>
  );
}

function ComparisonView({ analytics, eventTypes }: { analytics: StatusRangeAnalyticsPayload; eventTypes: EventType[] }) {
  const { text: tx } = useI18n();
  if (!analytics.comparison) {
    return (
      <section className="panel">
        <h2>{tx({ en: "Comparison", zh: "环比" })}</h2>
        <p className="empty">{tx({ en: "No previous-period comparison for this range yet.", zh: "当前范围暂未生成上一周期对比。" })}</p>
      </section>
    );
  }
  const items = visibleComparisonMetricItems(eventTypes);
  if (!items.length) {
    return (
      <section className="panel">
        <h2>{tx({ en: "Comparison", zh: "环比" })}</h2>
        <p className="empty">{tx({ en: "No comparison metrics for the current filter.", zh: "当前筛选暂无环比指标。" })}</p>
      </section>
    );
  }
  return (
    <section className="panel">
      <div className="section-head">
        <h2>{tx({ en: "Comparison", zh: "环比" })}</h2>
        <span>{analytics.comparison.label}</span>
      </div>
      <div className="summary-grid compact">
        {items.map(({ label, key, unit }) => {
          const item = analytics.comparison!.deltas[key];
          return (
            <article key={key}>
              <span>{label}</span>
              <strong>{item?.current == null ? "—" : formatNumber(item.current)}</strong>
              <small>{tx({ en: "Previous {value} · {delta}", zh: "上期 {value} · {delta}" }, { value: item?.previous == null ? "—" : formatNumber(item.previous), delta: formatMetricDelta(item?.delta ?? null, unit) })}</small>
            </article>
          );
        })}
      </div>
      <p className="notice">{tx({ en: "Comparison only shows record differences. It does not judge whether changes are good or bad.", zh: "环比只显示记录差异，不判断好坏。" })}</p>
    </section>
  );
}

function SummaryView({ summary, filtered }: { summary: PediatricSummaryPayload; filtered: boolean }) {
  const { text: tx } = useI18n();
  return (
    <section className="panel">
      <div className="section-head">
        <h2>{tx({ en: "Visit summary", zh: "问诊摘要" })}</h2>
        <span>{summary.range_label}</span>
      </div>
      {filtered ? <p className="notice">{tx({ en: "This is a filtered summary. Clear filters for the full visit summary.", zh: "当前是筛选摘要；完整问诊摘要请清空筛选。" })}</p> : null}
      <textarea className="copy-textarea" readOnly value={summary.plain_text} />
      <div className="sheet-actions">
        <button className="primary" type="button" onClick={() => void navigator.clipboard?.writeText(summary.plain_text)}>
          {tx({ en: "Copy text", zh: "复制文本" })}
        </button>
      </div>
    </section>
  );
}

function TrendCard({
  label,
  dates,
  values,
  unit,
  headline = "sum"
}: {
  label: string;
  dates: string[];
  values: Array<number | null>;
  unit: string;
  headline?: "sum" | "max";
}) {
  const { text: tx } = useI18n();
  const numeric = values.map((value) => value ?? 0);
  const max = Math.max(1, ...numeric);
  const displayValue =
    headline === "max"
      ? values.reduce<number | null>((currentMax, value) => (value == null ? currentMax : Math.max(currentMax ?? value, value)), null)
      : numeric.reduce((total, value) => total + value, 0);
  return (
    <article className="trend-card">
      <div className="trend-card-head">
        <div>
          <span>{label}</span>
          <strong>{displayValue == null ? "—" : formatNumber(displayValue)}</strong>
          <small>{headline === "max" ? tx({ en: "Max · {unit}", zh: "最高值 · {unit}" }, { unit }) : tx({ en: "Total · {unit}", zh: "合计 · {unit}" }, { unit })}</small>
        </div>
        <small>{dates.length ? `${formatShortDate(dates[0])} - ${formatShortDate(dates[dates.length - 1])}` : tx({ en: "No dates", zh: "暂无日期" })}</small>
      </div>
      <div className="trend-daily-scroll">
        <div className="trend-daily-strip" aria-label={localizedText({ en: "{label} daily trend", zh: "{label} 按日趋势" }, { label })}>
          {numeric.map((value, index) => (
            <div key={`${label}-${dates[index] ?? index}`} className="trend-day-point" title={`${dates[index] ?? ""} ${formatNullableValue(values[index], unit)}`}>
              <span className="trend-day-value">{formatNullableValue(values[index], unit, true)}</span>
              <span className="trend-day-track">
                <span className={value > 0 ? "trend-day-fill" : "trend-day-fill empty"} style={{ height: `${value <= 0 ? 0 : Math.max(8, (value / max) * 72)}px` }} />
              </span>
              <span className="trend-day-date">{dates[index] ? formatShortDate(dates[index]) : "—"}</span>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function formatNullableValue(value: number | null | undefined, unit: string, compact = false): string {
  if (value == null) return "—";
  const formatted = formatNumber(value);
  return compact ? formatted : `${formatted} ${unit}`;
}

function formatShortDate(date: string): string {
  const [, , month, day] = date.match(/^(\d{4})-(\d{2})-(\d{2})$/) ?? [];
  if (!month || !day) return date;
  return `${Number(month)}/${Number(day)}`;
}

function parseEventTypes(value: string): EventType[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is EventType => item in EVENT_LABELS);
}

function viewLabel(mode: ViewMode): string {
  if (mode === "events") return localizedText({ en: "Events", zh: "事件" });
  if (mode === "trends") return localizedText({ en: "Trends", zh: "趋势" });
  if (mode === "comparison") return localizedText({ en: "Comparison", zh: "环比" });
  return localizedText({ en: "Summary", zh: "摘要" });
}

function dailyLine(summary: StatusDailySummary): string {
  return localizedText(
    { en: "Feeding {feeding} times · Diaper {pee}/{poop} · Sleep {sleep}", zh: "喂养 {feeding} 次 · 尿布 {pee}/{poop} · 睡眠 {sleep}" },
    { feeding: summary.feeding.total_count, pee: summary.diaper.pee_count, poop: summary.diaper.poop_count, sleep: formatDuration(summary.sleep.minutes_total) }
  );
}

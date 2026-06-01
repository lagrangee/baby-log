import { useCallback, useEffect, useMemo, useState } from "react";
import { api, isUnauthorized } from "../api";
import { EventEditSheet } from "../components/EventEditSheet";
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

const presets: Array<{ value: Preset; label: string }> = [
  { value: "last_24h", label: "最近 24h" },
  { value: "today", label: "今天" },
  { value: "yesterday", label: "昨天" },
  { value: "last_3d", label: "3 天" },
  { value: "last_7d", label: "7 天" },
  { value: "last_14d", label: "14 天" },
  { value: "last_30d", label: "30 天" },
  { value: "custom", label: "自定义" }
];

const eventGroups: Array<{ label: string; types: EventType[] }> = [
  { label: "喂养", types: ["feed_breast", "feed_bottle"] },
  { label: "尿布", types: ["diaper_pee", "diaper_poop"] },
  { label: "睡眠", types: ["sleep_session"] },
  { label: "体温", types: ["temperature"] },
  { label: "生长", types: ["growth_measurement"] },
  { label: "症状/用药", types: ["symptom", "medicine"] },
  { label: "备注", types: ["note"] },
  { label: "活动", types: ["tummy_time"] }
];

const allTypes = [...PRIMARY_ACTIONS.map((item) => item.type), ...SECONDARY_ACTIONS.map((item) => item.type)] as EventType[];

export function TimelinePage({ search, onNavigate, onUnauthorized, showToast }: TimelinePageProps) {
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
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [customDateReady, endDate, eventTypes, onUnauthorized, preset, query, startDate]);

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
    if (!window.confirm("删除这条记录？")) return;
    try {
      await api(`/api/events/${event.id}`, { method: "DELETE" });
      await load();
      showToast("已删除记录");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "删除失败");
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
      showToast("已保存记录");
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "保存失败");
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">{analytics?.range.label ?? "时间范围"}</p>
          <h1>时间线</h1>
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
              {item.label}
            </button>
          ))}
        </div>
        {preset === "custom" ? (
          <div className="form-grid">
            <label>
              开始日期
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
              结束日期
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
            全部
          </button>
          {eventGroups.map((group) => (
            <button key={group.label} className={group.types.every((type) => eventTypes.includes(type)) ? "chip active" : "chip"} type="button" onClick={() => selectGroup(group.types)}>
              {group.label}
            </button>
          ))}
        </div>
        <div className="chip-row subtle">
          {allTypes.map((type) => (
            <button key={type} className={eventTypes.includes(type) ? "chip active" : "chip"} type="button" onClick={() => toggleType(type)}>
              {EVENT_LABELS[type]}
            </button>
          ))}
        </div>
      </section>

      {loading ? <div className="loading">正在加载时间线...</div> : null}
      {error ? <p className="error-text">{error}</p> : null}
      {!loading && !error && !customDateReady ? (
        <section className="panel">
          <h2>自定义范围</h2>
          <p className="empty">请选择开始和结束日期。</p>
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
  if (!timeline.groups.length) {
    return (
      <section className="panel">
        <h2>时间线</h2>
        <p className="empty">{timeline.event_types.length ? "当前筛选无记录。" : "这个范围里还没有记录。先从记录页添加一条。"}</p>
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
            <span>{group.events.length} 条</span>
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
                    编辑
                  </button>
                  <button className="danger small" type="button" onClick={() => onDelete(event)}>
                    删除
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
  const items = visibleTrendMetricItems(eventTypes);
  if (!items.length) {
    return (
      <section className="panel">
        <h2>趋势</h2>
        <p className="empty">当前筛选暂无趋势指标。</p>
      </section>
    );
  }
  return (
    <section className="panel">
      <div className="section-head">
        <h2>趋势</h2>
        <span>{analytics.range.label}</span>
      </div>
      <div className="trend-grid">
        {items.map((item) => (
          <Sparkline key={item.key} label={item.label} values={analytics.series[item.key]} unit={item.unit} headline={item.headline} />
        ))}
      </div>
    </section>
  );
}

function ComparisonView({ analytics, eventTypes }: { analytics: StatusRangeAnalyticsPayload; eventTypes: EventType[] }) {
  if (!analytics.comparison) {
    return (
      <section className="panel">
        <h2>环比</h2>
        <p className="empty">当前范围暂未生成上一周期对比。</p>
      </section>
    );
  }
  const items = visibleComparisonMetricItems(eventTypes);
  if (!items.length) {
    return (
      <section className="panel">
        <h2>环比</h2>
        <p className="empty">当前筛选暂无环比指标。</p>
      </section>
    );
  }
  return (
    <section className="panel">
      <div className="section-head">
        <h2>环比</h2>
        <span>{analytics.comparison.label}</span>
      </div>
      <div className="summary-grid compact">
        {items.map(({ label, key, unit }) => {
          const item = analytics.comparison!.deltas[key];
          return (
            <article key={key}>
              <span>{label}</span>
              <strong>{item?.current == null ? "—" : formatNumber(item.current)}</strong>
              <small>上期 {item?.previous == null ? "—" : formatNumber(item.previous)} · {formatMetricDelta(item?.delta ?? null, unit)}</small>
            </article>
          );
        })}
      </div>
      <p className="notice">环比只显示记录差异，不判断好坏。</p>
    </section>
  );
}

function SummaryView({ summary, filtered }: { summary: PediatricSummaryPayload; filtered: boolean }) {
  return (
    <section className="panel">
      <div className="section-head">
        <h2>问诊摘要</h2>
        <span>{summary.range_label}</span>
      </div>
      {filtered ? <p className="notice">当前是筛选摘要；完整问诊摘要请清空筛选。</p> : null}
      <textarea className="copy-textarea" readOnly value={summary.plain_text} />
      <div className="sheet-actions">
        <button className="primary" type="button" onClick={() => void navigator.clipboard?.writeText(summary.plain_text)}>
          复制文本
        </button>
      </div>
    </section>
  );
}

function Sparkline({ label, values, unit, headline = "sum" }: { label: string; values: Array<number | null>; unit: string; headline?: "sum" | "max" }) {
  const numeric = values.map((value) => value ?? 0);
  const max = Math.max(1, ...numeric);
  const displayValue =
    headline === "max"
      ? values.reduce<number | null>((currentMax, value) => (value == null ? currentMax : Math.max(currentMax ?? value, value)), null)
      : numeric.reduce((total, value) => total + value, 0);
  return (
    <article>
      <span>{label}</span>
      <strong>{displayValue == null ? "—" : formatNumber(displayValue)}</strong>
      <small>{unit}</small>
      <div className="mini-bars compact-bars labeled" aria-label={`${label} 趋势`}>
        {numeric.map((value, index) => (
          <div key={`${label}-${index}`} className="mini-bar-slot" title={`${formatNumber(value)} ${unit}`}>
            <span className="mini-bar-value">{formatNumber(value)}</span>
            <span className="mini-bar-fill" style={{ height: `${Math.max(8, (value / max) * 48)}px` }} />
          </div>
        ))}
      </div>
    </article>
  );
}

function parseEventTypes(value: string): EventType[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is EventType => item in EVENT_LABELS);
}

function viewLabel(mode: ViewMode): string {
  if (mode === "events") return "事件";
  if (mode === "trends") return "趋势";
  if (mode === "comparison") return "环比";
  return "摘要";
}

function dailyLine(summary: StatusDailySummary): string {
  return `喂养 ${summary.feeding.total_count} 次 · 尿布 ${summary.diaper.pee_count}/${summary.diaper.poop_count} · 睡眠 ${formatDuration(summary.sleep.minutes_total)}`;
}

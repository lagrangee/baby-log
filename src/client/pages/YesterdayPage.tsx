import { useCallback, useEffect, useState } from "react";
import { api, isUnauthorized } from "../api";
import { EventEditSheet } from "../components/EventEditSheet";
import { RecentEvents } from "../components/RecentEvents";
import { TodaySummaryCards } from "../components/TodaySummaryCards";
import { useI18n, type LocalizedText } from "../i18n";
import type { EventRecord, JsonRecord, ShowToast, StatusDayPayload } from "../types";
import { formatNumber } from "../utils/format";
import { formatDateInTimezone, formatDuration } from "../utils/time";

interface YesterdayPageProps {
  onUnauthorized: () => void;
  showToast: ShowToast;
}

export function YesterdayPage({ onUnauthorized, showToast }: YesterdayPageProps) {
  const { text: tx } = useI18n();
  const [yesterday, setYesterday] = useState<StatusDayPayload | null>(null);
  const [today, setToday] = useState<StatusDayPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<EventRecord | null>(null);
  const [editError, setEditError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const [yesterdayPayload, todayPayload] = await Promise.all([
        api<StatusDayPayload>("/api/status/day?preset=yesterday"),
        api<StatusDayPayload>("/api/status/day?preset=today")
      ]);
      setYesterday(yesterdayPayload);
      setToday(todayPayload);
    } catch (err) {
      if (isUnauthorized(err)) return onUnauthorized();
      setError(err instanceof Error ? err.message : tx({ en: "Failed to load", zh: "加载失败" }));
    } finally {
      setLoading(false);
    }
  }, [onUnauthorized, tx]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitEdit(payload: JsonRecord) {
    if (!editing) return;
    setEditError("");
    try {
      await api(`/api/events/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      setEditing(null);
      await load();
      showToast(tx({ en: "Record saved", zh: "已保存记录" }));
    } catch (err) {
      setEditError(err instanceof Error ? err.message : tx({ en: "Failed to save", zh: "保存失败" }));
    }
  }

  if (loading) return <div className="loading">{tx({ en: "Loading yesterday review...", zh: "正在加载昨日复盘..." })}</div>;
  if (error || !yesterday || !today) {
    return (
      <section className="panel">
        <h1>{tx({ en: "Yesterday", zh: "昨日" })}</h1>
        <p className="error-text">{error || tx({ en: "Failed to load", zh: "加载失败" })}</p>
        <button className="primary" type="button" onClick={() => void load()}>
          {tx({ en: "Retry", zh: "重试" })}
        </button>
      </section>
    );
  }

  const timezone = yesterday.profile.timezone;

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">{formatDateInTimezone(new Date(`${yesterday.local_date}T12:00:00Z`), timezone)}</p>
          <h1>{tx({ en: "Yesterday review", zh: "昨日复盘" })}</h1>
          <p className="muted">{tx({ en: "Yesterday is a complete day. Today is only a current reference, not a trend judgment.", zh: "昨日是完整日；今天只是截至当前的参照，不做涨跌判断。" })}</p>
        </div>
      </header>

      <TodaySummaryCards summary={yesterday.summary} timezone={timezone} />

      <section className="panel">
        <div className="section-head">
          <h2>{tx({ en: "Yesterday / today so far", zh: "昨日 / 今日截至当前" })}</h2>
          <span>{tx({ en: "Side by side only", zh: "只并排" })}</span>
        </div>
        <div className="trend-grid">
          <CompareMetric label={{ en: "Feeding", zh: "喂养" }} yesterday={yesterday.summary.feed_breast_count + yesterday.summary.feed_bottle_count} today={today.summary.feed_breast_count + today.summary.feed_bottle_count} unit={tx({ en: "times", zh: "次" })} />
          <CompareMetric label={{ en: "Breastfeed", zh: "母乳" }} yesterday={yesterday.summary.breast_minutes_total} today={today.summary.breast_minutes_total} unit={tx({ en: "min", zh: "分钟" })} duration />
          <CompareMetric label={{ en: "Bottle", zh: "奶瓶" }} yesterday={yesterday.summary.bottle_ml_total} today={today.summary.bottle_ml_total} unit="ml" />
          <CompareMetric label={{ en: "Pee", zh: "小便" }} yesterday={yesterday.summary.pee_count} today={today.summary.pee_count} unit={tx({ en: "times", zh: "次" })} />
          <CompareMetric label={{ en: "Poop", zh: "大便" }} yesterday={yesterday.summary.poop_count} today={today.summary.poop_count} unit={tx({ en: "times", zh: "次" })} />
          <CompareMetric label={{ en: "Sleep", zh: "睡眠" }} yesterday={yesterday.summary.sleep_minutes_total} today={today.summary.sleep_minutes_total} unit={tx({ en: "min", zh: "分钟" })} duration />
        </div>
        <p className="notice">{tx({ en: "Today's data is incomplete and should not be used to judge improvement or worsening.", zh: "今天的数据还没完整，不用于判断变好或变差。" })}</p>
      </section>

      <RecentEvents
        events={yesterday.events}
        timezone={timezone}
        limit={50}
        onEdit={(event) => {
          setEditError("");
          setEditing(event);
        }}
      />

      {editing ? <EventEditSheet event={editing} timezone={timezone} error={editError} onClose={() => setEditing(null)} onSubmit={submitEdit} /> : null}
    </>
  );
}

function CompareMetric({ label, yesterday, today, unit, duration = false }: { label: LocalizedText; yesterday: number; today: number; unit: string; duration?: boolean }) {
  const { text: tx } = useI18n();
  return (
    <article>
      <span>{tx(label)}</span>
      <strong>{duration ? formatDuration(yesterday) : `${formatNumber(yesterday)} ${unit}`}</strong>
      <small>{tx({ en: "Today so far: {value}", zh: "今天截至当前：{value}" }, { value: duration ? formatDuration(today) : `${formatNumber(today)} ${unit}` })}</small>
    </article>
  );
}

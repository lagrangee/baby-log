import { useCallback, useEffect, useState } from "react";
import { api, isUnauthorized } from "../api";
import { localizedText, useI18n, type LocalizedText } from "../i18n";
import type { ChecklistTemplatePresence, PediatricSummaryPayload, ReferenceTargetsPayload, ShowToast, StatusDailySummary, StatusEventPreview, StatusOverviewPayload } from "../types";
import { formatNumber, formatTemperature, temperatureMethodLabel } from "../utils/format";
import { referenceBadgeText, referenceForSlot, referenceStatusClass, type SummaryReferenceSlot } from "../utils/reference-targets";
import { formatDuration, formatRelativeTime, formatTime, nowIso } from "../utils/time";

interface TodayPageProps {
  onLogout: () => void;
  onNavigate: (path: string) => void;
  onUnauthorized: () => void;
  showToast: ShowToast;
}

type SummaryRange = "24h" | "3d" | "7d";

export function TodayPage({ onLogout, onNavigate, onUnauthorized, showToast }: TodayPageProps) {
  const { text: tx } = useI18n();
  const [overview, setOverview] = useState<StatusOverviewPayload | null>(null);
  const [summaryRange, setSummaryRange] = useState<SummaryRange>("24h");
  const [pediatricSummary, setPediatricSummary] = useState<PediatricSummaryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      setOverview(await api<StatusOverviewPayload>("/api/status/overview?days=7"));
    } catch (err) {
      if (isUnauthorized(err)) return onUnauthorized();
      setError(err instanceof Error ? err.message : tx({ en: "Failed to load", zh: "加载失败" }));
    } finally {
      setLoading(false);
    }
  }, [onUnauthorized, tx]);

  const loadPediatricSummary = useCallback(
    async (range: SummaryRange) => {
      try {
        setSummaryLoading(true);
        setPediatricSummary(await api<PediatricSummaryPayload>(`/api/status/pediatric-summary?range=${range}`));
      } catch (err) {
        if (isUnauthorized(err)) return onUnauthorized();
        setError(err instanceof Error ? err.message : tx({ en: "Failed to load visit summary", zh: "问诊摘要加载失败" }));
      } finally {
        setSummaryLoading(false);
      }
    },
    [onUnauthorized, tx]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadPediatricSummary(summaryRange);
  }, [loadPediatricSummary, summaryRange]);

  async function closeTummyTimeSession() {
    const session = overview?.active_state.open_tummy_time_session;
    if (!session) return;
    try {
      await api(`/api/events/${session.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ended_at: nowIso() })
      });
      await load();
      showToast(tx({ en: "Tummy time ended", zh: "已结束趴趴时间" }));
    } catch (err) {
      showToast(err instanceof Error ? err.message : tx({ en: "Failed to end", zh: "结束失败" }));
    }
  }

  async function closeBreastSession() {
    const session = overview?.active_state.open_breast_session;
    if (!session) return;
    try {
      await api(`/api/events/${session.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ended_at: nowIso() })
      });
      await load();
      showToast(tx({ en: "Breastfeed ended", zh: "已结束亲喂" }));
    } catch (err) {
      showToast(err instanceof Error ? err.message : tx({ en: "Failed to end", zh: "结束失败" }));
    }
  }

  if (loading) return <div className="loading">{tx({ en: "Loading status overview...", zh: "正在加载状态总览..." })}</div>;
  if (error || !overview) {
    return (
      <section className="panel">
        <h1>{tx({ en: "Today", zh: "今日" })}</h1>
        <p className="error-text">{error || tx({ en: "Failed to load", zh: "加载失败" })}</p>
        <button className="primary" type="button" onClick={() => void load()}>
          {tx({ en: "Retry", zh: "重试" })}
        </button>
      </section>
    );
  }

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">{overview.today.local_date}</p>
          <h1>{tx({ en: "Today status", zh: "今日状态" })}</h1>
          <p className="muted">{profileStageText(overview.profile)}</p>
        </div>
        <button className="ghost small" type="button" onClick={onLogout}>
          {tx({ en: "Log out", zh: "退出" })}
        </button>
      </header>

      <section className="panel">
        <div className="section-head">
          <h2>{tx({ en: "Current status", zh: "当前状态" })}</h2>
          <span>
            {overview.active_state.open_sleep_session || overview.active_state.open_tummy_time_session || overview.active_state.open_breast_session
              ? tx({ en: "In progress", zh: "进行中" })
              : tx({ en: "Settled", zh: "平稳" })}
          </span>
        </div>
        {overview.active_state.open_sleep_session ? (
          <p>
            {tx({ en: "Sleeping, asleep for {duration}", zh: "睡眠中，已睡 {duration}" }, { duration: formatDuration(overview.active_state.open_sleep_session.elapsed_minutes) })}
          </p>
        ) : overview.active_state.open_breast_session ? (
          <p>{tx({ en: "Breastfeeding, recorded for {duration}", zh: "亲喂进行中，已记录 {duration}" }, { duration: formatDuration(overview.active_state.open_breast_session.elapsed_minutes) })}</p>
        ) : overview.active_state.open_tummy_time_session ? (
          <p>{tx({ en: "Tummy time in progress, recorded for {duration}", zh: "趴趴时间进行中，已记录 {duration}" }, { duration: formatDuration(overview.active_state.open_tummy_time_session.elapsed_minutes) })}</p>
        ) : (
          <p className="muted">{tx({ en: "No active status right now.", zh: "当前无进行中状态。" })}</p>
        )}
      </section>

      {overview.birth_ready ? (
        <BirthHospitalCard
          overview={overview}
          summaryText={pediatricSummary?.plain_text ?? ""}
          onCopySummary={() => void navigator.clipboard?.writeText(pediatricSummary?.plain_text ?? "")}
          onNavigate={onNavigate}
        />
      ) : null}

      <StatusSummaryCards summary={overview.today} timezone={overview.profile.timezone} targets={overview.reference_targets} />

      {overview.first_week ? (
        <FirstWeekPanel
          summary={overview.first_week.summary_24h}
          activeState={overview.active_state}
          onCloseBreast={() => void closeBreastSession()}
          onCloseTummyTime={() => void closeTummyTimeSession()}
        />
      ) : null}

      <ReferenceTargetsCard targets={overview.reference_targets} />

      <section className="panel">
        <div className="section-head">
          <h2>{tx({ en: "Trends and comparison", zh: "趋势与环比" })}</h2>
          <span>Timeline</span>
        </div>
        <p className="muted">{tx({ en: "Full trend charts, event filters, and comparison review have moved to Timeline.", zh: "完整趋势图、事件筛选和环比回顾已移到 Timeline。" })}</p>
        <button className="secondary" type="button" onClick={() => onNavigate("/app/timeline?preset=last_7d&view=trends")}>
          {tx({ en: "View trends in Timeline", zh: "去 Timeline 看趋势" })}
        </button>
      </section>

      <section className="panel">
        <div className="section-head">
          <h2>{tx({ en: "Data quality reminders", zh: "数据质量提醒" })}</h2>
          <span>{overview.data_quality.length}</span>
        </div>
        {overview.data_quality.length ? (
          <div className="simple-list">
            {overview.data_quality.map((flag) => (
              <article key={`${flag.code}-${flag.related_event_id ?? ""}`}>
                <strong>{flag.severity === "warning" ? tx({ en: "Needs review", zh: "需要核对" }) : tx({ en: "Note", zh: "提示" })}</strong>
                <p>{flag.message}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty">{tx({ en: "No data currently needs review.", zh: "暂无需要核对的数据。" })}</p>
        )}
      </section>

      <section className="panel">
        <div className="section-head">
          <h2>{tx({ en: "Visit summary", zh: "问诊摘要" })}</h2>
          <span>{rangeLabel(summaryRange)}</span>
        </div>
        <div className="segmented">
          {(["24h", "3d", "7d"] as const).map((range) => (
            <button key={range} className={summaryRange === range ? "active" : ""} type="button" onClick={() => setSummaryRange(range)}>
              {rangeLabel(range)}
            </button>
          ))}
        </div>
        {summaryLoading ? <p className="loading-inline">{tx({ en: "Generating summary...", zh: "正在生成摘要..." })}</p> : null}
        {pediatricSummary ? (
          <>
            <p className="notice">{tx({ en: "This is not a diagnosis. Use it together with clinician advice.", zh: "这不是诊断，请结合医生意见。" })}</p>
            <PediatricStructuredSections summary={pediatricSummary} />
            <textarea className="copy-textarea" readOnly value={pediatricSummary.plain_text} />
            <div className="sheet-actions">
              <button className="primary" type="button" onClick={() => void navigator.clipboard?.writeText(pediatricSummary.plain_text)}>
                {tx({ en: "Copy text", zh: "复制文本" })}
              </button>
            </div>
          </>
        ) : null}
      </section>
    </>
  );
}

function StatusSummaryCards({ summary, timezone, targets }: { summary: StatusDailySummary; timezone: string; targets: ReferenceTargetsPayload }) {
  const { text: tx } = useI18n();
  return (
    <section className="summary-grid" aria-label={tx({ en: "Today status summary", zh: "今日状态摘要" })}>
      <article>
        <span>{tx({ en: "Total feeding", zh: "总喂养" })}</span>
        <strong>{tx({ en: "{count} times", zh: "{count} 次" }, { count: summary.feeding.total_count })}</strong>
        <small>{summary.feeding.latest_feeding_at ? `${formatRelativeTime(summary.feeding.latest_feeding_at, timezone)}` : tx({ en: "No recent record", zh: "暂无最近记录" })}</small>
        <SummaryReference targets={targets} slot="feeding" />
      </article>
      <article>
        <span>{tx({ en: "Breastfeed", zh: "亲喂" })}</span>
        <strong>{tx({ en: "{count} times", zh: "{count} 次" }, { count: summary.feeding.breast_count })}</strong>
        <small>{formatDuration(summary.feeding.breast_minutes_total)}</small>
      </article>
      <article>
        <span>{tx({ en: "Bottle", zh: "奶瓶" })}</span>
        <strong>{tx({ en: "{count} times", zh: "{count} 次" }, { count: summary.feeding.bottle_count })}</strong>
        <small>{formatNumber(summary.feeding.bottle_ml_total)} ml</small>
        <SummaryReference targets={targets} slot="bottle" />
      </article>
      <article>
        <span>{tx({ en: "Diaper", zh: "尿布" })}</span>
        <strong>
          {summary.diaper.pee_count}/{summary.diaper.poop_count}
        </strong>
        <small>{summary.diaper.latest_diaper_at ? formatRelativeTime(summary.diaper.latest_diaper_at, timezone) : tx({ en: "Pee / poop", zh: "小便 / 大便" })}</small>
        <SummaryReference targets={targets} slot="pee" />
      </article>
      <article>
        <span>{tx({ en: "Sleep", zh: "睡眠" })}</span>
        <strong>{formatDuration(summary.sleep.minutes_total)}</strong>
        <small>{tx({ en: "Longest {duration}", zh: "最长 {duration}" }, { duration: formatDuration(summary.sleep.longest_minutes) })}</small>
        <SummaryReference targets={targets} slot="sleep" />
      </article>
      <article>
        <span>{tx({ en: "Temperature", zh: "体温" })}</span>
        <strong>{formatTemperature(summary.temperature.latest_c)}</strong>
        <small>
          {summary.temperature.latest_occurred_at
            ? `${formatRelativeTime(summary.temperature.latest_occurred_at, timezone)} · ${temperatureMethodLabel(summary.temperature.latest_method)}`
            : tx({ en: "Highest {temperature}", zh: "最高 {temperature}" }, { temperature: formatTemperature(summary.temperature.max_c) })}
        </small>
        <SummaryReference targets={targets} slot="temperature" />
      </article>
      <article>
        <span>{tx({ en: "Weight", zh: "体重" })}</span>
        <strong>{summary.growth.latest_weight_g == null ? "—" : `${summary.growth.latest_weight_g} g`}</strong>
      </article>
      <article>
        <span>{tx({ en: "Symptoms", zh: "症状" })}</span>
        <strong>{tx({ en: "{count} records", zh: "{count} 条" }, { count: summary.symptoms.count })}</strong>
      </article>
    </section>
  );
}

function SummaryReference({ targets, slot }: { targets: ReferenceTargetsPayload; slot: SummaryReferenceSlot }) {
  const item = referenceForSlot(targets.items, slot);
  const text = referenceBadgeText(item);
  if (!text) return null;
  return <small className={`reference-mini ${referenceStatusClass(item)}`}>{text}</small>;
}

function BirthHospitalCard({
  overview,
  summaryText,
  onCopySummary,
  onNavigate
}: {
  overview: StatusOverviewPayload;
  summaryText: string;
  onCopySummary: () => void;
  onNavigate: (path: string) => void;
}) {
  const { text: tx } = useI18n();
  const ready = overview.birth_ready!;
  return (
    <section className="panel birth-ready-card">
      <div className="section-head">
        <h2>{tx({ en: "Birth hospital prep", zh: "出生住院准备" })}</h2>
        <span>{tx({ en: "Day {day}", zh: "出生第 {day} 天" }, { day: ready.birth_day_number })}</span>
      </div>
      <div className="summary-grid compact">
        <article>
          <span>{tx({ en: "Birth date", zh: "出生日期" })}</span>
          <strong>{ready.child_birth_date}</strong>
        </article>
        <article>
          <span>{tx({ en: "Latest feeding", zh: "最近喂养" })}</span>
          <strong>{eventPreviewText(ready.latest_feeding, overview.profile.timezone)}</strong>
        </article>
        <article>
          <span>{tx({ en: "Latest diaper", zh: "最近尿布" })}</span>
          <strong>{eventPreviewText(ready.latest_diaper, overview.profile.timezone)}</strong>
        </article>
        <article>
          <span>{tx({ en: "Latest temperature", zh: "最近体温" })}</span>
          <strong>{birthReadyTemperatureText(ready, overview.profile.timezone)}</strong>
        </article>
        <article>
          <span>{tx({ en: "Latest weight", zh: "最近体重" })}</span>
          <strong>{ready.latest_weight_g == null ? "—" : `${ready.latest_weight_g} g`}</strong>
        </article>
        <TemplateStatusCard template={ready.checklist_templates.birth_hospital} />
        <TemplateStatusCard template={ready.checklist_templates.first_week} />
      </div>
      <div className="row-actions">
        <button className="secondary small" type="button" onClick={() => onNavigate("/app/checklist")}>
          {tx({ en: "Open birth hospital template", zh: "打开出生住院期模板" })}
        </button>
        <button className="secondary small" type="button" onClick={() => onNavigate("/app/checklist")}>
          {tx({ en: "Open first-week template", zh: "打开出生后第 1 周模板" })}
        </button>
        <button className="secondary small" type="button" disabled={!summaryText} onClick={onCopySummary}>
          {tx({ en: "Copy visit summary", zh: "复制问诊摘要" })}
        </button>
        <button className="primary small" type="button" onClick={() => onNavigate("/app")}>
          {tx({ en: "Record feeding", zh: "记录喂养" })}
        </button>
        <button className="primary small" type="button" onClick={() => onNavigate("/app")}>
          {tx({ en: "Record diaper", zh: "记录尿布" })}
        </button>
        <button className="primary small" type="button" onClick={() => onNavigate("/app")}>
          {tx({ en: "Record temperature", zh: "记录体温" })}
        </button>
        <button className="secondary small" type="button" onClick={() => onNavigate("/app/more")}>
          {tx({ en: "Record weight", zh: "记录体重" })}
        </button>
      </div>
      <p className="notice">{tx({ en: "This only summarizes family records and checklist status. It does not judge whether hospital items should be accepted or refused.", zh: "这里只汇总家庭已有记录和清单状态，不判断医院项目是否应该接受或拒绝。" })}</p>
    </section>
  );
}

function TemplateStatusCard({ template }: { template: ChecklistTemplatePresence }) {
  const { text: tx } = useI18n();
  return (
    <article>
      <span>{template.title}</span>
      <strong>{template.imported ? tx({ en: "Imported", zh: "已导入" }) : tx({ en: "Not imported", zh: "未导入" })}</strong>
      <small>{tx({ en: "{count} items", zh: "{count} 项" }, { count: template.imported_item_count })}</small>
    </article>
  );
}

function birthReadyTemperatureText(ready: NonNullable<StatusOverviewPayload["birth_ready"]>, timezone: string): string {
  if (!ready.latest_temperature) return formatTemperature(ready.latest_temperature_c);
  return `${formatTemperature(ready.latest_temperature.value_c)} · ${formatRelativeTime(ready.latest_temperature.occurred_at, timezone)} · ${temperatureMethodLabel(ready.latest_temperature.method)}`;
}

function FirstWeekPanel({
  summary,
  activeState,
  onCloseBreast,
  onCloseTummyTime
}: {
  summary: StatusDailySummary;
  activeState: StatusOverviewPayload["active_state"];
  onCloseBreast: () => void;
  onCloseTummyTime: () => void;
}) {
  const { text: tx } = useI18n();
  return (
    <section className="panel first-week-panel">
      <div className="section-head">
        <h2>{tx({ en: "Newborn first week 24h", zh: "新生儿首周 24h" })}</h2>
        <span>{tx({ en: "Rolling window", zh: "滚动窗口" })}</span>
      </div>
      <div className="summary-grid compact">
        <article>
          <span>{tx({ en: "Feeding", zh: "喂养" })}</span>
          <strong>{summary.feeding.total_count}</strong>
          <small>{tx({ en: "times", zh: "次" })}</small>
        </article>
        <article>
          <span>{tx({ en: "Bottle", zh: "奶瓶" })}</span>
          <strong>{summary.feeding.bottle_count ? `${formatNumber(summary.feeding.bottle_ml_total)} ml` : "—"}</strong>
        </article>
        <article>
          <span>{tx({ en: "Breastfeed", zh: "母乳" })}</span>
          <strong>{summary.feeding.breast_count ? formatDuration(summary.feeding.breast_minutes_total) : "—"}</strong>
        </article>
        <article>
          <span>{tx({ en: "Wet diapers", zh: "湿尿布" })}</span>
          <strong>{summary.diaper.pee_count}</strong>
          <small>{tx({ en: "times", zh: "次" })}</small>
        </article>
        <article>
          <span>{tx({ en: "Poop", zh: "大便" })}</span>
          <strong>{summary.diaper.poop_count}</strong>
          <small>{tx({ en: "times", zh: "次" })}</small>
        </article>
        <article>
          <span>{tx({ en: "Temperature", zh: "体温" })}</span>
          <strong>{formatTemperature(summary.temperature.latest_c)}</strong>
        </article>
        <article>
          <span>{tx({ en: "Weight", zh: "体重" })}</span>
          <strong>{summary.growth.latest_weight_g == null ? "—" : `${summary.growth.latest_weight_g} g`}</strong>
        </article>
        <article>
          <span>{tx({ en: "Sleeping", zh: "睡眠中" })}</span>
          <strong>{activeState.open_sleep_session ? formatDuration(activeState.open_sleep_session.elapsed_minutes) : "—"}</strong>
        </article>
      </div>
      {activeState.open_tummy_time_session ? (
        <div className="inline-alert">
          <span>{tx({ en: "Tummy time in progress: {duration}", zh: "趴趴时间进行中：{duration}" }, { duration: formatDuration(activeState.open_tummy_time_session.elapsed_minutes) })}</span>
          <button className="secondary small" type="button" onClick={onCloseTummyTime}>
            {tx({ en: "End tummy time", zh: "结束趴趴时间" })}
          </button>
        </div>
      ) : null}
      {activeState.open_breast_session ? (
        <div className="inline-alert">
          <span>{tx({ en: "Breastfeeding: {duration}", zh: "亲喂进行中：{duration}" }, { duration: formatDuration(activeState.open_breast_session.elapsed_minutes) })}</span>
          <button className="secondary small" type="button" onClick={onCloseBreast}>
            {tx({ en: "End breastfeed", zh: "结束亲喂" })}
          </button>
        </div>
      ) : null}
    </section>
  );
}

function ReferenceTargetsCard({ targets }: { targets: ReferenceTargetsPayload }) {
  const { text: tx } = useI18n();
  return (
    <details className="panel collapsible-panel">
      <summary className="section-head">
        <h2>{tx({ en: "Today references", zh: "今日参考" })}</h2>
        <span>{targets.age_context.birth_day_number ? tx({ en: "Day {day}", zh: "出生第 {day} 天" }, { day: targets.age_context.birth_day_number }) : tx({ en: "Not set", zh: "待设置" })}</span>
      </summary>
      {targets.missing_birth_date_message ? <p className="empty">{targets.missing_birth_date_message}</p> : null}
      {targets.items.length ? (
        <div className="simple-list">
          {targets.items.map((item) => (
            <article key={item.key}>
              <div className="section-head compact-head">
                <strong>{item.title}</strong>
                <span>{targetStatusLabel(item.status)}</span>
              </div>
              <ReferenceTargetMetrics item={item} />
            </article>
          ))}
        </div>
      ) : targets.missing_birth_date_message ? null : (
        <p className="empty">{tx({ en: "No reference items apply to the current stage.", zh: "当前阶段暂无适用参考项。" })}</p>
      )}
    </details>
  );
}

function ReferenceTargetMetrics({ item }: { item: ReferenceTargetsPayload["items"][number] }) {
  const current =
    item.current_value == null || !item.unit
      ? localizedText({ en: "Record: —", zh: "记录：—" })
      : localizedText({ en: "Record: {value} {unit}", zh: "记录：{value} {unit}" }, { value: formatNumber(item.current_value), unit: item.unit });
  return (
    <div className="reference-metrics">
      <span>{current}</span>
      {item.target_label ? <span>{localizedText({ en: "Reference: {target}", zh: "参考：{target}" }, { target: item.target_label })}</span> : null}
    </div>
  );
}

function targetStatusLabel(status: ReferenceTargetsPayload["items"][number]["status"]): string {
  if (status === "below_reference") return localizedText({ en: "Below reference", zh: "少于参考" });
  if (status === "above_reference") return localizedText({ en: "Above reference", zh: "高于参考" });
  if (status === "red_flag_recorded") return localizedText({ en: "Contact clinician", zh: "需联系医生" });
  if (status === "within_reference") return localizedText({ en: "Compared", zh: "记录对照" });
  if (status === "not_enough_data") return localizedText({ en: "Not enough data", zh: "记录不足" });
  return localizedText({ en: "Reference", zh: "参考" });
}

function TrendCards({ days }: { days: StatusDailySummary[] }) {
  const { text: tx } = useI18n();
  const maxSleep = Math.max(1, ...days.map((day) => day.sleep.minutes_total));
  const maxFeed = Math.max(1, ...days.map((day) => day.feeding.total_count));
  return (
    <section className="panel">
      <div className="section-head">
        <h2>{tx({ en: "7-day trend", zh: "7 天趋势" })}</h2>
        <span>{tx({ en: "{count} days", zh: "{count} 天" }, { count: days.length })}</span>
      </div>
      <div className="trend-grid">
        <TrendMetric label={{ en: "Feeding count", zh: "喂养次数" }} value={sum(days, (day) => day.feeding.total_count)} unit={tx({ en: "times", zh: "次" })} />
        <TrendMetric label={{ en: "Bottle total", zh: "奶瓶总量" }} value={sum(days, (day) => day.feeding.bottle_ml_total)} unit="ml" />
        <TrendMetric label={{ en: "Sleep duration", zh: "睡眠总时长" }} value={sum(days, (day) => day.sleep.minutes_total)} unit={tx({ en: "min", zh: "分钟" })} />
        <TrendMetric label={{ en: "Longest sleep", zh: "最长睡眠" }} value={Math.max(0, ...days.map((day) => day.sleep.longest_minutes))} unit={tx({ en: "min", zh: "分钟" })} />
        <TrendMetric label={{ en: "Pee/poop", zh: "小便/大便" }} value={`${sum(days, (day) => day.diaper.pee_count)}/${sum(days, (day) => day.diaper.poop_count)}`} unit="" />
      </div>
      <div className="mini-bars" aria-label={tx({ en: "Sleep trend", zh: "睡眠趋势" })}>
        {days.map((day) => (
          <span
            key={day.local_date}
            title={tx({ en: "{date} sleep {minutes} min", zh: "{date} 睡眠 {minutes} 分钟" }, { date: day.local_date, minutes: day.sleep.minutes_total })}
            style={{ height: `${Math.max(8, (day.sleep.minutes_total / maxSleep) * 72)}px` }}
          />
        ))}
      </div>
      <div className="mini-bars subtle" aria-label={tx({ en: "Feeding trend", zh: "喂养趋势" })}>
        {days.map((day) => (
          <span
            key={day.local_date}
            title={tx({ en: "{date} feeding {count} times", zh: "{date} 喂养 {count} 次" }, { date: day.local_date, count: day.feeding.total_count })}
            style={{ height: `${Math.max(8, (day.feeding.total_count / maxFeed) * 52)}px` }}
          />
        ))}
      </div>
    </section>
  );
}

function TrendMetric({ label, value, unit }: { label: LocalizedText; value: number | string; unit: string }) {
  const { text: tx } = useI18n();
  return (
    <article>
      <span>{tx(label)}</span>
      <strong>{typeof value === "number" ? formatNumber(value) : value}</strong>
      {unit ? <small>{unit}</small> : null}
    </article>
  );
}

function eventPreviewText(event: StatusEventPreview | null, timezone: string): string {
  if (!event) return "—";
  let label: string = event.event_type;
  if (event.event_type === "feed_breast") label = localizedText({ en: "Breastfeed", zh: "母乳" });
  if (event.event_type === "feed_bottle") label = event.amount_value == null ? localizedText({ en: "Bottle", zh: "奶瓶" }) : localizedText({ en: "Bottle {value} ml", zh: "奶瓶 {value} ml" }, { value: formatNumber(event.amount_value) });
  if (event.event_type === "diaper_pee") label = localizedText({ en: "Pee", zh: "小便" });
  if (event.event_type === "diaper_poop") label = localizedText({ en: "Poop", zh: "大便" });
  return `${label} · ${formatTime(event.occurred_at, timezone)}`;
}

function profileStageText(profile: StatusOverviewPayload["profile"]): string {
  if (profile.phase === "pregnancy_prebirth") {
    return profile.days_to_due == null
      ? localizedText({ en: "Before birth", zh: "出生前" })
      : localizedText({ en: "Before birth · {days} days to due date", zh: "出生前 · 距预产期 {days} 天" }, { days: profile.days_to_due });
  }
  return profile.birth_day_number == null ? localizedText({ en: "After birth", zh: "出生后" }) : localizedText({ en: "Day {day}", zh: "出生第 {day} 天" }, { day: profile.birth_day_number });
}

function PediatricStructuredSections({ summary }: { summary: PediatricSummaryPayload }) {
  const { text: tx } = useI18n();
  const labels: Record<keyof PediatricSummaryPayload["structured"], LocalizedText> = {
    basic_info: { en: "Basic info", zh: "基本信息" },
    feeding: { en: "Feeding", zh: "喂养" },
    diaper: { en: "Diaper", zh: "尿布" },
    sleep: { en: "Sleep", zh: "睡眠" },
    temperature: { en: "Temperature", zh: "体温" },
    growth: { en: "Growth", zh: "生长" },
    symptoms: { en: "Symptoms", zh: "症状" },
    medicines: { en: "Medicines", zh: "用药" },
    notes: { en: "Notes", zh: "备注" },
    data_quality: { en: "Data quality", zh: "数据质量" },
    reference_targets: { en: "Reference targets", zh: "参考对照" }
  };
  return (
    <div className="simple-list">
      {(Object.keys(labels) as Array<keyof PediatricSummaryPayload["structured"]>).map((key) => (
        <article key={key}>
          <strong>{tx(labels[key])}</strong>
          {summary.structured[key].map((line, index) => (
            <p key={`${key}-${index}`}>{line}</p>
          ))}
        </article>
      ))}
    </div>
  );
}

function rangeLabel(range: SummaryRange): string {
  if (range === "24h") return "24h";
  if (range === "3d") return "3d";
  return "7d";
}

function sum(days: StatusDailySummary[], pick: (day: StatusDailySummary) => number): number {
  return days.reduce((total, day) => total + pick(day), 0);
}

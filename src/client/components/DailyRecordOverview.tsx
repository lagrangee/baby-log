import { ActiveSessionCard } from "./ActiveSessionCard";
import { GrowthCurvePanel } from "./GrowthCurvePanel";
import { QuickRecordGrid, type QuickRecordAction, type QuickRecordType } from "./QuickRecordGrid";
import { RecentEvents } from "./RecentEvents";
import { TodaySummaryCards, type TodaySummaryCardSlot } from "./TodaySummaryCards";
import type { AppProfile, DisplayEventRecord, EventRecord, GrowthCurvePayload, ReferenceTargetItem, TodaySummary } from "../types";
import { localizedText, useI18n } from "../i18n";
import { formatNumber } from "../utils/format";
import { formatDateInTimezone, stageText } from "../utils/time";

type ProfilePreview = Pick<AppProfile, "child_name" | "child_birth_date" | "due_date" | "timezone" | "phase">;
type SessionPreview = Pick<EventRecord, "event_type" | "occurred_at">;
export type DailyRecordOverviewSection = "activeSessions" | "summaryCards" | "growthCurve" | "notice" | "quickRecord" | "sevenDayTrend" | "recentEvents";

const DEFAULT_OVERVIEW_SECTIONS: readonly DailyRecordOverviewSection[] = ["activeSessions", "summaryCards", "growthCurve", "notice", "quickRecord", "sevenDayTrend", "recentEvents"];

interface DailyRecordOverviewProps<TEvent extends DisplayEventRecord> {
  profile: ProfilePreview;
  title?: string;
  todaySummary: TodaySummary;
  growthCurve?: GrowthCurvePayload;
  last7DaysSummary?: TodaySummary[];
  referenceTargets?: ReferenceTargetItem[];
  recentEvents: TEvent[];
  openSleep: SessionPreview | null;
  openBreast: SessionPreview | null;
  busyType?: QuickRecordType | null;
  onLogout: () => void;
  onSleepAction?: () => void;
  onBreastAction?: () => void;
  onQuickAction?: (type: QuickRecordType) => void;
  quickActions?: ReadonlyArray<QuickRecordAction>;
  quickTitle?: string;
  quickMessage?: string;
  visibleSections?: readonly DailyRecordOverviewSection[];
  onCardSelect?: (slot: TodaySummaryCardSlot) => void;
  onEditEvent?: (event: TEvent) => void;
  onDeleteEvent?: (event: TEvent) => void;
}

export function DailyRecordOverview<TEvent extends DisplayEventRecord>({
  profile,
  title,
  todaySummary,
  growthCurve,
  last7DaysSummary,
  referenceTargets,
  recentEvents,
  openSleep,
  openBreast,
  busyType = null,
  onLogout,
  onSleepAction,
  onBreastAction,
  onQuickAction,
  quickActions,
  quickTitle,
  quickMessage,
  visibleSections = DEFAULT_OVERVIEW_SECTIONS,
  onCardSelect,
  onEditEvent,
  onDeleteEvent
}: DailyRecordOverviewProps<TEvent>) {
  const { text: tx } = useI18n();
  const timezone = profile.timezone;
  const quickActionsEnabled = Boolean(onQuickAction);
  const eventsEditable = Boolean(onEditEvent || onDeleteEvent);
  const sectionSet = new Set(visibleSections);

  return (
    <>
      <header className="record-header">
        <div>
          <p className="eyebrow">{formatDateInTimezone(new Date(), timezone)}</p>
          <h1>{title ?? profile.child_name ?? "Baby"}</h1>
          <p>{stageText(profile)}</p>
        </div>
        <button className="ghost small" type="button" onClick={onLogout}>
          {tx({ en: "Log out", zh: "退出" })}
        </button>
      </header>

      {sectionSet.has("activeSessions") ? (
        <>
          <ActiveSessionCard session={openSleep} timezone={timezone} busy={busyType === "sleep_session"} onWake={onSleepAction} />
          <ActiveSessionCard
            session={openBreast}
            timezone={timezone}
            title={tx({ en: "Breastfeeding", zh: "亲喂进行中" })}
            elapsedLabel={tx({ en: "for", zh: "已" })}
            actionLabel={tx({ en: "End breastfeed", zh: "结束亲喂" })}
            busy={busyType === "feed_breast"}
            onWake={onBreastAction}
          />
        </>
      ) : null}
      {sectionSet.has("summaryCards") ? <TodaySummaryCards summary={todaySummary} referenceTargets={referenceTargets} timezone={timezone} onCardSelect={onCardSelect} /> : null}
      {sectionSet.has("growthCurve") && growthCurve ? <GrowthCurvePanel growthCurve={growthCurve} /> : null}
      {sectionSet.has("notice") && todaySummary.system_flags.includes("temperature_high_neutral_notice") ? (
        <p className="notice">
          {tx({
            en: "A higher temperature value has been recorded. Use clinician advice for decisions; this app does not provide diagnosis.",
            zh: "已记录较高体温数值，请结合医生建议处理；本站不提供诊断。"
          })}
        </p>
      ) : null}
      {sectionSet.has("quickRecord") && quickActionsEnabled && onQuickAction ? (
        quickTitle ? (
          <section className="panel record-quick-panel">
            <div className="section-head">
              <h2>{quickTitle}</h2>
              {quickMessage ? <span>{quickMessage}</span> : null}
            </div>
            <QuickRecordGrid hasOpenSleep={Boolean(openSleep)} hasOpenBreast={Boolean(openBreast)} busyType={busyType} actions={quickActions} onAction={onQuickAction} />
          </section>
        ) : (
          <QuickRecordGrid hasOpenSleep={Boolean(openSleep)} hasOpenBreast={Boolean(openBreast)} busyType={busyType} actions={quickActions} onAction={onQuickAction} />
        )
      ) : null}
      {sectionSet.has("sevenDayTrend") && last7DaysSummary ? <SevenDayTrendSummary summaries={last7DaysSummary} /> : null}
      {sectionSet.has("recentEvents") ? <RecentEvents events={recentEvents} timezone={timezone} editable={eventsEditable} onEdit={onEditEvent} onDelete={onDeleteEvent} /> : null}
    </>
  );
}

function SevenDayTrendSummary({ summaries }: { summaries: TodaySummary[] }) {
  const { text: tx } = useI18n();
  const trends = buildSevenDayTrendCharts(summaries);
  return (
    <section className="panel">
      <div className="section-head">
        <h2>{tx({ en: "Past 7 days", zh: "过去 7 天" })}</h2>
        <span>{tx({ en: "{count} days", zh: "{count} 天" }, { count: summaries.length })}</span>
      </div>
      <div className="trend-chart-grid" aria-label={tx({ en: "Past 7 days trend charts", zh: "过去 7 天趋势图" })}>
        {trends.charts.map((chart) => (
          <article className="trend-chart-card" key={chart.key}>
            <header>
              <span>{chart.title}</span>
            </header>
            <div className="trend-bars">
              {chart.bars.map((bar) => (
                <div className={bar.isToday ? "today" : undefined} key={bar.key}>
                  <span className="trend-bar-value">{bar.displayValue}</span>
                  <span className="trend-bar-track" aria-label={`${bar.shortDate} ${bar.displayValue}`}>
                    <span className={`trend-bar-fill trend-bar-height-${bar.heightBucket}`} />
                  </span>
                  <span className="trend-bar-label">{bar.axisLabel}</span>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export interface SevenDayTrendChart {
  key: "feeding" | "formula" | "breastmilk" | "pee" | "poop" | "sleep" | "weight" | "length";
  title: string;
  bars: SevenDayTrendBar[];
}

export interface SevenDayTrendBar {
  key: string;
  shortDate: string;
  axisLabel: string;
  value: number | null;
  displayValue: string;
  heightPercent: number;
  heightBucket: number;
  isToday: boolean;
}

interface TrendMetricDefinition {
  key: SevenDayTrendChart["key"];
  title: () => string;
  value: (summary: TodaySummary) => number | null;
  display: (value: number) => string;
  scale?: "range";
}

export function buildSevenDayTrendCharts(summaries: TodaySummary[]): { charts: SevenDayTrendChart[] } {
  const ordered = [...summaries].sort((a, b) => a.date.localeCompare(b.date));
  const metrics: TrendMetricDefinition[] = [
    {
      key: "feeding",
      title: () => localizedText({ en: "Feeding count (times)", zh: "喂养次数(次)" }),
      value: (summary) => summary.feed_breast_count + summary.feed_bottle_count,
      display: (value) => `${value}`
    },
    {
      key: "formula",
      title: () => localizedText({ en: "Formula (ml)", zh: "配方奶(ml)" }),
      value: (summary) => summary.bottle_formula_ml_total,
      display: (value) => formatNumber(value)
    },
    {
      key: "breastmilk",
      title: () => localizedText({ en: "Expressed milk (ml)", zh: "母乳瓶喂(ml)" }),
      value: (summary) => summary.bottle_breastmilk_ml_total,
      display: (value) => formatNumber(value)
    },
    {
      key: "pee",
      title: () => localizedText({ en: "Pee (times)", zh: "小便(次)" }),
      value: (summary) => summary.pee_count,
      display: (value) => `${value}`
    },
    {
      key: "poop",
      title: () => localizedText({ en: "Poop (times)", zh: "大便(次)" }),
      value: (summary) => summary.poop_count,
      display: (value) => `${value}`
    },
    {
      key: "sleep",
      title: () => localizedText({ en: "Sleep duration (hr)", zh: "睡眠时长(小时)" }),
      value: (summary) => summary.sleep_minutes_total,
      display: formatHoursCompact
    },
    {
      key: "weight",
      title: () => localizedText({ en: "Weight (g)", zh: "体重(g)" }),
      value: (summary) => summary.growth.latest_weight_g,
      display: (value) => `${value}`,
      scale: "range"
    },
    {
      key: "length",
      title: () => localizedText({ en: "Length (cm)", zh: "身长(cm)" }),
      value: (summary) => summary.growth.latest_length_cm,
      display: (value) => formatNumber(value),
      scale: "range"
    }
  ];

  return {
    charts: metrics.map((metric) => buildTrendChart(metric, ordered))
  };
}

function buildTrendChart(metric: TrendMetricDefinition, summaries: TodaySummary[]): SevenDayTrendChart {
  const values = summaries.map(metric.value);
  const numericValues = values.filter((value): value is number => value != null);
  const maxValue = Math.max(0, ...numericValues);
  const minValue = Math.min(...numericValues);
  return {
    key: metric.key,
    title: metric.title(),
    bars: summaries.map((summary, index) => {
      const value = metric.value(summary);
      const heightPercent = barHeightPercent(value, { maxValue, minValue, scale: metric.scale });
      return {
        key: summary.date,
        shortDate: formatShortTrendDate(summary.date),
        axisLabel: index === summaries.length - 1 ? localizedText({ en: "Today", zh: "今天" }) : formatShortTrendDate(summary.date),
        value,
        displayValue: value == null ? "—" : metric.display(value),
        heightPercent,
        heightBucket: heightBucket(heightPercent),
        isToday: index === summaries.length - 1
      };
    })
  };
}

function barHeightPercent(value: number | null, { maxValue, minValue, scale }: { maxValue: number; minValue: number; scale?: "range" }): number {
  if (value == null || value <= 0 || maxValue <= 0) return 0;
  if (scale === "range") {
    if (maxValue === minValue) return 72;
    return Math.max(18, Math.round(((value - minValue) / (maxValue - minValue)) * 82) + 18);
  }
  return Math.max(14, Math.round((value / maxValue) * 100));
}

function formatHoursCompact(minutes: number): string {
  if (minutes <= 0) return "0";
  return (minutes / 60).toFixed(1);
}

function heightBucket(heightPercent: number): number {
  if (heightPercent <= 0) return 0;
  return Math.min(100, Math.max(10, Math.round(heightPercent / 5) * 5));
}

function formatShortTrendDate(date: string): string {
  const [, month, day] = date.split("-").map(Number);
  return `${month}/${day}`;
}

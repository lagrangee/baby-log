import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api, isUnauthorized } from "../api";
import { DailyRecordOverview, type DailyRecordOverviewSection } from "../components/DailyRecordOverview";
import { FAMILY_QUICK_ACTIONS, type QuickRecordType } from "../components/QuickRecordGrid";
import { Sheet } from "../components/Sheet";
import { TodayCardDetailSheet } from "../components/TodayCardDetailSheet";
import { getCurrentLanguage, LanguageToggle } from "../i18n";
import type { TodaySummaryCardSlot } from "../components/TodaySummaryCards";
import type { EventRecord, JsonRecord, ReadOnlySummaryPayload } from "../types";
import { localInputValueInTimezone, toIsoFromLocalInputInTimezone } from "../utils/time";

interface ReadOnlyPageProps {
  onLogout: () => void;
  onUnauthorized: () => void;
}

type ReadRecordAction = "feed_bottle" | "diaper_pee" | "diaper_poop" | "temperature" | "sleep_start" | "sleep_end";
type TimeMode = "quick" | "custom";
export type ReadOnlyTabKey = "today" | "record" | "last7" | "growth";

interface ReadRecordSheetState {
  quickType: QuickRecordType;
  action: ReadRecordAction;
  title: string;
}

export const READ_ONLY_TABS: ReadonlyArray<{ key: ReadOnlyTabKey; label: string }> = [
  readOnlyTab("today", { en: "Today", zh: "今天" }),
  readOnlyTab("record", { en: "Record", zh: "记录" }),
  readOnlyTab("last7", { en: "7 days", zh: "过去 7 天" }),
  readOnlyTab("growth", { en: "Growth", zh: "成长曲线" })
];

export function readOnlyOverviewSectionsForTab(tab: ReadOnlyTabKey): readonly DailyRecordOverviewSection[] {
  if (tab === "record") return ["quickRecord"];
  if (tab === "last7") return ["sevenDayTrend"];
  if (tab === "growth") return ["growthCurve"];
  return ["activeSessions", "summaryCards", "notice", "recentEvents"];
}

function readOnlyTab(key: ReadOnlyTabKey, label: Record<"en" | "zh", string>): { key: ReadOnlyTabKey; label: string } {
  return {
    key,
    get label() {
      return label[getCurrentLanguage()];
    }
  };
}

const TIME_OPTIONS = [
  { minutes: 0, label: "刚刚" },
  { minutes: 5, label: "5 分钟前" },
  { minutes: 15, label: "15 分钟前" },
  { minutes: 30, label: "30 分钟前" },
  { minutes: 60, label: "1 小时前" }
];
const BOTTLE_AMOUNTS = ["30", "60", "90", "120"];
const TEMPERATURE_VALUES = ["36.5", "36.8", "37.0", "37.3"];
const MILK_TYPE_OPTIONS = [
  { value: "formula", label: "配方奶" },
  { value: "breastmilk", label: "母乳瓶喂" }
] as const;

export function ReadOnlyPage({ onLogout, onUnauthorized }: ReadOnlyPageProps) {
  const [data, setData] = useState<ReadOnlySummaryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCard, setSelectedCard] = useState<TodaySummaryCardSlot | null>(null);
  const [recordSheet, setRecordSheet] = useState<ReadRecordSheetState | null>(null);
  const [recordBusyType, setRecordBusyType] = useState<QuickRecordType | null>(null);
  const [recordError, setRecordError] = useState("");
  const [recordMessage, setRecordMessage] = useState("");
  const [activeTab, setActiveTab] = useState<ReadOnlyTabKey>("today");
  const [timeMode, setTimeMode] = useState<TimeMode>("quick");
  const [offsetMinutes, setOffsetMinutes] = useState(0);
  const [customTime, setCustomTime] = useState("");
  const [amountValue, setAmountValue] = useState("");
  const [milkType, setMilkType] = useState<(typeof MILK_TYPE_OPTIONS)[number]["value"]>("formula");

  const load = useCallback(async () => {
    try {
      setError("");
      const next = await api<ReadOnlySummaryPayload>("/api/read/summary");
      setData(next);
    } catch (err) {
      if (isUnauthorized(err)) return onUnauthorized();
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [onUnauthorized]);

  useEffect(() => {
    void load();
  }, [load]);

  const openSleep = useMemo(
    () => data?.today_summary.open_sessions?.find((event) => event.event_type === "sleep_session") ?? null,
    [data]
  );
  const openBreast = useMemo(
    () => data?.today_summary.open_sessions?.find((event) => event.event_type === "feed_breast") ?? null,
    [data]
  );
  const timezone = data?.profile.timezone ?? "Asia/Shanghai";

  const openRecordSheet = useCallback(
    (type: QuickRecordType) => {
      const action = quickTypeToReadAction(type, Boolean(openSleep));
      if (!action) return;
      setRecordError("");
      setRecordMessage("");
      setTimeMode("quick");
      setOffsetMinutes(0);
      setCustomTime(localInputValueInTimezone(undefined, timezone));
      setAmountValue(defaultAmountValue(action));
      if (action === "feed_bottle") setMilkType("formula");
      setRecordSheet({ quickType: type, action, title: readActionTitle(action) });
    },
    [openSleep, timezone]
  );

  const submitRecord = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!recordSheet) return;
      try {
        setRecordBusyType(recordSheet.quickType);
        setRecordError("");
        const body: JsonRecord = {
          action: recordSheet.action,
          occurred_at:
            timeMode === "custom"
              ? toIsoFromLocalInputInTimezone(customTime, timezone)
              : new Date(Date.now() - offsetMinutes * 60_000).toISOString().replace(".000Z", "Z")
        };
        if (recordSheet.action === "feed_bottle" || recordSheet.action === "temperature") {
          const amount = Number(amountValue);
          if (!Number.isFinite(amount) || amount <= 0) throw new Error(recordSheet.action === "feed_bottle" ? "请填写奶量" : "请填写体温");
          body.amount_value = amount;
        }
        if (recordSheet.action === "feed_bottle") {
          body.milk_type = milkType;
        }
        await api<EventRecord>("/api/read/events", { method: "POST", body: JSON.stringify(body) });
        setRecordMessage(`${recordSheet.title}已记录`);
        setRecordSheet(null);
        await load();
      } catch (err) {
        if (isUnauthorized(err)) return onUnauthorized();
        setRecordError(err instanceof Error ? err.message : "记录失败");
      } finally {
        setRecordBusyType(null);
      }
    },
    [amountValue, customTime, load, milkType, offsetMinutes, onUnauthorized, recordSheet, timeMode, timezone]
  );

  const selectTab = useCallback((tab: ReadOnlyTabKey) => {
    setActiveTab(tab);
    setSelectedCard(null);
    setRecordSheet(null);
  }, []);

  if (loading) return <div className="loading">正在加载Baby Status...</div>;
  if (error || !data) {
    return (
      <main className="app-main">
        <section className="panel">
          <h1>Baby Status</h1>
          <p className="error-text">{error || "加载失败"}</p>
          <button className="primary" type="button" onClick={() => void load()}>
            重试
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="app-main read-only-main">
      <LanguageToggle />
      <DailyRecordOverview
        profile={data.profile}
        title={data.profile.child_name || data.title}
        todaySummary={data.today_summary}
        growthCurve={data.growth_curve}
        last7DaysSummary={data.last_7_days_summary}
        referenceTargets={data.reference_targets.items}
        recentEvents={data.recent_events}
        openSleep={openSleep}
        openBreast={openBreast}
        onLogout={onLogout}
        busyType={recordBusyType}
        onQuickAction={openRecordSheet}
        quickActions={FAMILY_QUICK_ACTIONS}
        quickTitle="帮忙记录"
        quickMessage={recordMessage}
        visibleSections={readOnlyOverviewSectionsForTab(activeTab)}
        onCardSelect={setSelectedCard}
      />

      <nav className="read-tabbar" aria-label="只读页分区">
        {READ_ONLY_TABS.map((tab) => (
          <button key={tab.key} type="button" className={activeTab === tab.key ? "active" : ""} aria-current={activeTab === tab.key ? "page" : undefined} onClick={() => selectTab(tab.key)}>
            {tab.label}
          </button>
        ))}
      </nav>

      {recordSheet ? (
        <Sheet title={recordSheet.title} onClose={() => setRecordSheet(null)}>
          <form className="stack family-record-form" onSubmit={submitRecord}>
            <div className="field-block">
              <span className="field-label">时间</span>
              <div className="choice-grid time-choice-grid">
                {TIME_OPTIONS.map((option) => (
                  <button
                    key={option.minutes}
                    type="button"
                    className={timeMode === "quick" && offsetMinutes === option.minutes ? "choice active" : "choice"}
                    onClick={() => {
                      setTimeMode("quick");
                      setOffsetMinutes(option.minutes);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <label>
              其他时间
              <input
                type="datetime-local"
                value={customTime}
                onChange={(event) => {
                  setTimeMode("custom");
                  setCustomTime(event.target.value);
                }}
              />
            </label>
            {recordSheet.action === "feed_bottle" ? (
              <div className="field-block">
                <span className="field-label">奶类型</span>
                <div className="choice-grid">
                  {MILK_TYPE_OPTIONS.map((option) => (
                    <button key={option.value} type="button" className={milkType === option.value ? "choice active" : "choice"} onClick={() => setMilkType(option.value)}>
                      {option.label}
                    </button>
                  ))}
                </div>
                <span className="field-label">奶量 ml</span>
                <div className="choice-grid">
                  {BOTTLE_AMOUNTS.map((value) => (
                    <button key={value} type="button" className={amountValue === value ? "choice active" : "choice"} onClick={() => setAmountValue(value)}>
                      {value}
                    </button>
                  ))}
                </div>
                <input aria-label="奶量 ml" type="number" min="1" step="1" inputMode="decimal" value={amountValue} onChange={(event) => setAmountValue(event.target.value)} required />
              </div>
            ) : null}
            {recordSheet.action === "temperature" ? (
              <div className="field-block">
                <span className="field-label">额温 °C</span>
                <div className="choice-grid">
                  {TEMPERATURE_VALUES.map((value) => (
                    <button key={value} type="button" className={amountValue === value ? "choice active" : "choice"} onClick={() => setAmountValue(value)}>
                      {value}
                    </button>
                  ))}
                </div>
                <input aria-label="额温 °C" type="number" min="30" max="45" step="0.1" inputMode="decimal" value={amountValue} onChange={(event) => setAmountValue(event.target.value)} required />
              </div>
            ) : null}
            {recordError ? <p className="error-text">{recordError}</p> : null}
            <div className="sheet-actions">
              <button className="ghost" type="button" onClick={() => setRecordSheet(null)}>
                取消
              </button>
              <button className="primary" type="submit" disabled={recordBusyType !== null}>
                记录
              </button>
            </div>
          </form>
        </Sheet>
      ) : null}

      {selectedCard ? (
        <TodayCardDetailSheet
          slot={selectedCard}
          day={{ summary: data.today_summary, events: data.today_events }}
          timezone={data.profile.timezone}
          onClose={() => setSelectedCard(null)}
        />
      ) : null}
    </main>
  );
}

function quickTypeToReadAction(type: QuickRecordType, hasOpenSleep: boolean): ReadRecordAction | null {
  if (type === "feed_bottle") return "feed_bottle";
  if (type === "diaper_pee") return "diaper_pee";
  if (type === "diaper_poop") return "diaper_poop";
  if (type === "temperature") return "temperature";
  if (type === "sleep_session") return hasOpenSleep ? "sleep_end" : "sleep_start";
  return null;
}

function readActionTitle(action: ReadRecordAction): string {
  if (action === "feed_bottle") return "记录奶瓶";
  if (action === "diaper_pee") return "记录小便";
  if (action === "diaper_poop") return "记录大便";
  if (action === "temperature") return "记录额温";
  if (action === "sleep_end") return "记录睡醒";
  return "记录睡着";
}

function defaultAmountValue(action: ReadRecordAction): string {
  if (action === "feed_bottle") return "60";
  if (action === "temperature") return "36.8";
  return "";
}

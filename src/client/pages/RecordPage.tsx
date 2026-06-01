import { useCallback, useEffect, useMemo, useState } from "react";
import { api, isUnauthorized } from "../api";
import { DailyRecordOverview } from "../components/DailyRecordOverview";
import { EventEditSheet } from "../components/EventEditSheet";
import { Sheet } from "../components/Sheet";
import { TodayCardDetailSheet, type TodayCardDetailData } from "../components/TodayCardDetailSheet";
import type { QuickRecordType } from "../components/QuickRecordGrid";
import type { TodaySummaryCardSlot } from "../components/TodaySummaryCards";
import type { BootstrapPayload, EventRecord, EventType, JsonRecord, PrimaryEventType, ShowToast, StatusDayPayload, TodaySummary } from "../types";
import { installAppResumeRefresh } from "../utils/app-resume-refresh";
import { localInputValueInTimezone, nowIso, toIsoFromLocalInputInTimezone } from "../utils/time";

type SheetType = "breast" | "pee" | "poop" | "bottle" | "sleep_start" | "sleep_end" | "temperature" | "medicine" | "note" | "growth";

interface RecordPageProps {
  onLogout: () => void;
  onUnauthorized: () => void;
  showToast: ShowToast;
}

export function RecordPage({ onLogout, onUnauthorized, showToast }: RecordPageProps) {
  const [data, setData] = useState<BootstrapPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyType, setBusyType] = useState<PrimaryEventType | null>(null);
  const [sheetType, setSheetType] = useState<SheetType | null>(null);
  const [sheetError, setSheetError] = useState("");
  const [sheetBusy, setSheetBusy] = useState(false);
  const [editing, setEditing] = useState<EventRecord | null>(null);
  const [editError, setEditError] = useState("");
  const [selectedCard, setSelectedCard] = useState<TodaySummaryCardSlot | null>(null);
  const [cardDetails, setCardDetails] = useState<StatusDayPayload | null>(null);
  const [cardDetailLoading, setCardDetailLoading] = useState(false);
  const [cardDetailError, setCardDetailError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const next = await api<BootstrapPayload>("/api/bootstrap");
      setData(next);
    } catch (err) {
      if (isUnauthorized(err)) {
        onUnauthorized();
        return;
      }
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [onUnauthorized]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => installAppResumeRefresh(() => void load()), [load]);

  const openSleep = useMemo(
    () => data?.today_summary.open_sessions?.find((event) => event.event_type === "sleep_session") ?? null,
    [data]
  );
  const openBreast = useMemo(
    () => data?.today_summary.open_sessions?.find((event) => event.event_type === "feed_breast") ?? null,
    [data]
  );

  async function createEvent(payload: JsonRecord): Promise<EventRecord> {
    return api<EventRecord>("/api/events", { method: "POST", body: JSON.stringify(payload) });
  }

  async function handleQuickAction(type: QuickRecordType) {
    if (type === "diaper_pee") return openSheet("pee");
    if (type === "diaper_poop") return openSheet("poop");
    if (type === "feed_bottle") return openSheet("bottle");
    if (type === "sleep_session") return openSheet(openSleep ? "sleep_end" : "sleep_start");
    if (type === "temperature") return openSheet("temperature");
    if (type === "medicine") return openSheet("medicine");
    if (type === "note") return openSheet("note");
    if (type === "growth_measurement") return openSheet("growth");

    setBusyType(type);
    try {
      if (type === "feed_breast") {
        if (openBreast) {
          await api(`/api/events/${openBreast.id}`, { method: "PATCH", body: JSON.stringify({ ended_at: nowIso() }) });
          await load();
          showToast("已结束亲喂");
          return;
        }
        openSheet("breast");
        return;
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "记录失败");
    } finally {
      setBusyType(null);
    }
  }

  async function endBreastSession() {
    if (!openBreast) return;
    setBusyType("feed_breast");
    try {
      await api(`/api/events/${openBreast.id}`, { method: "PATCH", body: JSON.stringify({ ended_at: nowIso() }) });
        await load();
      showToast("已结束亲喂");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "结束失败");
    } finally {
      setBusyType(null);
    }
  }

  function openSheet(nextSheet: SheetType) {
    setSheetError("");
    setSheetType(nextSheet);
  }

  async function loadCardDetails() {
    setCardDetailLoading(true);
    setCardDetailError("");
    try {
      const next = await api<StatusDayPayload>("/api/status/day?preset=today");
      setCardDetails(next);
    } catch (err) {
      if (isUnauthorized(err)) {
        onUnauthorized();
        return;
      }
      setCardDetailError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setCardDetailLoading(false);
    }
  }

  function openCardDetails(slot: TodaySummaryCardSlot) {
    setSelectedCard(slot);
    setCardDetails(null);
    void loadCardDetails();
  }

  async function submitSheet(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sheetType) return;
    if (!data) return;
    setSheetBusy(true);
    setSheetError("");
    try {
      if (sheetType === "sleep_end") {
        if (!openSleep) throw new Error("没有进行中的睡眠记录");
        const endedAt = toIsoFromLocalInputInTimezone(requiredText(new FormData(event.currentTarget), "occurred_at", "请选择时间"), data.profile.timezone);
        await api(`/api/events/${openSleep.id}`, { method: "PATCH", body: JSON.stringify({ ended_at: endedAt }) });
        setSheetType(null);
        await load();
        showToast("已记录睡醒");
        return;
      }
      const payload = sheetPayload(sheetType, new FormData(event.currentTarget), data.profile.timezone);
      const created = await createEvent(payload);
      setSheetType(null);
      await load();
      if (sheetType === "pee") {
        showToast("已记录小便", {
          label: "撤销",
          onClick: async () => {
            await api(`/api/events/${created.id}`, { method: "DELETE" });
            await load();
            showToast("已撤销小便");
          }
        });
      } else {
        showToast(recordedMessage(sheetType));
      }
    } catch (err) {
      setSheetError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSheetBusy(false);
    }
  }

  async function deleteEvent(event: EventRecord) {
    if (!window.confirm("删除这条记录？")) return;
    try {
      await api(`/api/events/${event.id}`, { method: "DELETE" });
      await load();
      if (selectedCard) await loadCardDetails();
      showToast("已删除记录");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "删除失败");
    }
  }

  async function submitEdit(payload: JsonRecord) {
    if (!editing) return;
    setEditError("");
    try {
      await api(`/api/events/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      setEditing(null);
      await load();
      if (selectedCard) await loadCardDetails();
      showToast("已保存记录");
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "保存失败");
    }
  }

  if (loading) return <div className="loading">正在加载今日操作台...</div>;
  if (error) {
    return (
      <section className="panel">
        <h1>今日操作台</h1>
        <p className="error-text">{error}</p>
        <button className="primary" type="button" onClick={() => void load()}>
          重试
        </button>
      </section>
    );
  }
  if (!data) return null;

  const timezone = data.profile.timezone;

  return (
    <>
      <DailyRecordOverview
        profile={data.profile}
        todaySummary={data.today_summary}
        growthCurve={data.growth_curve}
        referenceTargets={data.reference_targets?.items}
        recentEvents={data.recent_events}
        openSleep={openSleep}
        openBreast={openBreast}
        busyType={busyType}
        onLogout={onLogout}
        onSleepAction={() => void handleQuickAction("sleep_session")}
        onBreastAction={() => void endBreastSession()}
        onQuickAction={(type) => void handleQuickAction(type)}
        onCardSelect={openCardDetails}
        onEditEvent={(event) => {
          setEditError("");
          setEditing(event);
        }}
        onDeleteEvent={(event) => void deleteEvent(event)}
      />

      {sheetType ? (
        <Sheet title={sheetTitle(sheetType)} onClose={() => setSheetType(null)}>
          <form className="stack" onSubmit={submitSheet}>
            <label>
              {timeFieldLabel(sheetType)}
              <input name="occurred_at" type="datetime-local" defaultValue={localInputValueInTimezone(undefined, timezone)} required />
            </label>
            {sheetFields(sheetType)}
            {sheetError ? <p className="error-text">{sheetError}</p> : null}
            <div className="sheet-actions">
              <button className="ghost" type="button" onClick={() => setSheetType(null)}>
                取消
              </button>
              <button className="primary" type="submit" disabled={sheetBusy}>
                记录
              </button>
            </div>
          </form>
        </Sheet>
      ) : null}
      {selectedCard ? (
        <TodayCardDetailSheet
          slot={selectedCard}
          day={cardDetails ? statusDayToCardDetails(cardDetails) : null}
          timezone={timezone}
          loading={cardDetailLoading}
          error={cardDetailError}
          editable
          onClose={() => setSelectedCard(null)}
          onRetry={() => void loadCardDetails()}
          onEdit={(event) => {
            setEditError("");
            setEditing(event);
          }}
        />
      ) : null}
      {editing ? <EventEditSheet event={editing} timezone={timezone} error={editError} onClose={() => setEditing(null)} onSubmit={submitEdit} /> : null}
    </>
  );
}

function statusDayToCardDetails(day: StatusDayPayload): TodayCardDetailData<EventRecord> {
  return {
    summary: day.summary,
    events: day.events
  };
}

function sheetPayload(type: SheetType, formData: FormData, timezone: string): JsonRecord {
  const occurredAt = toIsoFromLocalInputInTimezone(requiredText(formData, "occurred_at", "请选择时间"), timezone);
  const payload: JsonRecord = { occurred_at: occurredAt, details_json: {} };
  const details: JsonRecord = {};

  if (type === "breast") {
    const mode = text(formData, "breast_mode") || "quick";
    const endedAtInput = text(formData, "ended_at");
    const duration = optionalPositiveNumber(formData, "duration_min", "持续分钟需要大于 0");
    if (mode === "backfill" && !endedAtInput && duration == null) throw new Error("补记亲喂需要填写结束时间或持续分钟");
    details.session_mode = mode === "quick" ? "count_only" : "timed";
    setIfText(details, "side", formData.get("side"));
    if (mode === "backfill" && duration != null) details.duration_min = duration;
    setIfText(details, "effective_suck", formData.get("effective_suck"));
    setIfText(details, "baby_state_after", formData.get("baby_state_after"));
    setIfText(details, "spit_up", formData.get("spit_up"));
    const endedAt =
      mode === "backfill" && endedAtInput
        ? toIsoFromLocalInputInTimezone(endedAtInput, timezone)
        : mode === "backfill" && duration != null
          ? isoPlusMinutes(occurredAt, duration)
          : null;
    return {
      ...payload,
      event_type: "feed_breast",
      ended_at: endedAt,
      note: nullableText(formData, "note"),
      details_json: details
    };
  }

  if (type === "pee") {
    return {
      ...payload,
      event_type: "diaper_pee",
      note: nullableText(formData, "note"),
      details_json: details
    };
  }

  if (type === "sleep_start") {
    return {
      ...payload,
      event_type: "sleep_session",
      note: nullableText(formData, "note"),
      details_json: details
    };
  }

  if (type === "poop") {
    setIfText(details, "color", formData.get("color"));
    setIfText(details, "texture", formData.get("texture"));
    return {
      ...payload,
      event_type: "diaper_poop",
      note: nullableText(formData, "note"),
      details_json: details
    };
  }

  if (type === "bottle") {
    const amount = requiredNumber(formData, "amount_value", "请填写奶量");
    setIfText(details, "milk_type", formData.get("milk_type"));
    return {
      ...payload,
      event_type: "feed_bottle",
      amount_value: amount,
      amount_unit: "ml",
      note: nullableText(formData, "note"),
      details_json: details
    };
  }

  if (type === "temperature") {
    const amount = requiredNumber(formData, "amount_value", "请填写体温");
    setIfText(details, "method", formData.get("method"));
    return {
      ...payload,
      event_type: "temperature",
      amount_value: amount,
      amount_unit: "celsius",
      note: nullableText(formData, "note"),
      details_json: details
    };
  }

  if (type === "medicine") {
    const name = text(formData, "name");
    const dose = text(formData, "dose");
    if (!name && !dose) throw new Error("请填写药名或剂量");
    setIfText(details, "name", name);
    setIfText(details, "dose", dose);
    setIfText(details, "route", formData.get("route"));
    setIfText(details, "reason", formData.get("reason"));
    return {
      ...payload,
      event_type: "medicine",
      note: nullableText(formData, "note"),
      details_json: details
    };
  }

  if (type === "growth") {
    details.measure_type = requiredText(formData, "measure_type", "请选择测量类型");
    return {
      ...payload,
      event_type: "growth_measurement",
      amount_value: requiredNumber(formData, "amount_value", "请填写数值"),
      note: nullableText(formData, "note"),
      details_json: details
    };
  }

  const note = requiredText(formData, "note", "请填写备注");
  return {
    ...payload,
    event_type: "note",
    note,
    details_json: details
  };
}

function sheetFields(type: SheetType) {
  if (type === "breast") {
    return <BreastFields />;
  }

  if (type === "pee" || type === "sleep_start" || type === "sleep_end") {
    return (
      <label>
        备注
        <textarea name="note" />
      </label>
    );
  }

  if (type === "poop") {
    return (
      <>
        <label>
          颜色
          <select name="color">
            <option value="">未填</option>
            <option value="black_tar">黑色柏油样</option>
            <option value="green">绿色</option>
            <option value="yellow">黄色</option>
            <option value="brown">棕色</option>
            <option value="red">红色</option>
            <option value="white">白色</option>
            <option value="other">其他</option>
          </select>
        </label>
        <label>
          性状
          <select name="texture">
            <option value="">未填</option>
            <option value="watery">水样</option>
            <option value="loose">稀</option>
            <option value="seedy">颗粒</option>
            <option value="pasty">糊状</option>
            <option value="hard">硬</option>
            <option value="mucus">黏液</option>
            <option value="other">其他</option>
          </select>
        </label>
        <label>
          备注
          <textarea name="note" />
        </label>
      </>
    );
  }

  if (type === "bottle") {
    return (
      <>
        <label>
          奶量 ml
          <input name="amount_value" type="number" min="1" step="1" inputMode="decimal" required />
        </label>
        <label>
          类型
          <select name="milk_type">
            <option value="">未填</option>
            <option value="formula">配方</option>
            <option value="breastmilk">母乳</option>
            <option value="mixed">混合</option>
            <option value="other">其他</option>
          </select>
        </label>
        <label>
          备注
          <textarea name="note" />
        </label>
      </>
    );
  }

  if (type === "temperature") {
    return (
      <>
        <label>
          体温 °C
          <input name="amount_value" type="number" min="30" max="45" step="0.1" inputMode="decimal" required />
        </label>
        <label>
          方式
          <select name="method">
            <option value="">未填</option>
            <option value="rectal">肛温</option>
            <option value="ear">耳温</option>
            <option value="forehead">额温</option>
            <option value="armpit">腋温</option>
            <option value="oral">口温</option>
            <option value="other">其他</option>
          </select>
        </label>
        <label>
          备注
          <textarea name="note" />
        </label>
      </>
    );
  }

  if (type === "medicine") {
    return (
      <>
        <label>
          药名
          <input name="name" autoComplete="off" />
        </label>
        <label>
          剂量
          <input name="dose" placeholder="例如 1 ml、半片、5 滴" autoComplete="off" />
        </label>
        <label>
          途径
          <select name="route">
            <option value="">未填</option>
            <option value="oral">口服</option>
            <option value="nasal">鼻用</option>
            <option value="topical">外用</option>
            <option value="rectal">直肠</option>
            <option value="other">其他</option>
          </select>
        </label>
        <label>
          原因
          <input name="reason" autoComplete="off" />
        </label>
        <label>
          备注
          <textarea name="note" />
        </label>
      </>
    );
  }

  if (type === "growth") {
    return (
      <>
        <label>
          类型
          <select name="measure_type" defaultValue="weight_kg" required>
            <option value="weight_kg">体重 kg</option>
            <option value="length_cm">身长 cm</option>
            <option value="head_circumference_cm">头围 cm</option>
          </select>
        </label>
        <label>
          数值
          <input name="amount_value" type="number" step="0.001" inputMode="decimal" required />
        </label>
        <label>
          备注
          <textarea name="note" />
        </label>
      </>
    );
  }

  return (
    <label>
      备注
      <textarea name="note" required />
    </label>
  );
}

function BreastFields() {
  const [mode, setMode] = useState("quick");
  return (
    <>
      <label>
        模式
        <select name="breast_mode" value={mode} onChange={(event) => setMode(event.target.value)}>
          <option value="quick">快速记一次</option>
          <option value="start">开始亲喂</option>
          <option value="backfill">补记亲喂</option>
        </select>
      </label>
      {mode === "backfill" ? (
        <>
          <label>
            结束时间
            <input name="ended_at" type="datetime-local" />
          </label>
          <label>
            持续分钟
            <input name="duration_min" type="number" min="1" max="240" step="1" inputMode="numeric" />
          </label>
        </>
      ) : null}
      <label>
        侧别
        <select name="side" defaultValue="unknown">
          <option value="unknown">未知</option>
          <option value="left">左侧</option>
          <option value="right">右侧</option>
          <option value="both">双侧</option>
        </select>
      </label>
      {mode !== "quick" ? (
        <>
          <label>
            有效吸吮
            <select name="effective_suck">
              <option value="">未填</option>
              <option value="yes">是</option>
              <option value="no">否</option>
              <option value="unknown">未知</option>
            </select>
          </label>
          <label>
            喂后状态
            <select name="baby_state_after">
              <option value="">未填</option>
              <option value="satisfied">满足</option>
              <option value="sleepy">困了</option>
              <option value="still_hungry">仍像没吃够</option>
              <option value="unknown">未知</option>
            </select>
          </label>
          <label>
            吐奶
            <select name="spit_up">
              <option value="">未填</option>
              <option value="none">无</option>
              <option value="small">少量</option>
              <option value="large">较多</option>
              <option value="unknown">未知</option>
            </select>
          </label>
        </>
      ) : null}
      <label>
        备注
        <textarea name="note" />
      </label>
    </>
  );
}

function sheetTitle(type: SheetType): string {
  if (type === "breast") return "记录母乳亲喂";
  if (type === "pee") return "记录小便";
  if (type === "poop") return "记录大便";
  if (type === "bottle") return "记录奶瓶";
  if (type === "sleep_start") return "开始睡觉";
  if (type === "sleep_end") return "记录睡醒";
  if (type === "temperature") return "记录体温";
  if (type === "medicine") return "记录用药";
  if (type === "growth") return "记录生长测量";
  return "记录备注";
}

function recordedMessage(type: SheetType): string {
  if (type === "breast") return "已记录母乳亲喂";
  if (type === "sleep_start") return "已开始睡觉";
  if (type === "poop") return "已记录大便";
  if (type === "bottle") return "已记录奶瓶";
  if (type === "temperature") return "已记录体温";
  if (type === "medicine") return "已记录用药";
  if (type === "growth") return "已记录生长测量";
  return "已记录备注";
}

function timeFieldLabel(type: SheetType): string {
  if (type === "sleep_start") return "入睡时间";
  if (type === "sleep_end") return "醒来时间";
  return "时间";
}

function requiredText(formData: FormData, key: string, message: string): string {
  const value = text(formData, key);
  if (!value) throw new Error(message);
  return value;
}

function requiredNumber(formData: FormData, key: string, message: string): number {
  const value = Number(text(formData, key));
  if (!Number.isFinite(value) || value <= 0) throw new Error(message);
  return value;
}

function optionalPositiveNumber(formData: FormData, key: string, message: string): number | null {
  const raw = text(formData, key);
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) throw new Error(message);
  return value;
}

function nullableText(formData: FormData, key: string): string | null {
  return text(formData, key) || null;
}

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function setIfText(target: JsonRecord, key: string, value: FormDataEntryValue | string | null) {
  const next = typeof value === "string" ? value.trim() : "";
  if (next) target[key] = next;
}

function isoPlusMinutes(iso: string, minutes: number): string {
  return new Date(Date.parse(iso) + minutes * 60_000).toISOString().replace(".000Z", "Z");
}

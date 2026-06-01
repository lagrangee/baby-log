import { Sheet } from "./Sheet";
import type { FormEvent } from "react";
import { localizedText, useI18n } from "../i18n";
import type { EventRecord, JsonRecord } from "../types";
import { EVENT_LABELS } from "../utils/format";
import { localInputValueInTimezone, toIsoFromLocalInputInTimezone } from "../utils/time";

interface EventEditSheetProps {
  event: EventRecord;
  timezone: string;
  error: string;
  onClose: () => void;
  onSubmit: (payload: JsonRecord) => Promise<void>;
}

export function EventEditSheet({ event, timezone, error, onClose, onSubmit }: EventEditSheetProps) {
  const { text: tx } = useI18n();

  async function submit(eventSubmit: FormEvent<HTMLFormElement>) {
    eventSubmit.preventDefault();
    await onSubmit(editPayload(event, new FormData(eventSubmit.currentTarget), timezone));
  }

  return (
    <Sheet title={tx({ en: "Edit {label}", zh: "编辑{label}" }, { label: EVENT_LABELS[event.event_type] })} onClose={onClose}>
      <form className="stack" onSubmit={(formEvent) => void submit(formEvent)}>
        <label>
          {tx({ en: "Time", zh: "时间" })}
          <input name="occurred_at" type="datetime-local" defaultValue={localInputValueInTimezone(event.occurred_at, timezone)} required />
        </label>
        <EditFields event={event} timezone={timezone} />
        <details>
          <summary>{tx({ en: "Advanced JSON", zh: "高级 JSON" })}</summary>
          <textarea name="details_json_advanced" defaultValue={JSON.stringify(event.details_json ?? {}, null, 2)} />
        </details>
        {error ? <p className="error-text">{error}</p> : null}
        <div className="sheet-actions">
          <button className="ghost" type="button" onClick={onClose}>
            {tx({ en: "Cancel", zh: "取消" })}
          </button>
          <button className="primary" type="submit">
            {tx({ en: "Save", zh: "保存" })}
          </button>
        </div>
      </form>
    </Sheet>
  );
}

function EditFields({ event, timezone }: { event: EventRecord; timezone: string }) {
  const details = event.details_json ?? {};
  const endInput = event.ended_at ? localInputValueInTimezone(event.ended_at, timezone) : "";
  if (event.event_type === "feed_breast") {
    return (
      <>
        <label>{localizedText({ en: "Record mode", zh: "记录模式" })}<Select name="session_mode" value={breastSessionMode(event)} options={[["timed", localizedText({ en: "Timed breastfeed", zh: "计时亲喂" })], ["count_only", localizedText({ en: "Quick count", zh: "快速记一次" })]]} /></label>
        <label>{localizedText({ en: "End time", zh: "结束时间" })}<input name="ended_at" type="datetime-local" defaultValue={endInput} /></label>
        <label>{localizedText({ en: "Duration minutes", zh: "持续分钟" })}<input name="duration_min" type="number" min="1" max="240" step="1" defaultValue={numberDetail(details.duration_min)} /></label>
        <label>{localizedText({ en: "Side", zh: "侧别" })}<Select name="side" value={stringDetail(details.side)} options={emptyOption([["left", { en: "left", zh: "左侧" }], ["right", { en: "right", zh: "右侧" }], ["both", { en: "both", zh: "双侧" }], ["unknown", { en: "unknown", zh: "未知" }]])} /></label>
        <label>{localizedText({ en: "Effective suck", zh: "有效吸吮" })}<Select name="effective_suck" value={stringDetail(details.effective_suck)} options={emptyOption([["yes", { en: "yes", zh: "是" }], ["no", { en: "no", zh: "否" }], ["unknown", { en: "unknown", zh: "未知" }]])} /></label>
        <label>{localizedText({ en: "State after feeding", zh: "喂后状态" })}<Select name="baby_state_after" value={stringDetail(details.baby_state_after)} options={emptyOption([["satisfied", { en: "satisfied", zh: "满足" }], ["sleepy", { en: "sleepy", zh: "困了" }], ["still_hungry", { en: "still hungry", zh: "仍像没吃够" }], ["unknown", { en: "unknown", zh: "未知" }]])} /></label>
        <label>{localizedText({ en: "Spit-up", zh: "吐奶" })}<Select name="spit_up" value={stringDetail(details.spit_up)} options={emptyOption([["none", { en: "none", zh: "无" }], ["small", { en: "small", zh: "少量" }], ["large", { en: "large", zh: "较多" }], ["unknown", { en: "unknown", zh: "未知" }]])} /></label>
        <NoteField event={event} />
      </>
    );
  }
  if (event.event_type === "feed_bottle") {
    return (
      <>
        <label>{localizedText({ en: "Bottle amount ml", zh: "奶量 ml" })}<input name="amount_value" type="number" min="1" step="1" defaultValue={event.amount_value ?? ""} required /></label>
        <label>{localizedText({ en: "Milk type", zh: "奶类型" })}<Select name="milk_type" value={stringDetail(details.milk_type)} options={emptyOption([["formula", { en: "formula", zh: "配方" }], ["breastmilk", { en: "expressed milk", zh: "母乳瓶喂" }], ["mixed", { en: "mixed", zh: "混合" }], ["other", { en: "other", zh: "其他" }]])} /></label>
        <NoteField event={event} />
      </>
    );
  }
  if (event.event_type === "diaper_poop") {
    return (
      <>
        <label>{localizedText({ en: "Color", zh: "颜色" })}<Select name="color" value={stringDetail(details.color)} options={emptyOption([["black_tar", { en: "black/tarry", zh: "黑色柏油样" }], ["green", { en: "green", zh: "绿色" }], ["yellow", { en: "yellow", zh: "黄色" }], ["brown", { en: "brown", zh: "棕色" }], ["red", { en: "red", zh: "红色" }], ["white", { en: "white", zh: "白色" }], ["other", { en: "other", zh: "其他" }]])} /></label>
        <label>{localizedText({ en: "Texture", zh: "性状" })}<Select name="texture" value={stringDetail(details.texture)} options={emptyOption([["watery", { en: "watery", zh: "水样" }], ["loose", { en: "loose", zh: "稀" }], ["seedy", { en: "seedy", zh: "颗粒" }], ["pasty", { en: "pasty", zh: "糊状" }], ["hard", { en: "hard", zh: "硬" }], ["mucus", { en: "mucus", zh: "黏液" }], ["other", { en: "other", zh: "其他" }]])} /></label>
        <NoteField event={event} />
      </>
    );
  }
  if (event.event_type === "temperature") {
    return (
      <>
        <label>{localizedText({ en: "Temperature °C", zh: "体温 °C" })}<input name="amount_value" type="number" min="30" max="45" step="0.1" defaultValue={event.amount_value ?? ""} required /></label>
        <label>{localizedText({ en: "Method", zh: "测量方式" })}<Select name="method" value={stringDetail(details.method)} options={emptyOption([["rectal", { en: "rectal", zh: "肛温" }], ["ear", { en: "ear", zh: "耳温" }], ["forehead", { en: "forehead", zh: "额温" }], ["armpit", { en: "armpit", zh: "腋温" }], ["oral", { en: "oral", zh: "口温" }], ["other", { en: "other", zh: "其他" }]])} /></label>
        <NoteField event={event} />
      </>
    );
  }
  if (event.event_type === "sleep_session" || event.event_type === "tummy_time") {
    return (
      <>
        <label>{localizedText({ en: "End time", zh: "结束时间" })}<input name="ended_at" type="datetime-local" defaultValue={endInput} /></label>
        <NoteField event={event} />
      </>
    );
  }
  if (event.event_type === "growth_measurement") {
    return (
      <>
        <label>{localizedText({ en: "Type", zh: "类型" })}<Select name="measure_type" value={stringDetail(details.measure_type)} options={[["weight_kg", localizedText({ en: "Weight kg", zh: "体重 kg" })], ["length_cm", localizedText({ en: "Length cm", zh: "身长 cm" })], ["head_circumference_cm", localizedText({ en: "Head circumference cm", zh: "头围 cm" })]]} /></label>
        <label>{localizedText({ en: "Value", zh: "数值" })}<input name="amount_value" type="number" step="0.001" defaultValue={event.amount_value ?? ""} required /></label>
        <NoteField event={event} />
      </>
    );
  }
  if (event.event_type === "symptom") {
    return (
      <>
        <label>{localizedText({ en: "Tags", zh: "标签" })}<input name="symptom_tags" defaultValue={Array.isArray(details.symptom_tags) ? details.symptom_tags.join(localizedText({ en: ", ", zh: "、" })) : ""} /></label>
        <label>{localizedText({ en: "Severity", zh: "严重程度" })}<Select name="severity" value={stringDetail(details.severity)} options={emptyOption([["mild", { en: "mild", zh: "轻微" }], ["moderate", { en: "moderate", zh: "中等" }], ["severe", { en: "severe", zh: "较重" }], ["unknown", { en: "unknown", zh: "未知" }]])} /></label>
        <NoteField event={event} />
      </>
    );
  }
  if (event.event_type === "medicine") {
    return (
      <>
        <label>{localizedText({ en: "Medicine name", zh: "药名" })}<input name="name" defaultValue={stringDetail(details.name)} /></label>
        <label>{localizedText({ en: "Dose", zh: "剂量" })}<input name="dose" defaultValue={stringDetail(details.dose)} /></label>
        <label>{localizedText({ en: "Route", zh: "途径" })}<Select name="route" value={stringDetail(details.route)} options={emptyOption([["oral", { en: "oral", zh: "口服" }], ["nasal", { en: "nasal", zh: "鼻用" }], ["topical", { en: "topical", zh: "外用" }], ["rectal", { en: "rectal", zh: "直肠" }], ["other", { en: "other", zh: "其他" }]])} /></label>
        <label>{localizedText({ en: "Reason", zh: "原因" })}<input name="reason" defaultValue={stringDetail(details.reason)} /></label>
        <NoteField event={event} />
      </>
    );
  }
  return <NoteField event={event} required={event.event_type === "note"} />;
}

function Select({ name, value, options }: { name: string; value: string; options: Array<[string, string]> }) {
  return (
    <select name={name} defaultValue={value}>
      {options.map(([optionValue, label]) => (
        <option key={optionValue} value={optionValue}>{label}</option>
      ))}
    </select>
  );
}

function NoteField({ event, required = false }: { event: EventRecord; required?: boolean }) {
  return (
    <label>
      {localizedText({ en: "Note", zh: "备注" })}
      <textarea name="note" defaultValue={event.note ?? ""} required={required} />
    </label>
  );
}

function editPayload(event: EventRecord, formData: FormData, timezone: string): JsonRecord {
  const details = parseAdvancedDetails(formData);
  const payload: JsonRecord = {
    occurred_at: toIsoFromLocalInputInTimezone(requiredText(formData, "occurred_at"), timezone),
    ended_at: text(formData, "ended_at") ? toIsoFromLocalInputInTimezone(text(formData, "ended_at"), timezone) : null,
    amount_value: null,
    amount_unit: null,
    note: text(formData, "note") || null,
    details_json: details
  };
  if (event.event_type === "feed_breast") {
    const sessionMode = text(formData, "session_mode") === "count_only" ? "count_only" : "timed";
    details.session_mode = sessionMode;
    if (sessionMode === "count_only") {
      payload.ended_at = null;
      delete details.duration_min;
    } else {
      setIfNumber(details, "duration_min", formData.get("duration_min"));
    }
    setIfText(details, "side", formData.get("side"));
    setIfText(details, "effective_suck", formData.get("effective_suck"));
    setIfText(details, "baby_state_after", formData.get("baby_state_after"));
    setIfText(details, "spit_up", formData.get("spit_up"));
  } else if (event.event_type === "feed_bottle") {
    payload.amount_value = requiredNumber(formData, "amount_value");
    payload.amount_unit = "ml";
    setIfText(details, "milk_type", formData.get("milk_type"));
  } else if (event.event_type === "diaper_poop") {
    setIfText(details, "color", formData.get("color"));
    setIfText(details, "texture", formData.get("texture"));
  } else if (event.event_type === "temperature") {
    payload.amount_value = requiredNumber(formData, "amount_value");
    payload.amount_unit = "celsius";
    setIfText(details, "method", formData.get("method"));
  } else if (event.event_type === "growth_measurement") {
    payload.amount_value = requiredNumber(formData, "amount_value");
    setIfText(details, "measure_type", formData.get("measure_type"));
  } else if (event.event_type === "symptom") {
    const tags = text(formData, "symptom_tags").split(/[、,，\s]+/).map((item) => item.trim()).filter(Boolean);
    if (tags.length) details.symptom_tags = tags;
    setIfText(details, "severity", formData.get("severity"));
  } else if (event.event_type === "medicine") {
    setIfText(details, "name", formData.get("name"));
    setIfText(details, "dose", formData.get("dose"));
    setIfText(details, "route", formData.get("route"));
    setIfText(details, "reason", formData.get("reason"));
  }
  return payload;
}

function parseAdvancedDetails(formData: FormData): JsonRecord {
  const raw = text(formData, "details_json_advanced");
  if (!raw) return {};
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(localizedText({ en: "Advanced JSON must be an object", zh: "高级 JSON 必须是对象" }));
  return { ...(parsed as JsonRecord) };
}

function requiredText(formData: FormData, key: string): string {
  const value = text(formData, key);
  if (!value) throw new Error(localizedText({ en: "Please fill in the required field", zh: "请填写必填字段" }));
  return value;
}

function requiredNumber(formData: FormData, key: string): number {
  const value = Number(requiredText(formData, key));
  if (!Number.isFinite(value) || value <= 0) throw new Error(localizedText({ en: "Please enter a valid number", zh: "请填写有效数值" }));
  return value;
}

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function setIfText(target: JsonRecord, key: string, value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value.trim() : "";
  if (next) target[key] = next;
  else delete target[key];
}

function setIfNumber(target: JsonRecord, key: string, value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) {
    delete target[key];
    return;
  }
  const next = Number(raw);
  if (!Number.isFinite(next) || next <= 0) throw new Error(localizedText({ en: "Duration minutes must be greater than 0", zh: "持续分钟需要大于 0" }));
  target[key] = next;
}

function stringDetail(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function emptyOption(options: Array<[string, Record<"en" | "zh", string>]>): Array<[string, string]> {
  return [["", localizedText({ en: "Not set", zh: "未填" })], ...options.map(([value, label]) => [value, localizedText(label)] as [string, string])];
}

function numberDetail(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

function breastSessionMode(event: EventRecord): "timed" | "count_only" {
  if (event.details_json?.session_mode === "timed" || event.details_json?.session_mode === "count_only") {
    return event.details_json.session_mode;
  }
  return event.ended_at || numberDetail(event.details_json?.duration_min) ? "timed" : "count_only";
}

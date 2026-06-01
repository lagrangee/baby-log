import { Sheet } from "./Sheet";
import type { FormEvent } from "react";
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
  async function submit(eventSubmit: FormEvent<HTMLFormElement>) {
    eventSubmit.preventDefault();
    await onSubmit(editPayload(event, new FormData(eventSubmit.currentTarget), timezone));
  }

  return (
    <Sheet title={`编辑${EVENT_LABELS[event.event_type]}`} onClose={onClose}>
      <form className="stack" onSubmit={(formEvent) => void submit(formEvent)}>
        <label>
          时间
          <input name="occurred_at" type="datetime-local" defaultValue={localInputValueInTimezone(event.occurred_at, timezone)} required />
        </label>
        <EditFields event={event} timezone={timezone} />
        <details>
          <summary>高级 JSON</summary>
          <textarea name="details_json_advanced" defaultValue={JSON.stringify(event.details_json ?? {}, null, 2)} />
        </details>
        {error ? <p className="error-text">{error}</p> : null}
        <div className="sheet-actions">
          <button className="ghost" type="button" onClick={onClose}>
            取消
          </button>
          <button className="primary" type="submit">
            保存
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
        <label>记录模式<Select name="session_mode" value={breastSessionMode(event)} options={[["timed", "计时亲喂"], ["count_only", "快速记一次"]]} /></label>
        <label>结束时间<input name="ended_at" type="datetime-local" defaultValue={endInput} /></label>
        <label>持续分钟<input name="duration_min" type="number" min="1" max="240" step="1" defaultValue={numberDetail(details.duration_min)} /></label>
        <label>侧别<Select name="side" value={stringDetail(details.side)} options={[["", "未填"], ["left", "左侧"], ["right", "右侧"], ["both", "双侧"], ["unknown", "未知"]]} /></label>
        <label>有效吸吮<Select name="effective_suck" value={stringDetail(details.effective_suck)} options={[["", "未填"], ["yes", "是"], ["no", "否"], ["unknown", "未知"]]} /></label>
        <label>喂后状态<Select name="baby_state_after" value={stringDetail(details.baby_state_after)} options={[["", "未填"], ["satisfied", "满足"], ["sleepy", "困了"], ["still_hungry", "仍像没吃够"], ["unknown", "未知"]]} /></label>
        <label>吐奶<Select name="spit_up" value={stringDetail(details.spit_up)} options={[["", "未填"], ["none", "无"], ["small", "少量"], ["large", "较多"], ["unknown", "未知"]]} /></label>
        <NoteField event={event} />
      </>
    );
  }
  if (event.event_type === "feed_bottle") {
    return (
      <>
        <label>奶量 ml<input name="amount_value" type="number" min="1" step="1" defaultValue={event.amount_value ?? ""} required /></label>
        <label>奶类型<Select name="milk_type" value={stringDetail(details.milk_type)} options={[["", "未填"], ["formula", "配方"], ["breastmilk", "母乳瓶喂"], ["mixed", "混合"], ["other", "其他"]]} /></label>
        <NoteField event={event} />
      </>
    );
  }
  if (event.event_type === "diaper_poop") {
    return (
      <>
        <label>颜色<Select name="color" value={stringDetail(details.color)} options={[["", "未填"], ["black_tar", "黑色柏油样"], ["green", "绿色"], ["yellow", "黄色"], ["brown", "棕色"], ["red", "红色"], ["white", "白色"], ["other", "其他"]]} /></label>
        <label>性状<Select name="texture" value={stringDetail(details.texture)} options={[["", "未填"], ["watery", "水样"], ["loose", "稀"], ["seedy", "颗粒"], ["pasty", "糊状"], ["hard", "硬"], ["mucus", "黏液"], ["other", "其他"]]} /></label>
        <NoteField event={event} />
      </>
    );
  }
  if (event.event_type === "temperature") {
    return (
      <>
        <label>体温 °C<input name="amount_value" type="number" min="30" max="45" step="0.1" defaultValue={event.amount_value ?? ""} required /></label>
        <label>测量方式<Select name="method" value={stringDetail(details.method)} options={[["", "未填"], ["rectal", "肛温"], ["ear", "耳温"], ["forehead", "额温"], ["armpit", "腋温"], ["oral", "口温"], ["other", "其他"]]} /></label>
        <NoteField event={event} />
      </>
    );
  }
  if (event.event_type === "sleep_session" || event.event_type === "tummy_time") {
    return (
      <>
        <label>结束时间<input name="ended_at" type="datetime-local" defaultValue={endInput} /></label>
        <NoteField event={event} />
      </>
    );
  }
  if (event.event_type === "growth_measurement") {
    return (
      <>
        <label>类型<Select name="measure_type" value={stringDetail(details.measure_type)} options={[["weight_kg", "体重 kg"], ["length_cm", "身长 cm"], ["head_circumference_cm", "头围 cm"]]} /></label>
        <label>数值<input name="amount_value" type="number" step="0.001" defaultValue={event.amount_value ?? ""} required /></label>
        <NoteField event={event} />
      </>
    );
  }
  if (event.event_type === "symptom") {
    return (
      <>
        <label>标签<input name="symptom_tags" defaultValue={Array.isArray(details.symptom_tags) ? details.symptom_tags.join("、") : ""} /></label>
        <label>严重程度<Select name="severity" value={stringDetail(details.severity)} options={[["", "未填"], ["mild", "轻微"], ["moderate", "中等"], ["severe", "较重"], ["unknown", "未知"]]} /></label>
        <NoteField event={event} />
      </>
    );
  }
  if (event.event_type === "medicine") {
    return (
      <>
        <label>药名<input name="name" defaultValue={stringDetail(details.name)} /></label>
        <label>剂量<input name="dose" defaultValue={stringDetail(details.dose)} /></label>
        <label>途径<Select name="route" value={stringDetail(details.route)} options={[["", "未填"], ["oral", "口服"], ["nasal", "鼻用"], ["topical", "外用"], ["rectal", "直肠"], ["other", "其他"]]} /></label>
        <label>原因<input name="reason" defaultValue={stringDetail(details.reason)} /></label>
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
      备注
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
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("高级 JSON 必须是对象");
  return { ...(parsed as JsonRecord) };
}

function requiredText(formData: FormData, key: string): string {
  const value = text(formData, key);
  if (!value) throw new Error("请填写必填字段");
  return value;
}

function requiredNumber(formData: FormData, key: string): number {
  const value = Number(requiredText(formData, key));
  if (!Number.isFinite(value) || value <= 0) throw new Error("请填写有效数值");
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
  if (!Number.isFinite(next) || next <= 0) throw new Error("持续分钟需要大于 0");
  target[key] = next;
}

function stringDetail(value: unknown): string {
  return typeof value === "string" ? value : "";
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

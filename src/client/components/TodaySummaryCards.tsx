import type { KeyboardEvent } from "react";
import type { ReferenceTargetItem, TodaySummary } from "../types";
import { localizedText, useI18n } from "../i18n";
import { formatNumber, formatTemperature, temperatureMethodLabel } from "../utils/format";
import { referenceBadgeText, referenceForSlot, referenceStatusClass, type SummaryReferenceSlot } from "../utils/reference-targets";
import { formatDuration, formatElapsedTime, formatRelativeTime } from "../utils/time";

interface TodaySummaryCardsProps {
  summary: TodaySummary;
  referenceTargets?: ReferenceTargetItem[];
  timezone?: string;
  onCardSelect?: (slot: TodaySummaryCardSlot) => void;
  hideBreastfeeding?: boolean;
}

export type TodaySummaryCardSlot = "feeding" | "breast" | "pee" | "poop" | "sleep" | "temperature" | "bottle" | "growth";

export function TodaySummaryCards({ summary, referenceTargets, timezone, onCardSelect, hideBreastfeeding = false }: TodaySummaryCardsProps) {
  const { text: tx } = useI18n();
  const feedCount = hideBreastfeeding ? summary.feed_bottle_count : summary.feed_breast_count + summary.feed_bottle_count;
  const latestFeedingAt = hideBreastfeeding ? summary.latest_bottle_at : summary.latest_feeding_at;
  const recency = (iso: string | null) => formatCardRecency(iso, timezone);
  const cardProps = (slot: TodaySummaryCardSlot) => ({
    className: `summary-card summary-card-${slot}${onCardSelect ? " clickable" : ""}`,
    role: onCardSelect ? "button" : undefined,
    tabIndex: onCardSelect ? 0 : undefined,
    onClick: onCardSelect ? () => onCardSelect(slot) : undefined,
    onKeyDown: onCardSelect
      ? (event: KeyboardEvent<HTMLElement>) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onCardSelect(slot);
          }
        }
      : undefined
  });
  return (
    <section className="summary-grid" aria-label={tx({ en: "Today summary", zh: "今日摘要" })}>
      <article {...cardProps("feeding")}>
        <span>{tx({ en: "Feeding", zh: "喂养" })}</span>
        <strong>{tx({ en: "{count} times", zh: "{count} 次" }, { count: feedCount })}</strong>
        <small>{tx({ en: "Last {time}", zh: "上次 {time}" }, { time: recency(latestFeedingAt) })}</small>
        <SummaryReference targets={referenceTargets} slot="feeding" />
      </article>
      {hideBreastfeeding ? null : (
        <article {...cardProps("breast")}>
          <span>{tx({ en: "Breastfeed", zh: "母乳" })}</span>
          <strong>{formatDuration(summary.breast_minutes_total)}</strong>
          <small>{tx({ en: "Left {left} · Right {right}", zh: "左 {left} · 右 {right}" }, { left: formatDuration(summary.breast_left_minutes_total), right: formatDuration(summary.breast_right_minutes_total) })}</small>
          <small>{tx({ en: "Last {time}", zh: "上次 {time}" }, { time: recency(summary.latest_breast_at) })}</small>
        </article>
      )}
      <article {...cardProps("pee")}>
        <span>{tx({ en: "Pee", zh: "小便" })}</span>
        <strong>{tx({ en: "{count} times", zh: "{count} 次" }, { count: summary.pee_count })}</strong>
        <small>{tx({ en: "Last {time}", zh: "上次 {time}" }, { time: recency(summary.latest_pee_at) })}</small>
        <SummaryReference targets={referenceTargets} slot="pee" />
      </article>
      <article {...cardProps("poop")}>
        <span>{tx({ en: "Poop", zh: "大便" })}</span>
        <strong>{tx({ en: "{count} times", zh: "{count} 次" }, { count: summary.poop_count })}</strong>
        <small>{tx({ en: "Last {time}", zh: "上次 {time}" }, { time: recency(summary.latest_poop_at) })}</small>
        <SummaryReference targets={referenceTargets} slot="poop" />
      </article>
      <article {...cardProps("sleep")}>
        <span>{tx({ en: "Sleep", zh: "睡眠" })}</span>
        <strong>{formatDuration(summary.sleep_minutes_total)}</strong>
        <SummaryReference targets={referenceTargets} slot="sleep" />
      </article>
      <article {...cardProps("temperature")}>
        <span>{tx({ en: "Latest temperature", zh: "最新体温" })}</span>
        <strong>{formatTemperature(summary.latest_temperature_c)}</strong>
        {summary.latest_temperature && timezone ? (
          <small>{tx({ en: "Last {time} · {method}", zh: "上次 {time} · {method}" }, { time: formatRelativeTime(summary.latest_temperature.occurred_at, timezone), method: temperatureMethodLabel(summary.latest_temperature.method) })}</small>
        ) : null}
        <SummaryReference targets={referenceTargets} slot="temperature" />
      </article>
      <article {...cardProps("growth")}>
        <span>{tx({ en: "Latest growth", zh: "最新生长" })}</span>
        <strong>{formatLatestGrowthValue(summary.growth)}</strong>
        <small>{tx({ en: "{measure} · Last {time}", zh: "{measure} · 上次 {time}" }, { measure: growthMeasureLabel(summary.growth.latest_measure_type), time: recency(summary.growth.latest_at) })}</small>
      </article>
      <article {...cardProps("bottle")}>
        <span>{tx({ en: "Bottle total", zh: "奶瓶总量" })}</span>
        <strong>{formatNumber(summary.bottle_ml_total)} ml</strong>
        <small>{tx({ en: "Last {time}", zh: "上次 {time}" }, { time: recency(summary.latest_bottle_at) })}</small>
        <SummaryReference targets={referenceTargets} slot="bottle" />
      </article>
    </section>
  );
}

function formatLatestGrowthValue(growth: TodaySummary["growth"]): string {
  if (growth.latest_measure_type === "weight_kg" && growth.latest_value != null) return `${Math.round(growth.latest_value * 1000)} g`;
  if (growth.latest_measure_type === "length_cm" && growth.latest_value != null) return `${formatNumber(growth.latest_value)} cm`;
  if (growth.latest_measure_type === "head_circumference_cm" && growth.latest_value != null) return `${formatNumber(growth.latest_value)} cm`;
  return "—";
}

function growthMeasureLabel(measureType: TodaySummary["growth"]["latest_measure_type"]): string {
  if (measureType === "weight_kg") return localizedText({ en: "Weight", zh: "体重" });
  if (measureType === "length_cm") return localizedText({ en: "Length", zh: "身长" });
  if (measureType === "head_circumference_cm") return localizedText({ en: "Head circumference", zh: "头围" });
  return localizedText({ en: "No record yet", zh: "暂无记录" });
}

function formatCardRecency(iso: string | null, timezone?: string): string {
  if (!iso || !timezone) return "—";
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60000));
  if (minutes < 1) return localizedText({ en: "just now", zh: "刚刚" });
  if (minutes < 24 * 60) return localizedText({ en: "{time} ago", zh: "{time}前" }, { time: formatElapsedTime(minutes) });
  return formatRelativeTime(iso, timezone);
}

function SummaryReference({ targets, slot }: { targets?: ReferenceTargetItem[]; slot: SummaryReferenceSlot }) {
  const item = referenceForSlot(targets, slot);
  const text = referenceBadgeText(item);
  if (!text) return null;
  return <small className={`reference-mini ${referenceStatusClass(item)}`}>{text}</small>;
}

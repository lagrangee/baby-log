import type { KeyboardEvent } from "react";
import type { ReferenceTargetItem, TodaySummary } from "../types";
import { formatNumber, formatTemperature, temperatureMethodLabel } from "../utils/format";
import { referenceBadgeText, referenceForSlot, referenceStatusClass, type SummaryReferenceSlot } from "../utils/reference-targets";
import { formatDuration, formatElapsedTime, formatRelativeTime } from "../utils/time";

interface TodaySummaryCardsProps {
  summary: TodaySummary;
  referenceTargets?: ReferenceTargetItem[];
  timezone?: string;
  onCardSelect?: (slot: TodaySummaryCardSlot) => void;
}

export type TodaySummaryCardSlot = "feeding" | "breast" | "pee" | "poop" | "sleep" | "temperature" | "bottle" | "growth";

export function TodaySummaryCards({ summary, referenceTargets, timezone, onCardSelect }: TodaySummaryCardsProps) {
  const feedCount = summary.feed_breast_count + summary.feed_bottle_count;
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
    <section className="summary-grid" aria-label="今日摘要">
      <article {...cardProps("feeding")}>
        <span>喂养</span>
        <strong>{feedCount} 次</strong>
        <small>上次 {recency(summary.latest_feeding_at)}</small>
        <SummaryReference targets={referenceTargets} slot="feeding" />
      </article>
      <article {...cardProps("breast")}>
        <span>母乳</span>
        <strong>{formatDuration(summary.breast_minutes_total)}</strong>
        <small>左 {formatDuration(summary.breast_left_minutes_total)} · 右 {formatDuration(summary.breast_right_minutes_total)}</small>
        <small>上次 {recency(summary.latest_breast_at)}</small>
      </article>
      <article {...cardProps("pee")}>
        <span>小便</span>
        <strong>{summary.pee_count} 次</strong>
        <small>上次 {recency(summary.latest_pee_at)}</small>
        <SummaryReference targets={referenceTargets} slot="pee" />
      </article>
      <article {...cardProps("poop")}>
        <span>大便</span>
        <strong>{summary.poop_count} 次</strong>
        <small>上次 {recency(summary.latest_poop_at)}</small>
        <SummaryReference targets={referenceTargets} slot="poop" />
      </article>
      <article {...cardProps("sleep")}>
        <span>睡眠</span>
        <strong>{formatDuration(summary.sleep_minutes_total)}</strong>
        <SummaryReference targets={referenceTargets} slot="sleep" />
      </article>
      <article {...cardProps("temperature")}>
        <span>最新体温</span>
        <strong>{formatTemperature(summary.latest_temperature_c)}</strong>
        {summary.latest_temperature && timezone ? (
          <small>{`上次 ${formatRelativeTime(summary.latest_temperature.occurred_at, timezone)} · ${temperatureMethodLabel(summary.latest_temperature.method)}`}</small>
        ) : null}
        <SummaryReference targets={referenceTargets} slot="temperature" />
      </article>
      <article {...cardProps("growth")}>
        <span>最新生长</span>
        <strong>{formatLatestGrowthValue(summary.growth)}</strong>
        <small>{`${growthMeasureLabel(summary.growth.latest_measure_type)} · 上次 ${recency(summary.growth.latest_at)}`}</small>
      </article>
      <article {...cardProps("bottle")}>
        <span>奶瓶总量</span>
        <strong>{formatNumber(summary.bottle_ml_total)} ml</strong>
        <small>上次 {recency(summary.latest_bottle_at)}</small>
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
  if (measureType === "weight_kg") return "体重";
  if (measureType === "length_cm") return "身长";
  if (measureType === "head_circumference_cm") return "头围";
  return "暂无记录";
}

function formatCardRecency(iso: string | null, timezone?: string): string {
  if (!iso || !timezone) return "—";
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60000));
  if (minutes < 1) return "刚刚";
  if (minutes < 24 * 60) return `${formatElapsedTime(minutes)}前`;
  return formatRelativeTime(iso, timezone);
}

function SummaryReference({ targets, slot }: { targets?: ReferenceTargetItem[]; slot: SummaryReferenceSlot }) {
  const item = referenceForSlot(targets, slot);
  const text = referenceBadgeText(item);
  if (!text) return null;
  return <small className={`reference-mini ${referenceStatusClass(item)}`}>{text}</small>;
}

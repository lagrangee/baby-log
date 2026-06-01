import { localizedText, useI18n } from "../i18n";
import type { GrowthCurveItem, GrowthCurvePayload } from "../types";

export function GrowthCurvePanel({ growthCurve }: { growthCurve: GrowthCurvePayload }) {
  const { text: tx } = useI18n();
  const sexLabel =
    growthCurve.profile_context.sex === "female"
      ? tx({ en: "girl", zh: "女孩" })
      : growthCurve.profile_context.sex === "male"
        ? tx({ en: "boy", zh: "男孩" })
        : tx({ en: "sex not set", zh: "未设置性别" });
  const ageLabel = growthCurve.profile_context.current_birth_day_number
    ? tx({ en: "Day {day}", zh: "出生第 {day} 天" }, { day: growthCurve.profile_context.current_birth_day_number })
    : tx({ en: "birth date needed", zh: "待补出生日期" });

  return (
    <section className="panel growth-curve-panel">
      <div className="section-head growth-curve-head">
        <div>
          <h2>{tx({ en: "Growth curve", zh: "成长曲线" })}</h2>
          <p>{sourceBandLabel(growthCurve.source.band)}</p>
        </div>
        <span>
          WHO {sexLabel} · {ageLabel}
        </span>
      </div>

      {growthCurve.available ? (
        <div className="growth-curve-grid">
          {growthCurve.items.map((item) => (
            <GrowthCurveMetric item={item} key={item.measure_type} />
          ))}
        </div>
      ) : (
        <p className="muted-text">
          {tx({
            en: "Add birth date and sex on the More page to generate WHO reference bands matched by age in days and sex.",
            zh: "需要先在更多页补充出生日期和性别，才能生成按日龄和性别匹配的 WHO 参考区间。"
          })}
        </p>
      )}
      <p className="growth-curve-note">{sourceNote()}</p>
    </section>
  );
}

function GrowthCurveMetric({ item }: { item: GrowthCurveItem }) {
  const value = item.latest_measurement ? formatValue(item.latest_measurement.value, item.unit) : localizedText({ en: "Not recorded", zh: "待记录" });
  const reference = item.reference ? `${formatValue(item.reference.p2, item.unit)} - ${formatValue(item.reference.p98, item.unit)}` : localizedText({ en: "No reference", zh: "暂无参考" });
  const commonBand = item.reference ? `${formatValue(item.reference.p25, item.unit)} - ${formatValue(item.reference.p75, item.unit)}` : "";
  const markerStyle = item.position_percent == null ? undefined : { left: `${item.position_percent}%` };
  const commonBandStyle = item.reference ? commonBandStyleFor(item.reference) : undefined;
  const statusClass = `growth-status growth-status-${item.status}`;

  return (
    <article className="growth-metric">
      <header>
        <span>{metricLabel(item.measure_type)}</span>
        <strong>{value}</strong>
      </header>
      <div className="growth-meta">
        <span>{measurementLabel(item)}</span>
        <span>{localizedText({ en: "Reference {reference}", zh: "参考 {reference}" }, { reference })}</span>
        {commonBand ? <span>{localizedText({ en: "Common {band}", zh: "常见 {band}" }, { band: commonBand })}</span> : null}
      </div>
      {item.personal_trend ? (
        <div className="growth-trend">
          <span>{trendLabel(item)}</span>
          <strong>{trendDirectionLabel(item.personal_trend.direction)}</strong>
        </div>
      ) : null}
      <div className="growth-range-legend">
        <span>{localizedText({ en: "Reference p2-p98", zh: "参考 p2-p98" })}</span>
        <span>{localizedText({ en: "Common p25-p75", zh: "常见 p25-p75" })}</span>
      </div>
      <div className="growth-range" aria-label={`${metricLabel(item.measure_type)} ${statusMessage(item)}`}>
        <span className="growth-range-fill" />
        {commonBandStyle ? <span className="growth-range-common" style={commonBandStyle} /> : null}
        {item.position_percent == null ? null : <span className="growth-range-marker" style={markerStyle} />}
      </div>
      <div className="growth-scale">
        <span>{item.reference ? formatValue(item.reference.p2, item.unit) : ""}</span>
        <span>{item.reference ? formatValue(item.reference.p50, item.unit) : ""}</span>
        <span>{item.reference ? formatValue(item.reference.p98, item.unit) : ""}</span>
      </div>
      <p className={statusClass}>{statusMessage(item)}</p>
    </article>
  );
}

function sourceBandLabel(band: GrowthCurvePayload["source"]["band"]): string {
  if (band === "p2_p98") return localizedText({ en: "2nd-98th percentile reference band", zh: "第 2-98 百分位参考区间" });
  return localizedText({ en: "Reference band", zh: "参考区间" });
}

function sourceNote(): string {
  return localizedText({
    en: "For family observation and review only; it does not replace well-child care or pediatric judgment.",
    zh: "仅供家庭观察和回顾，不替代儿保随访或儿科医生判断。"
  });
}

function metricLabel(measureType: GrowthCurveItem["measure_type"]): string {
  if (measureType === "weight_kg") return localizedText({ en: "Weight", zh: "体重" });
  if (measureType === "length_cm") return localizedText({ en: "Length", zh: "身长" });
  return localizedText({ en: "Head circumference", zh: "头围" });
}

function statusMessage(item: GrowthCurveItem): string {
  if (item.status === "within_reference_band") {
    return localizedText({ en: "Within the WHO reference band.", zh: "位于 WHO 参考区间内。" });
  }
  if (item.status === "below_reference_band") {
    return localizedText({ en: "Below the reference band; review with well-child care or a pediatrician.", zh: "低于参考区间；可结合儿保随访或儿科医生意见回顾。" });
  }
  if (item.status === "above_reference_band") {
    return localizedText({ en: "Above the reference band; review with well-child care or a pediatrician.", zh: "高于参考区间；可结合儿保随访或儿科医生意见回顾。" });
  }
  if (item.status === "unavailable") {
    return localizedText({ en: "The app currently provides WHO reference bands for 0-13 weeks after birth only.", zh: "当前仅提供出生后 0-13 周的 WHO 参考区间。" });
  }
  return localizedText(
    {
      en: "No {metric} record yet. Add it through growth measurement when available.",
      zh: "暂无{metric}记录。有测量值时可通过生长测量补充。"
    },
    { metric: metricLabel(item.measure_type).toLowerCase() }
  );
}

function trendDirectionLabel(direction: NonNullable<GrowthCurveItem["personal_trend"]>["direction"]): string {
  if (direction === "stable") return localizedText({ en: "Stable trend", zh: "趋势平稳" });
  if (direction === "slightly_up") return localizedText({ en: "Slightly up", zh: "略有上升" });
  if (direction === "slightly_down") return localizedText({ en: "Slightly down", zh: "略有下降" });
  if (direction === "up") return localizedText({ en: "Clearly up; review together with consecutive records", zh: "明显上升；建议结合连续记录一起回顾" });
  if (direction === "down") return localizedText({ en: "Clearly down; review together with consecutive records", zh: "明显下降；建议结合连续记录一起回顾" });
  if (direction === "baseline_only") return localizedText({ en: "Waiting for a recent measurement", zh: "等待近期测量" });
  return localizedText({ en: "No trend yet", zh: "暂无趋势" });
}

function measurementLabel(item: GrowthCurveItem): string {
  if (!item.latest_measurement) return localizedText({ en: "No measurement", zh: "暂无测量" });
  const source = item.latest_measurement.source === "birth_fact" ? localizedText({ en: "Birth record", zh: "出生记录" }) : localizedText({ en: "Latest measurement", zh: "最近测量" });
  return localizedText({ en: "{source} · day {day}", zh: "{source} · 第 {day} 天" }, { source, day: item.latest_measurement.birth_day_number });
}

function formatValue(value: number, unit: "g" | "cm"): string {
  if (unit === "g") return `${Math.round(value)}g`;
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}cm`;
}

function trendLabel(item: GrowthCurveItem): string {
  const trend = item.personal_trend;
  if (!trend) return "";
  const birth = trend.birth_percentile == null ? localizedText({ en: "Birth —", zh: "出生 —" }) : localizedText({ en: "Birth P{percentile}", zh: "出生 P{percentile}" }, { percentile: Math.round(trend.birth_percentile) });
  if (trend.current_percentile == null) return birth;
  return localizedText({ en: "{birth} · current P{percentile}", zh: "{birth} · 当前 P{percentile}" }, { birth, percentile: Math.round(trend.current_percentile) });
}

function commonBandStyleFor(reference: NonNullable<GrowthCurveItem["reference"]>) {
  const span = reference.p98 - reference.p2;
  if (span <= 0) return undefined;
  const left = ((reference.p25 - reference.p2) / span) * 100;
  const width = ((reference.p75 - reference.p25) / span) * 100;
  return {
    left: `${left}%`,
    width: `${width}%`
  };
}

import type { GrowthCurveItem, GrowthCurvePayload } from "../types";

export function GrowthCurvePanel({ growthCurve }: { growthCurve: GrowthCurvePayload }) {
  const sexLabel = growthCurve.profile_context.sex === "female" ? "女孩" : growthCurve.profile_context.sex === "male" ? "男孩" : "未设置性别";
  const ageLabel = growthCurve.profile_context.current_birth_day_number ? `出生第 ${growthCurve.profile_context.current_birth_day_number} 天` : "待补出生日期";

  return (
    <section className="panel growth-curve-panel">
      <div className="section-head growth-curve-head">
        <div>
          <h2>成长曲线</h2>
          <p>{growthCurve.source.band_label}</p>
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
        <p className="muted-text">需要先在更多页补充出生日期和性别，才能生成按日龄和性别匹配的 WHO 参考区间。</p>
      )}
      <p className="growth-curve-note">{growthCurve.source.note}</p>
    </section>
  );
}

function GrowthCurveMetric({ item }: { item: GrowthCurveItem }) {
  const value = item.latest_measurement ? formatValue(item.latest_measurement.value, item.unit) : "待记录";
  const reference = item.reference ? `${formatValue(item.reference.p2, item.unit)} - ${formatValue(item.reference.p98, item.unit)}` : "暂无参考";
  const commonBand = item.reference ? `${formatValue(item.reference.p25, item.unit)} - ${formatValue(item.reference.p75, item.unit)}` : "";
  const markerStyle = item.position_percent == null ? undefined : { left: `${item.position_percent}%` };
  const commonBandStyle = item.reference ? commonBandStyleFor(item.reference) : undefined;
  const statusClass = `growth-status growth-status-${item.status}`;

  return (
    <article className="growth-metric">
      <header>
        <span>{item.label}</span>
        <strong>{value}</strong>
      </header>
      <div className="growth-meta">
        <span>{measurementLabel(item)}</span>
        <span>参考 {reference}</span>
        {commonBand ? <span>常见 {commonBand}</span> : null}
      </div>
      {item.personal_trend ? (
        <div className="growth-trend">
          <span>{trendLabel(item)}</span>
          <strong>{item.personal_trend.label}</strong>
        </div>
      ) : null}
      <div className="growth-range-legend">
        <span>参考 p2-p98</span>
        <span>常见 p25-p75</span>
      </div>
      <div className="growth-range" aria-label={`${item.label} ${item.message}`}>
        <span className="growth-range-fill" />
        {commonBandStyle ? <span className="growth-range-common" style={commonBandStyle} /> : null}
        {item.position_percent == null ? null : <span className="growth-range-marker" style={markerStyle} />}
      </div>
      <div className="growth-scale">
        <span>{item.reference ? formatValue(item.reference.p2, item.unit) : ""}</span>
        <span>{item.reference ? formatValue(item.reference.p50, item.unit) : ""}</span>
        <span>{item.reference ? formatValue(item.reference.p98, item.unit) : ""}</span>
      </div>
      <p className={statusClass}>{item.message}</p>
    </article>
  );
}

function measurementLabel(item: GrowthCurveItem): string {
  if (!item.latest_measurement) return "暂无测量";
  const source = item.latest_measurement.source === "birth_fact" ? "出生记录" : "最近测量";
  return `${source} · 第 ${item.latest_measurement.birth_day_number} 天`;
}

function formatValue(value: number, unit: "g" | "cm"): string {
  if (unit === "g") return `${Math.round(value)}g`;
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}cm`;
}

function trendLabel(item: GrowthCurveItem): string {
  const trend = item.personal_trend;
  if (!trend) return "";
  const birth = trend.birth_percentile == null ? "出生 —" : `出生 P${Math.round(trend.birth_percentile)}`;
  if (trend.current_percentile == null) return birth;
  return `${birth} · 当前 P${Math.round(trend.current_percentile)}`;
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

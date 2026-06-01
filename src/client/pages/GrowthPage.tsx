import { useCallback, useEffect, useState } from "react";
import { api, isUnauthorized } from "../api";
import { GrowthCurvePanel } from "../components/GrowthCurvePanel";
import { useI18n } from "../i18n";
import type { BootstrapPayload } from "../types";

interface GrowthPageProps {
  onUnauthorized: () => void;
}

export function GrowthPage({ onUnauthorized }: GrowthPageProps) {
  const { text: tx } = useI18n();
  const [data, setData] = useState<BootstrapPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      setLoading(true);
      setData(await api<BootstrapPayload>("/api/bootstrap"));
    } catch (err) {
      if (isUnauthorized(err)) {
        onUnauthorized();
        return;
      }
      setError(err instanceof Error ? err.message : tx({ en: "Failed to load", zh: "加载失败" }));
    } finally {
      setLoading(false);
    }
  }, [onUnauthorized, tx]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <div className="loading">{tx({ en: "Loading growth curve...", zh: "正在加载成长曲线..." })}</div>;
  if (error || !data) {
    return (
      <section className="panel">
        <h1>{tx({ en: "Growth curve", zh: "成长曲线" })}</h1>
        <p className="error-text">{error || tx({ en: "No data", zh: "暂无数据" })}</p>
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
          <p className="eyebrow">{data.profile.child_name ?? tx({ en: "Baby", zh: "宝宝" })}</p>
          <h1>{tx({ en: "Growth curve", zh: "成长曲线" })}</h1>
        </div>
      </header>
      <GrowthCurvePanel growthCurve={data.growth_curve} />
    </>
  );
}

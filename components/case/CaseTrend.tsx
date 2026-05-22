"use client";

import { useEffect, useState } from "react";
import { TimeSeriesChart } from "@/components/dashboard/TimeSeriesChart";
import { metricsForType, type CaseSummary, type Metric, type TimeseriesResponse } from "@/lib/types";
import { METRIC_LABELS } from "@/lib/metric-labels";

function defaultMetric(type: CaseSummary["type"]): Metric {
  return type === "perf" ? "output_throughput" : "score";
}

export function CaseTrend({ detail }: { detail: CaseSummary }) {
  const [days, setDays] = useState(30);
  const [metric, setMetric] = useState<Metric>(defaultMetric(detail.type));
  const [series, setSeries] = useState<TimeseriesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const availableMetrics = metricsForType(detail.type);

  const detailKey = `${detail.type}|${detail.case}|${detail.profile}|${detail.target}`;
  const [prevDetailKey, setPrevDetailKey] = useState(detailKey);
  if (prevDetailKey !== detailKey) {
    setPrevDetailKey(detailKey);
    setMetric(defaultMetric(detail.type));
  }

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset loading state before fetch
    setSeries(null);
    setError(null);
    const q = new URLSearchParams({
      case: detail.case,
      profile: detail.profile,
      target: detail.target,
      metric,
      days: String(days),
    });
    fetch(`/api/timeseries?${q.toString()}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? `HTTP ${r.status}`);
        return r.json() as Promise<TimeseriesResponse>;
      })
      .then((s) => {
        if (!cancelled) setSeries(s);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [days, detail.case, detail.profile, detail.target, metric]);

  return (
    <section>
      <header className="flex flex-wrap items-center justify-between gap-3 pb-3">
        <h2 className="text-lg font-semibold">Trend</h2>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {detail.type === "perf" && (
            <label className="text-[color:var(--color-fg-muted)]">
              Metric:
              <select
                className="ml-2 rounded bg-[color:var(--color-bg-elev)] px-2 py-1"
                value={metric}
                onChange={(e) => setMetric(e.target.value as Metric)}
              >
                {availableMetrics.map((m) => (
                  <option key={m} value={m}>{METRIC_LABELS[m]}</option>
                ))}
              </select>
            </label>
          )}
          <label className="text-[color:var(--color-fg-muted)]">
            Window:
            <select
              className="ml-2 rounded bg-[color:var(--color-bg-elev)] px-2 py-1"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              {[7, 14, 30, 60, 90].map((d) => (
                <option key={d} value={d}>{d}d</option>
              ))}
            </select>
          </label>
        </div>
      </header>
      {error ? (
        <p className="py-6 text-sm text-[color:var(--color-fg-muted)]">{error}</p>
      ) : series ? (
        <TimeSeriesChart series={series} />
      ) : (
        <p className="py-6 text-sm text-[color:var(--color-fg-muted)]">Loading trend...</p>
      )}
    </section>
  );
}

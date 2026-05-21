"use client";

import { useEffect, useMemo, useState } from "react";
import { CasesTable } from "./CasesTable";
import { TimeSeriesChart } from "./TimeSeriesChart";
import { listSelectors, selectorType, type TimeseriesSelector } from "@/lib/timeseries";
import { metricsForType, type CaseSummary, type CasesResponse, type Metric, type TimeseriesResponse } from "@/lib/types";

function selectorKey(s: TimeseriesSelector): string {
  return `${s.case}|${s.profile}|${s.target}`;
}

const METRIC_LABELS: Record<Metric, string> = {
  output_throughput: "Output throughput (tok/s)",
  input_throughput: "Input throughput (tok/s)",
  request_throughput: "Request throughput (req/s)",
  total_throughput: "Total throughput (tok/s)",
  median_ttft_ms: "TTFT median (ms)",
  p99_ttft_ms: "TTFT p99 (ms)",
  median_itl_ms: "ITL median (ms)",
  p99_itl_ms: "ITL p99 (ms)",
  median_tpot_ms: "TPOT median (ms)",
  median_e2e_latency_ms: "E2E median (ms)",
  p99_e2e_latency_ms: "E2E p99 (ms)",
  score: "Accuracy score",
};

export function Dashboard() {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [errors, setErrors] = useState<{ path: string; reason: string }[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  const [tsDays, setTsDays] = useState(30);
  const [series, setSeries] = useState<TimeseriesResponse | null>(null);
  const [selectorKeyState, setSelectorKeyState] = useState<string | null>(null);
  const [metric, setMetric] = useState<Metric | null>(null); // null = use default

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    fetch(`/api/cases?days=${days}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? `HTTP ${r.status}`);
        return r.json() as Promise<CasesResponse>;
      })
      .then((body) => {
        if (cancelled) return;
        setCases(body.cases);
        setErrors(body.errors);
      })
      .catch((e: Error) => {
        if (!cancelled) setLoadError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  const selectors = useMemo(() => listSelectors(cases), [cases]);
  const activeSelector = useMemo(
    () => selectors.find((s) => selectorKey(s) === selectorKeyState) ?? selectors[0] ?? null,
    [selectors, selectorKeyState],
  );
  const activeType = activeSelector ? selectorType(cases, activeSelector) : undefined;
  const availableMetrics: Metric[] = activeType ? metricsForType(activeType) : [];

  // Reset metric when it doesn't apply to the new selector type.
  useEffect(() => {
    if (metric && availableMetrics.length > 0 && !availableMetrics.includes(metric)) {
      setMetric(null);
    }
  }, [activeType, availableMetrics, metric]);

  useEffect(() => {
    if (!activeSelector) return;
    let cancelled = false;
    setSeries(null);
    const q = new URLSearchParams({
      case: activeSelector.case,
      profile: activeSelector.profile,
      target: activeSelector.target,
      days: String(tsDays),
    });
    if (metric) q.set("metric", metric);
    fetch(`/api/timeseries?${q.toString()}`)
      .then(async (r) => {
        if (!r.ok) return null;
        return r.json() as Promise<TimeseriesResponse>;
      })
      .then((s) => {
        if (!cancelled) setSeries(s);
      });
    return () => {
      cancelled = true;
    };
  }, [activeSelector, tsDays, metric]);

  return (
    <div className="flex flex-col gap-8">
      {loadError && (
        <div
          role="alert"
          className="rounded border border-[color:var(--color-danger)] bg-[color:var(--color-danger)]/10 px-4 py-3 text-sm"
        >
          Failed to load cases: {loadError}
        </div>
      )}
      <section>
        <header className="flex items-center justify-between pb-3">
          <h2 className="text-lg font-semibold">Recent cases</h2>
          <label className="text-sm text-[color:var(--color-fg-muted)]">
            Window:
            <select
              className="ml-2 rounded bg-[color:var(--color-bg-elev)] px-2 py-1"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              {[1, 3, 7, 14, 30].map((d) => (
                <option key={d} value={d}>{d}d</option>
              ))}
            </select>
          </label>
        </header>
        <CasesTable cases={cases} />
        {errors.length > 0 && (
          <p className="mt-2 text-xs text-[color:var(--color-fg-muted)]">
            Skipped {errors.length} unparsable file(s).
          </p>
        )}
      </section>

      <section>
        <header className="flex flex-wrap items-center justify-between gap-3 pb-3">
          <h2 className="text-lg font-semibold">Trend</h2>
          <div className="flex items-center gap-3 text-sm">
            <label className="text-[color:var(--color-fg-muted)]">
              Selector:
              <select
                className="ml-2 rounded bg-[color:var(--color-bg-elev)] px-2 py-1 font-mono text-xs"
                value={activeSelector ? selectorKey(activeSelector) : ""}
                onChange={(e) => setSelectorKeyState(e.target.value)}
              >
                {selectors.map((s) => (
                  <option key={selectorKey(s)} value={selectorKey(s)}>
                    {s.case} @ {s.profile} @ {s.target}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[color:var(--color-fg-muted)]">
              Metric:
              <select
                className="ml-2 rounded bg-[color:var(--color-bg-elev)] px-2 py-1"
                value={metric ?? ""}
                onChange={(e) => setMetric(e.target.value ? (e.target.value as Metric) : null)}
                disabled={availableMetrics.length === 0}
              >
                <option value="">default</option>
                {availableMetrics.map((m) => (
                  <option key={m} value={m}>{METRIC_LABELS[m]}</option>
                ))}
              </select>
            </label>
            <label className="text-[color:var(--color-fg-muted)]">
              Window:
              <select
                className="ml-2 rounded bg-[color:var(--color-bg-elev)] px-2 py-1"
                value={tsDays}
                onChange={(e) => setTsDays(Number(e.target.value))}
              >
                {[7, 14, 30, 60, 90].map((d) => (
                  <option key={d} value={d}>{d}d</option>
                ))}
              </select>
            </label>
          </div>
        </header>
        {series ? <TimeSeriesChart series={series} /> :
          <p className="text-[color:var(--color-fg-muted)] py-6">Pick a selector to view its trend.</p>}
      </section>
    </div>
  );
}

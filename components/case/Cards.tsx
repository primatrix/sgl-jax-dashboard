import type { AccuracyDetail, PerfDetail } from "@/lib/types";

/* ---------- formatters ---------- */

export function fmtMs(ms: number): string {
  if (!Number.isFinite(ms)) return "—";
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${ms.toFixed(1)}ms`;
}

export function fmtNum(n: number, precision = 2): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 100) return n.toFixed(1);
  return n.toFixed(precision);
}

export function fmtInt(n: number): string {
  return n.toLocaleString();
}

export function fmtPct(x: number): string {
  return `${(x * 100).toFixed(2)}%`;
}

export function fmtAny(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return Number.isInteger(v) ? v.toString() : fmtNum(v);
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return `[${v.length} items]`;
  if (typeof v === "object") return `{${Object.keys(v as object).length} keys}`;
  return String(v);
}

/* ---------- atom components ---------- */

export function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[color:var(--color-fg-muted)]">
      {children}
    </h3>
  );
}

export function KvTable({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <div className="overflow-x-auto rounded border border-[color:var(--color-border)]">
      <table className="min-w-full text-sm">
        <tbody>
          {rows.map(([k, v], i) => (
            <tr
              key={k}
              className={i > 0 ? "border-t border-[color:var(--color-border)]" : ""}
            >
              <td className="bg-[color:var(--color-bg-elev)] px-3 py-1.5 font-mono text-xs text-[color:var(--color-fg-muted)] whitespace-nowrap align-top">
                {k}
              </td>
              <td className="px-3 py-1.5 font-mono text-xs">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- domain cards ---------- */

type LatencyStats = {
  mean?: number;
  median?: number;
  std?: number;
  p90?: number;
  p95?: number;
  p99?: number;
};

function LatencyRow({ label, stats }: { label: string; stats: LatencyStats }) {
  return (
    <div className="grid grid-cols-7 gap-2 border-t border-[color:var(--color-border)] px-3 py-2 text-xs font-mono">
      <div className="font-semibold text-[color:var(--color-fg-muted)]">{label}</div>
      <div className="text-right">{stats.mean !== undefined ? fmtMs(stats.mean) : "—"}</div>
      <div className="text-right">{stats.median !== undefined ? fmtMs(stats.median) : "—"}</div>
      <div className="text-right">{stats.std !== undefined ? fmtMs(stats.std) : "—"}</div>
      <div className="text-right">{stats.p90 !== undefined ? fmtMs(stats.p90) : "—"}</div>
      <div className="text-right">{stats.p95 !== undefined ? fmtMs(stats.p95) : "—"}</div>
      <div className="text-right">{stats.p99 !== undefined ? fmtMs(stats.p99) : "—"}</div>
    </div>
  );
}

export function LatencyCard({ d }: { d: PerfDetail }) {
  return (
    <section>
      <CardTitle>Latency</CardTitle>
      <div className="rounded border border-[color:var(--color-border)]">
        <div className="grid grid-cols-7 gap-2 bg-[color:var(--color-bg-elev)] px-3 py-2 text-xs uppercase tracking-wide text-[color:var(--color-fg-muted)]">
          <div></div>
          <div className="text-right">mean</div>
          <div className="text-right">median</div>
          <div className="text-right">std</div>
          <div className="text-right">p90</div>
          <div className="text-right">p95</div>
          <div className="text-right">p99</div>
        </div>
        <LatencyRow
          label="TTFT"
          stats={{ mean: d.mean_ttft_ms, median: d.median_ttft_ms, std: d.std_ttft_ms, p99: d.p99_ttft_ms }}
        />
        <LatencyRow
          label="ITL"
          stats={{
            mean: d.mean_itl_ms, median: d.median_itl_ms, std: d.std_itl_ms,
            p95: d.p95_itl_ms, p99: d.p99_itl_ms,
          }}
        />
        <LatencyRow
          label="TPOT"
          stats={{ mean: d.mean_tpot_ms, median: d.median_tpot_ms, std: d.std_tpot_ms, p99: d.p99_tpot_ms }}
        />
        <LatencyRow
          label="E2E"
          stats={{
            mean: d.mean_e2e_latency_ms, median: d.median_e2e_latency_ms, std: d.std_e2e_latency_ms,
            p90: d.p90_e2e_latency_ms, p99: d.p99_e2e_latency_ms,
          }}
        />
      </div>
    </section>
  );
}

export function ThroughputCard({ d }: { d: PerfDetail }) {
  const rows: [string, React.ReactNode][] = [
    ["input_throughput", `${fmtNum(d.input_throughput)} tok/s`],
    ["output_throughput", `${fmtNum(d.output_throughput)} tok/s`],
    ["request_throughput", `${fmtNum(d.request_throughput, 4)} req/s`],
    ["total_throughput", `${fmtNum(d.total_throughput)} tok/s`],
    ["max_output_tokens_per_s", `${fmtNum(d.max_output_tokens_per_s)} tok/s`],
  ];
  return (
    <section>
      <CardTitle>Throughput</CardTitle>
      <KvTable rows={rows} />
    </section>
  );
}

export function TokensCard({ d }: { d: PerfDetail }) {
  const rows: [string, React.ReactNode][] = [
    ["total_input_tokens", fmtInt(d.total_input_tokens)],
    ["total_input_text_tokens", fmtInt(d.total_input_text_tokens)],
    ["total_input_vision_tokens", fmtInt(d.total_input_vision_tokens)],
    ["total_output_tokens", fmtInt(d.total_output_tokens)],
    ["total_output_tokens_retokenized", fmtInt(d.total_output_tokens_retokenized)],
  ];
  return (
    <section>
      <CardTitle>Tokens</CardTitle>
      <KvTable rows={rows} />
    </section>
  );
}

export function RunConfigCard({ d }: { d: PerfDetail }) {
  const rows: [string, React.ReactNode][] = [
    ["backend", d.backend ?? "—"],
    ["dataset_name", d.dataset_name ?? "—"],
    ["duration", `${fmtNum(d.duration)}s`],
    ["concurrency", fmtNum(d.concurrency)],
    ["max_concurrency", d.max_concurrency.toString()],
    ["max_concurrent_requests", d.max_concurrent_requests.toString()],
    ["request_rate", d.request_rate.toString()],
    ["random_input_len", d.random_input_len?.toString() ?? "—"],
    ["random_output_len", d.random_output_len?.toString() ?? "—"],
    ["random_range_ratio", d.random_range_ratio?.toString() ?? "—"],
    ["sharegpt_output_len", d.sharegpt_output_len?.toString() ?? "—"],
    ["accept_length", d.accept_length?.toString() ?? "—"],
    ["tag", d.tag ?? "—"],
    ["completed", d.completed.toString()],
  ];
  return (
    <section>
      <CardTitle>Run config</CardTitle>
      <KvTable rows={rows} />
    </section>
  );
}

export function SamplesCard({ d }: { d: PerfDetail }) {
  const s = d.samples;
  const errCount = s.errors.filter((x) => x && x.length > 0).length;
  const rows: [string, React.ReactNode][] = [
    ["ttfts", `${s.ttfts.length} samples`],
    ["itls", `${s.itls.length} arrays`],
    ["input_lens", `${s.input_lens.length} samples`],
    ["output_lens", `${s.output_lens.length} samples`],
    ["generated_texts", `${s.generated_texts.length} samples`],
    ["errors", `${errCount} non-empty / ${s.errors.length} total`],
  ];
  return (
    <section>
      <CardTitle>Samples</CardTitle>
      <KvTable rows={rows} />
    </section>
  );
}

export function ServerInfoCard({ d }: { d: PerfDetail }) {
  const entries = Object.entries(d.server_info).sort(([a], [b]) => a.localeCompare(b));
  return (
    <section>
      <details>
        <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-fg)]">
          Server info · {entries.length} keys
        </summary>
        <div className="mt-2">
          <KvTable rows={entries.map(([k, v]) => [k, fmtAny(v)])} />
        </div>
      </details>
    </section>
  );
}

/* ---------- accuracy ---------- */

export function AccuracyCard({ d }: { d: AccuracyDetail }) {
  const rows: [string, React.ReactNode][] = [
    ["dataset", d.dataset],
    ["model_id", d.model_id],
    ["score", fmtPct(d.score)],
    ["score_std", d.score_std !== null ? fmtNum(d.score_std, 4) : "—"],
  ];
  return (
    <section>
      <CardTitle>Accuracy</CardTitle>
      <KvTable rows={rows} />
    </section>
  );
}

export function ExtraCard({ d }: { d: AccuracyDetail }) {
  const entries = Object.entries(d.extra);
  if (entries.length === 0) return null;
  return (
    <section>
      <CardTitle>Extra fields</CardTitle>
      <KvTable rows={entries.map(([k, v]) => [k, fmtAny(v)])} />
    </section>
  );
}

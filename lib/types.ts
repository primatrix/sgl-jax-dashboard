/**
 * Domain types matching the CI runner output schema.
 *
 * Summary vs Detail:
 *   - Summary types include only scalar fields. Returned by /api/cases.
 *     Compact (~2 KB per case) so a 30-day window stays under a few hundred
 *     KB even with many runs.
 *   - Detail types extend Summary with `samples` (per-request arrays, ~10K
 *     numbers per perf case) and `server_info` (~124 keys). Returned by
 *     /api/case for a single case path on demand.
 *
 * Fields are kept flat with names matching the raw JSON exactly, so
 * cross-referencing the runner source is trivial.
 */

export type CaseMeta = {
  case: string;
  profile: string;
  target: string;
  date: string;        // YYYY-MM-DD parsed from object path
  workload: string;    // gke-run-test-caces-<run_id>
  path: string;        // full GCS object name
  updated: string;     // ISO timestamp from GCS object metadata
};

/* ---------- Perf ---------- */

export type PerfLatency = {
  // ttft
  mean_ttft_ms: number;
  median_ttft_ms: number;
  std_ttft_ms: number;
  p99_ttft_ms: number;
  // itl
  mean_itl_ms: number;
  median_itl_ms: number;
  std_itl_ms: number;
  p95_itl_ms: number;
  p99_itl_ms: number;
  // tpot
  mean_tpot_ms: number;
  median_tpot_ms: number;
  std_tpot_ms: number;
  p99_tpot_ms: number;
  // e2e
  mean_e2e_latency_ms: number;
  median_e2e_latency_ms: number;
  std_e2e_latency_ms: number;
  p90_e2e_latency_ms: number;
  p99_e2e_latency_ms: number;
};

export type PerfThroughput = {
  input_throughput: number;
  output_throughput: number;
  request_throughput: number;
  total_throughput: number;
  max_output_tokens_per_s: number;
};

export type PerfTokens = {
  total_input_tokens: number;
  total_input_text_tokens: number;
  total_input_vision_tokens: number;
  total_output_tokens: number;
  total_output_tokens_retokenized: number;
};

export type PerfRunConfig = {
  backend: string | null;
  dataset_name: string | null;
  duration: number;
  concurrency: number;
  max_concurrency: number;
  max_concurrent_requests: number;
  request_rate: number;
  random_input_len: number | null;
  random_output_len: number | null;
  random_range_ratio: number | null;
  sharegpt_output_len: number | null;
  accept_length: number | null;
  tag: string | null;
};

export type PerfSummary = CaseMeta & {
  type: "perf";
  completed: number;
} & PerfLatency &
  PerfThroughput &
  PerfTokens &
  PerfRunConfig;

export type PerfSamples = {
  errors: string[];
  generated_texts: string[];
  input_lens: number[];
  output_lens: number[];
  ttfts: number[];
  itls: number[][];
};

export type ServerInfo = Record<string, unknown>;

export type PerfDetail = PerfSummary & {
  samples: PerfSamples;
  server_info: ServerInfo;
};

/* ---------- Accuracy ---------- */

export type AccuracySummary = CaseMeta & {
  type: "accuracy";
  dataset: string;
  model_id: string;
  score: number;
  score_std: number | null;     // from `score:std`
};

// Accuracy currently has no extra "samples" payload, but we keep the same
// shape as PerfDetail so the detail endpoint and panel can be uniform.
export type AccuracyDetail = AccuracySummary & {
  extra: Record<string, unknown>; // any fields not modeled above
};

/* ---------- Unions ---------- */

export type CaseSummary = PerfSummary | AccuracySummary;
export type CaseDetail = PerfDetail | AccuracyDetail;

// Back-compat alias for older imports — Case == CaseSummary.
export type Case = CaseSummary;

export type ParseError = { path: string; reason: string };

export type CasesResponse = {
  cases: CaseSummary[];
  errors: ParseError[];
};

export type TimeseriesPoint = {
  date: string;
  workload: string;
  value: number;
  type: "perf" | "accuracy";
};

export type PerfMetric =
  | "output_throughput"
  | "input_throughput"
  | "request_throughput"
  | "total_throughput"
  | "median_ttft_ms"
  | "p99_ttft_ms"
  | "median_itl_ms"
  | "p99_itl_ms"
  | "median_tpot_ms"
  | "median_e2e_latency_ms"
  | "p99_e2e_latency_ms";

export type AccuracyMetric = "score";

export type Metric = PerfMetric | AccuracyMetric;

export type TimeseriesResponse = {
  case: string;
  profile: string;
  target: string;
  metric: Metric;
  points: TimeseriesPoint[];
};

/* ---------- Type guards / accessors ---------- */

export function isPerfSummary(c: CaseSummary): c is PerfSummary {
  return c.type === "perf";
}
export function isAccuracySummary(c: CaseSummary): c is AccuracySummary {
  return c.type === "accuracy";
}

// Back-compat aliases — old code referenced these names.
export const isPerfCase = isPerfSummary;
export const isAccuracyCase = isAccuracySummary;

export type PerfCase = PerfSummary;        // back-compat
export type AccuracyCase = AccuracySummary; // back-compat

export function primaryMetric(c: CaseSummary): { name: Metric; value: number } {
  if (isPerfSummary(c)) return { name: "output_throughput", value: c.output_throughput };
  return { name: "score", value: c.score };
}

// Look up any numeric metric on a case, returning undefined if N/A.
// Used by buildTimeseries to support metric selection.
export function getMetric(c: CaseSummary, metric: Metric): number | undefined {
  if (metric === "score") {
    return isAccuracySummary(c) ? c.score : undefined;
  }
  if (isPerfSummary(c)) {
    const v = (c as unknown as Record<string, unknown>)[metric];
    return typeof v === "number" ? v : undefined;
  }
  return undefined;
}

// Defines which metrics apply to which case type — used by the UI to build
// a sensible selector that doesn't offer perf metrics for accuracy cases.
export function metricsForType(type: "perf" | "accuracy"): Metric[] {
  if (type === "perf") {
    return [
      "output_throughput",
      "input_throughput",
      "request_throughput",
      "total_throughput",
      "median_ttft_ms",
      "p99_ttft_ms",
      "median_itl_ms",
      "p99_itl_ms",
      "median_tpot_ms",
      "median_e2e_latency_ms",
      "p99_e2e_latency_ms",
    ];
  }
  return ["score"];
}

// Indicates whether smaller is better for this metric — used to color a
// delta (red on regression, green on improvement).
export function isLowerBetter(metric: Metric): boolean {
  // All *_ms metrics measure latency; lower wins. score and *_throughput
  // are higher-is-better.
  return metric.endsWith("_ms");
}

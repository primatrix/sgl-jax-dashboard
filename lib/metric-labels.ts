import type { Metric } from "./types";

export const METRIC_LABELS: Record<Metric, string> = {
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

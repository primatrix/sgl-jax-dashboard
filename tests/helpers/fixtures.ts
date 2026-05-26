import type { AccuracySummary, PerfSummary } from "@/lib/types";
import type { GcsClient } from "@/lib/gcs";

export type FakeObject = { body: string; updated: string };

export type FakeGcsClient = GcsClient & {
  // Direct access to the in-memory object store for assertions.
  objects: Map<string, FakeObject>;
};

/**
 * Build an in-memory GcsClient backed by a Map. Reads honor exact-key lookup;
 * tryGetObject returns null on miss; putObject upserts; listObjects filters by
 * prefix. Used across gcs/cases-index/api tests so the GCS contract is
 * exercised consistently.
 */
export function makeFakeGcsClient(
  initial: Record<string, FakeObject> = {},
): FakeGcsClient {
  const store = new Map<string, FakeObject>(Object.entries(initial));
  return {
    objects: store,
    async listObjects(prefix) {
      return Array.from(store.entries())
        .filter(([name]) => name.startsWith(prefix))
        .map(([name, o]) => ({ name, updated: o.updated }));
    },
    async getObject(name) {
      const o = store.get(name);
      if (!o) throw new Error(`not found: ${name}`);
      return o.body;
    },
    async tryGetObject(name) {
      const o = store.get(name);
      return o ? o.body : null;
    },
    async putObject(name, body) {
      store.set(name, { body, updated: new Date().toISOString() });
    },
    async statObject(name) {
      const o = store.get(name);
      if (!o) throw new Error(`not found: ${name}`);
      return { name, updated: o.updated };
    },
  };
}

export function samplePerf(overrides: Partial<PerfSummary> = {}): PerfSummary {
  return {
    type: "perf",
    case: "bench",
    profile: "p",
    target: "v6e-4x4",
    date: "2026-05-18",
    workload: "gke-run-test-caces-12345",
    path: "2026-05-18/gke-run-test-caces-12345/bench.json",
    updated: "2026-05-18T00:00:00Z",
    completed: 256,
    // ttft
    mean_ttft_ms: 1000,
    median_ttft_ms: 84475.65,
    std_ttft_ms: 500,
    p99_ttft_ms: 2000,
    // itl
    mean_itl_ms: 30,
    median_itl_ms: 24.14,
    std_itl_ms: 5,
    p95_itl_ms: 28,
    p99_itl_ms: 35,
    // tpot
    mean_tpot_ms: 30,
    median_tpot_ms: 30,
    std_tpot_ms: 5,
    p99_tpot_ms: 50,
    // e2e
    mean_e2e_latency_ms: 1000,
    median_e2e_latency_ms: 1000,
    std_e2e_latency_ms: 100,
    p90_e2e_latency_ms: 1200,
    p99_e2e_latency_ms: 1500,
    // throughput
    input_throughput: 5435.31,
    output_throughput: 339.7,
    request_throughput: 0.331,
    total_throughput: 5775,
    max_output_tokens_per_s: 2752,
    // tokens
    total_input_tokens: 4194304,
    total_input_text_tokens: 4194304,
    total_input_vision_tokens: 0,
    total_output_tokens: 262144,
    total_output_tokens_retokenized: 260000,
    // run config
    backend: "sgl-jax",
    dataset_name: "random",
    duration: 770.22,
    concurrency: 63.96,
    max_concurrency: 64,
    max_concurrent_requests: 128,
    request_rate: 100,
    random_input_len: 16384,
    random_output_len: 1024,
    random_range_ratio: 1.0,
    sharegpt_output_len: null,
    accept_length: null,
    tag: null,
    ...overrides,
  };
}

export function sampleAccuracy(overrides: Partial<AccuracySummary> = {}): AccuracySummary {
  return {
    type: "accuracy",
    case: "gsm8k",
    profile: "p",
    target: "v6e-4x4",
    date: "2026-05-18",
    workload: "gke-run-test-caces-12345",
    path: "2026-05-18/gke-run-test-caces-12345/gsm8k.json",
    updated: "2026-05-18T00:00:00Z",
    dataset: "gsm8k",
    model_id: "XiaomiMiMo/MiMo-V2-Flash",
    score: 0.95,
    score_std: 0.2,
    ...overrides,
  };
}

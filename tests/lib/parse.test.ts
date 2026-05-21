import { describe, it, expect } from "vitest";
import {
  parseObjectPath,
  isCaseObjectName,
  parseCaseDetail,
  parseCaseSummary,
  summaryOf,
} from "@/lib/parse";

describe("parseObjectPath", () => {
  it("extracts date, workload, basename from a normal path", () => {
    expect(
      parseObjectPath(
        "2026-05-18/gke-run-test-caces-26025241371/mimo-flash-benchmark.json",
      ),
    ).toEqual({
      date: "2026-05-18",
      workload: "gke-run-test-caces-26025241371",
      basename: "mimo-flash-benchmark.json",
    });
  });

  it("returns null for placeholder directory entries", () => {
    expect(parseObjectPath("2026-05-18/")).toBeNull();
    expect(parseObjectPath("2026-05-18/gke-run-test-caces-1/")).toBeNull();
    expect(parseObjectPath("logs/")).toBeNull();
  });

  it("returns null for non-date top-level prefixes", () => {
    expect(parseObjectPath("logs/build.log")).toBeNull();
    expect(parseObjectPath("README")).toBeNull();
  });
});

describe("isCaseObjectName", () => {
  it("accepts .json files under a date prefix with a workload folder", () => {
    expect(
      isCaseObjectName("2026-05-18/gke-run-test-caces-1/foo.json"),
    ).toBe(true);
  });
  it("rejects directory placeholders, logs/, non-json", () => {
    expect(isCaseObjectName("2026-05-18/")).toBe(false);
    expect(isCaseObjectName("logs/build.log")).toBe(false);
    expect(isCaseObjectName("2026-05-18/run/foo.txt")).toBe(false);
  });
});

const meta = {
  path: "2026-05-18/gke-run-test-caces-1/mimo-flash-benchmark.json",
  updated: "2026-05-18T09:00:00Z",
};

const fullPerf = {
  type: "perf",
  case: "mimo-flash-benchmark",
  profile: "p1",
  target: "v6e-4x4",
  backend: "sgl-jax",
  dataset_name: "random",
  duration: 770.2,
  concurrency: 63.96,
  max_concurrency: 64,
  max_concurrent_requests: 128,
  request_rate: 100,
  random_input_len: 16384,
  random_output_len: 1024,
  random_range_ratio: 1.0,
  completed: 256,
  mean_ttft_ms: 84823.28,
  median_ttft_ms: 84477.13,
  std_ttft_ms: 48282.63,
  p99_ttft_ms: 166727.48,
  mean_itl_ms: 105.2,
  median_itl_ms: 23.84,
  std_itl_ms: 2991.87,
  p95_itl_ms: 28.63,
  p99_itl_ms: 30.69,
  mean_tpot_ms: 105.2,
  median_tpot_ms: 105.34,
  std_tpot_ms: 47.25,
  p99_tpot_ms: 184.74,
  mean_e2e_latency_ms: 192446.75,
  median_e2e_latency_ms: 192722.07,
  std_e2e_latency_ms: 970.53,
  p90_e2e_latency_ms: 193548.5,
  p99_e2e_latency_ms: 193804.65,
  input_throughput: 5445.59,
  output_throughput: 340.35,
  request_throughput: 0.33,
  total_throughput: 5785.93,
  max_output_tokens_per_s: 2752,
  total_input_tokens: 4194304,
  total_input_text_tokens: 4194304,
  total_input_vision_tokens: 0,
  total_output_tokens: 262144,
  total_output_tokens_retokenized: 260845,
  errors: ["", "fail"],
  generated_texts: ["a", "b"],
  input_lens: [16384, 16384],
  output_lens: [1024, 1024],
  ttfts: [2.79, 3.1],
  itls: [[1, 2], [3]],
  server_info: { tp_size: 16, dp_size: 4, ep_size: 16, model_path: "/m" },
};

const fullAccuracy = {
  type: "accuracy",
  case: "mimo-flash-gsm8k",
  profile: "p1",
  target: "v6e-4x4",
  dataset: "gsm8k",
  model_id: "X/Y",
  score: 0.957,
  "score:std": 0.201,
  gsm8k: 0.957,
  "gsm8k:std": 0.201,
  some_future_metric: 42,
};

describe("parseCaseDetail", () => {
  it("parses a full perf case including latency stats, throughput, tokens, samples, server_info", () => {
    const r = parseCaseDetail(JSON.stringify(fullPerf), meta);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const v = r.value;
    expect(v.type).toBe("perf");
    if (v.type !== "perf") return;
    expect(v.median_ttft_ms).toBe(84477.13);
    expect(v.p99_e2e_latency_ms).toBe(193804.65);
    expect(v.total_throughput).toBe(5785.93);
    expect(v.total_output_tokens_retokenized).toBe(260845);
    expect(v.duration).toBe(770.2);
    expect(v.samples.errors).toEqual(["", "fail"]);
    expect(v.samples.input_lens).toEqual([16384, 16384]);
    expect(v.samples.itls).toEqual([[1, 2], [3]]);
    expect(v.server_info.tp_size).toBe(16);
    expect(v.server_info.model_path).toBe("/m");
  });

  it("parses an accuracy case including score:std and stashes unknown fields in extra", () => {
    const r = parseCaseDetail(JSON.stringify(fullAccuracy), meta);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const v = r.value;
    expect(v.type).toBe("accuracy");
    if (v.type !== "accuracy") return;
    expect(v.score).toBe(0.957);
    expect(v.score_std).toBe(0.201);
    expect(v.dataset).toBe("gsm8k");
    // dataset-named alias keys should NOT pollute extra
    expect(v.extra.gsm8k).toBeUndefined();
    expect(v.extra["gsm8k:std"]).toBeUndefined();
    expect(v.extra.some_future_metric).toBe(42);
  });

  it("returns an error when type field is missing", () => {
    const r = parseCaseDetail(JSON.stringify({ case: "x" }), meta);
    expect(r.ok).toBe(false);
  });

  it("returns an error on invalid JSON", () => {
    const r = parseCaseDetail("{not json", meta);
    expect(r.ok).toBe(false);
  });

  it("returns an error when path has bad shape", () => {
    const r = parseCaseDetail(
      JSON.stringify(fullPerf),
      { path: "not/valid", updated: "2026-05-18T00:00:00Z" },
    );
    expect(r.ok).toBe(false);
  });
});

describe("parseCaseSummary", () => {
  it("drops samples and server_info from the result", () => {
    const r = parseCaseSummary(JSON.stringify(fullPerf), meta);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect("samples" in r.value).toBe(false);
    expect("server_info" in r.value).toBe(false);
    // but still has all scalar fields
    if (r.value.type === "perf") {
      expect(r.value.median_ttft_ms).toBe(84477.13);
      expect(r.value.total_input_tokens).toBe(4194304);
    }
  });

  it("drops extra from accuracy result", () => {
    const r = parseCaseSummary(JSON.stringify(fullAccuracy), meta);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect("extra" in r.value).toBe(false);
    if (r.value.type === "accuracy") {
      expect(r.value.score_std).toBe(0.201);
    }
  });
});

describe("summaryOf", () => {
  it("is idempotent — calling on a Summary's structure preserves identity", () => {
    const detail = parseCaseDetail(JSON.stringify(fullPerf), meta);
    if (!detail.ok) throw new Error("setup");
    const s = summaryOf(detail.value);
    expect(s.case).toBe("mimo-flash-benchmark");
    expect("samples" in s).toBe(false);
  });
});

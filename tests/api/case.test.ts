import { describe, it, expect } from "vitest";
import { handleCase } from "@/lib/api/case-handler";
import { makeFakeGcsClient } from "../helpers/fixtures";

const FULL_PERF = JSON.stringify({
  type: "perf",
  case: "bench",
  profile: "p",
  target: "v6e-4x4",
  completed: 256,
  median_ttft_ms: 84477.13,
  mean_ttft_ms: 84823,
  std_ttft_ms: 48282,
  p99_ttft_ms: 166727,
  mean_itl_ms: 105.2,
  median_itl_ms: 23.84,
  std_itl_ms: 2991,
  p95_itl_ms: 28.6,
  p99_itl_ms: 30.6,
  mean_tpot_ms: 105.2,
  median_tpot_ms: 105.3,
  std_tpot_ms: 47.2,
  p99_tpot_ms: 184.7,
  mean_e2e_latency_ms: 192446,
  median_e2e_latency_ms: 192722,
  std_e2e_latency_ms: 970,
  p90_e2e_latency_ms: 193548,
  p99_e2e_latency_ms: 193804,
  input_throughput: 5435,
  output_throughput: 339.7,
  request_throughput: 0.33,
  total_throughput: 5775,
  max_output_tokens_per_s: 2752,
  total_input_tokens: 4194304,
  total_input_text_tokens: 4194304,
  total_input_vision_tokens: 0,
  total_output_tokens: 262144,
  total_output_tokens_retokenized: 260000,
  backend: "sgl-jax",
  dataset_name: "random",
  duration: 770,
  concurrency: 64,
  max_concurrency: 64,
  max_concurrent_requests: 128,
  request_rate: 100,
  random_input_len: 16384,
  random_output_len: 1024,
  random_range_ratio: 1.0,
  errors: [""],
  generated_texts: ["hello"],
  input_lens: [16384],
  output_lens: [1024],
  ttfts: [2.79],
  itls: [[1, 2]],
  server_info: { tp_size: 16, model_path: "/m" },
});

function client() {
  return makeFakeGcsClient({
    "2026-05-19/run-1/bench.json": { body: FULL_PERF, updated: "2026-05-19T00:00:00Z" },
  });
}

describe("GET /api/case", () => {
  it("returns 400 when path is missing", async () => {
    const res = await handleCase("http://localhost/api/case", { client: client() });
    expect(res.status).toBe(400);
  });

  it("returns detail including samples and server_info", async () => {
    const res = await handleCase(
      "http://localhost/api/case?path=2026-05-19/run-1/bench.json",
      { client: client() },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.samples.ttfts).toEqual([2.79]);
    expect(body.server_info.tp_size).toBe(16);
    expect(body.median_ttft_ms).toBe(84477.13);
  });

  it("returns 404 for a path with bad shape", async () => {
    const res = await handleCase(
      "http://localhost/api/case?path=not-a-valid-path",
      { client: client() },
    );
    expect(res.status).toBe(404);
  });
});

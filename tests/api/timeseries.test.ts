import { describe, it, expect } from "vitest";
import { handleTimeseries as handle } from "@/lib/api/timeseries-handler";
import { makeFakeGcsClient } from "../helpers/fixtures";

const PERF = (out: number) => JSON.stringify({
  type: "perf", case: "bench", profile: "p", target: "v6e-4x4",
  completed: 1, median_ttft_ms: 1, median_itl_ms: 1,
  input_throughput: 1, output_throughput: out, request_throughput: 1,
});

function client() {
  return makeFakeGcsClient({
    "2026-05-17/run-1/bench.json": { body: PERF(100), updated: "2026-05-17T00:00:00Z" },
    "2026-05-18/run-2/bench.json": { body: PERF(200), updated: "2026-05-18T00:00:00Z" },
  });
}

describe("GET /api/timeseries", () => {
  it("returns a 400 when required params are missing", async () => {
    const res = await handle("http://localhost/api/timeseries", {
      client: client(),
      now: new Date("2026-05-19T00:00:00Z"),
    });
    expect(res.status).toBe(400);
  });

  it("returns a sorted series for a valid selector", async () => {
    const res = await handle(
      "http://localhost/api/timeseries?case=bench&profile=p&target=v6e-4x4&days=30",
      { client: client(), now: new Date("2026-05-19T00:00:00Z") },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.metric).toBe("output_throughput");
    expect(body.points.map((p: { date: string }) => p.date)).toEqual([
      "2026-05-17",
      "2026-05-18",
    ]);
    expect(body.points.map((p: { value: number }) => p.value)).toEqual([100, 200]);
  });

  it("returns 404 when no case matches the selector", async () => {
    const res = await handle(
      "http://localhost/api/timeseries?case=missing&profile=p&target=v6e-4x4",
      { client: client(), now: new Date("2026-05-19T00:00:00Z") },
    );
    expect(res.status).toBe(404);
  });
});

import { describe, it, expect, vi } from "vitest";

import { handleCases as handle } from "@/lib/api/cases-handler";
import type { GcsClient } from "@/lib/gcs";

const PERF = JSON.stringify({
  type: "perf", case: "bench", profile: "p", target: "v6e-4x4",
  completed: 1, median_ttft_ms: 1, median_itl_ms: 1,
  input_throughput: 1, output_throughput: 100, request_throughput: 1,
});

function fakeClient(): GcsClient {
  return {
    async listObjects(prefix) {
      if (prefix === "2026-05-18/")
        return [{ name: "2026-05-18/run-1/bench.json", updated: "2026-05-18T00:00:00Z" }];
      return [];
    },
    async getObject() {
      return PERF;
    },
    async statObject(name) {
      return { name, updated: "2026-05-18T00:00:00Z" };
    },
  };
}

describe("GET /api/cases", () => {
  it("returns cases for the default 7-day window", async () => {
    vi.stubEnv("GCS_BUCKET", "test-bucket");
    const res = await handle("http://localhost/api/cases", { client: fakeClient(), now: new Date("2026-05-18T12:00:00Z") });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cases).toHaveLength(1);
    expect(body.errors).toEqual([]);
  });

  it("respects the days query param", async () => {
    const res = await handle("http://localhost/api/cases?days=1", { client: fakeClient(), now: new Date("2026-05-18T12:00:00Z") });
    const body = await res.json();
    expect(body.cases).toHaveLength(1);
  });

  it("returns 503 with a friendly hint when GCS rejects auth", async () => {
    const failing: GcsClient = {
      async listObjects() {
        throw new Error("401 Anonymous caller does not have storage.objects.list");
      },
      async getObject() {
        throw new Error("never called");
      },
      async statObject() {
        throw new Error("never called");
      },
    };
    const res = await handle("http://localhost/api/cases", { client: failing, now: new Date() });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toMatch(/ADC|application-default/i);
  });
});
